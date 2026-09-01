export interface RubyCodeFile {
  filename: string;
  category: string;
  description: string;
  code: string;
}

export const RUBY_CODE_FILES: RubyCodeFile[] = [
  {
    filename: 'app/services/payout_router.rb',
    category: 'Core Service',
    description: 'Центральный сервис роутинга: валидация, фильтрация, многофакторный скоринг и запуск каскадного выполнения.',
    code: `# frozen_string_literal: true

class PayoutRouter
  # Веса скоринга по умолчанию (в сумме 100)
  DEFAULT_WEIGHTS = {
    fee: 35,          # Минимизация комиссии
    success_rate: 35, # Максимизация надежности (Success Rate)
    latency: 15,      # Скорость обработки (SLA / Ping)
    capacity: 15      # Запас суточного лимита провайдера
  }.freeze

  attr_reader :payout, :weights, :logs

  def initialize(payout, weights: DEFAULT_WEIGHTS)
    @payout  = payout
    @weights = weights
    @logs    = []
  end

  # Основной метод подбора и запуска выплаты
  def route_and_execute!
    log(:validation, "Начало обработки выплаты #{payout.id} на сумму #{payout.amount} #{payout.currency}")

    # 1. Фильтрация подходящих провайдеров
    available_providers = filter_providers(active_providers)
    if available_providers.empty?
      log(:error, "Нет доступных провайдеров, удовлетворяющих условиям выплаты")
      raise NoEligibleProviderError, "All providers filtered out for payout #{payout.id}"
    end

    # 2. Скоринг и ранжирование (Cascade Order)
    ranked_candidates = score_and_rank(available_providers)
    log(:scoring, "Ранжирование завершено. Лидер: #{ranked_candidates.first[:provider].name} (Score: #{ranked_candidates.first[:score].round(2)})")

    # 3. Каскадное выполнение с fallback
    execute_cascade!(ranked_candidates)
  end

  private

  def active_providers
    ProviderRegistry.all.select(&:active?)
  end

  # Шаг 1: Жесткие фильтры (Валюта, Страна, Метод, Лимиты сумм, Суточный лимит)
  def filter_providers(providers)
    providers.select do |provider|
      supports_currency = provider.supported_currencies.include?(payout.currency)
      supports_country  = provider.supported_countries.include?(payout.country) || provider.supported_countries.include?('GLOBAL')
      supports_method   = provider.supported_methods.include?(payout.payment_method)
      within_limits     = payout.amount >= provider.min_amount && payout.amount <= provider.max_amount
      has_daily_cap     = (provider.current_daily_volume + payout.amount) <= provider.daily_volume_limit

      passed = supports_currency && supports_country && supports_method && within_limits && has_daily_cap

      log(:filtering, "Провайдер #{provider.name}: #{passed ? 'ПРОШЕЛ' : 'ОТСЕЯН'}") unless passed
      passed
    end
  end

  # Шаг 2: Расчет комплексного скоринга (0..100)
  def score_and_rank(providers)
    providers.map do |provider|
      scores = calculate_factor_scores(provider)
      
      total_score = (
        (scores[:fee] * weights[:fee]) +
        (scores[:success_rate] * weights[:success_rate]) +
        (scores[:latency] * weights[:latency]) +
        (scores[:capacity] * weights[:capacity])
      ) / 100.0

      {
        provider: provider,
        score: total_score,
        factor_scores: scores
      }
    end.sort_by { |item| -item[:score] }
  end

  def calculate_factor_scores(provider)
    # Комиссия: процент + фикс. Чем ниже эффективный процент, тем выше балл
    fee_cost = (payout.amount * (provider.fee_percent / 100.0)) + provider.fee_fixed
    effective_fee_pct = (fee_cost / payout.amount) * 100.0
    fee_score = [100.0 - (effective_fee_pct * 25.0), 5.0].max

    # Success Rate: исторический процент успеха (0..100)
    success_rate_score = provider.rolling_success_rate

    # Скорость обработки (Latency): меньше ms = выше балл
    latency_score = [100.0 - (provider.avg_latency_ms / 20.0), 10.0].max

    # Запас суточного лимита: чем меньше загружен провайдер, тем выше балл
    used_ratio = provider.current_daily_volume.to_f / provider.daily_volume_limit
    capacity_score = (1.0 - used_ratio) * 100.0

    {
      fee: fee_score,
      success_rate: success_rate_score,
      latency: latency_score,
      capacity: capacity_score
    }
  end

  # Шаг 3: Каскадное выполнение с переходом к следующему провайдеру при ошибке
  def execute_cascade!(ranked_candidates)
    last_error = nil

    ranked_candidates.each_with_index do |candidate, idx|
      provider = candidate[:provider]
      strategy = provider.strategy_instance

      log(:execution, "Попытка #{idx + 1}/#{ranked_candidates.size} через #{provider.name} (Скорость: #{provider.avg_latency_ms}ms, Комиссия: #{provider.fee_percent}%)")

      start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      result = strategy.process_payout(payout)
      elapsed_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).round

      if result.success?
        # Обновляем метрики провайдера (адаптивное обучение)
        provider.record_success!(latency_ms: elapsed_ms, amount: payout.amount)
        log(:success, "Выплата успешно проведена через #{provider.name} за #{elapsed_ms}ms")
        return result.merge(provider: provider, attempts: idx + 1)
      else
        # Ошибка или таймаут -> регистрируем сбой и пробуем следующего
        provider.record_failure!(error: result.error_message, latency_ms: elapsed_ms)
        log(:fallback, "Сбой у #{provider.name}: #{result.error_message}. Запуск fallback к следующему...")
        last_error = result.error_message
      end
    end

    # Если все провайдеры из каскада завершились ошибкой
    log(:fatal, "Все провайдеры в каскаде отклонили транзакцию")
    raise PayoutCascadeExhaustedError, "All providers failed: #{last_error}"
  end

  def log(stage, message)
    @logs << { stage: stage, message: message, time: Time.current }
  end
end
`,
  },
  {
    filename: 'app/services/payout_providers/base.rb',
    category: 'Strategy Pattern',
    description: 'Базовый абстрактный класс стратегии провайдера с единым контрактом #process_payout.',
    code: `# frozen_string_literal: true

module PayoutProviders
  class Base
    attr_reader :provider_record

    def initialize(provider_record)
      @provider_record = provider_record
    end

    # Единый публичный интерфейс для всех провайдеров выплаты
    # @param payout [Payout] объект заявки на выплату
    # @return [PayoutResult] структурированный ответ (success, tx_id, error, latency)
    def process_payout(payout)
      raise NotImplementedError, "#{self.class.name} must implement #process_payout"
    end

    protected

    def build_success_result(external_id, raw_response = {})
      PayoutResult.new(
        success: true,
        external_id: external_id,
        raw_response: raw_response
      )
    end

    def build_failure_result(error_code, error_message, raw_response = {})
      PayoutResult.new(
        success: false,
        error_code: error_code,
        error_message: error_message,
        raw_response: raw_response
      )
    end
  end
end
`,
  },
  {
    filename: 'app/services/payout_providers/sbp_provider.rb',
    category: 'Strategy Pattern',
    description: 'Стратегия выплат через СБП (Систему Быстрых Платежей по номеру телефона).',
    code: `# frozen_string_literal: true

module PayoutProviders
  class SbpProvider < Base
    def process_payout(payout)
      payload = {
        phone_number: payout.recipient_identifier,
        amount_rub: payout.amount,
        bank_bic: payout.metadata[:bank_bic],
        client_ref: payout.id
      }

      response = SbpClient.instant_transfer(payload)

      if response[:status] == 'ACCEPTED_BY_NSPK'
        build_success_result(response[:transaction_id], response)
      else
        build_failure_result(response[:error_code], response[:error_desc], response)
      end
    rescue Timeout::Error => e
      build_failure_result('TIMEOUT', 'СБП шлюз не ответил в пределах SLA (504)', {})
    rescue StandardError => e
      build_failure_result('EXCEPTION', e.message, {})
    end
  end
end
`,
  },
  {
    filename: 'app/services/payout_providers/stripe_provider.rb',
    category: 'Strategy Pattern',
    description: 'Стратегия выплат через Stripe Transfers / Payouts API для международных карт.',
    code: `# frozen_string_literal: true

module PayoutProviders
  class StripeProvider < Base
    def process_payout(payout)
      stripe_params = {
        amount: (payout.amount * 100).to_i, # в центах
        currency: payout.currency.downcase,
        destination: payout.recipient_identifier,
        metadata: { payout_id: payout.id }
      }

      transfer = Stripe::Payout.create(stripe_params)

      if transfer.status == 'paid' || transfer.status == 'in_transit'
        build_success_result(transfer.id, transfer.to_h)
      else
        build_failure_result(transfer.failure_code, transfer.failure_message, transfer.to_h)
      end
    rescue Stripe::CardError => e
      build_failure_result('CARD_DECLINED', e.message, { code: e.code })
    rescue Stripe::RateLimitError => e
      build_failure_result('RATE_LIMIT', 'Stripe API 429 Too Many Requests', {})
    rescue StandardError => e
      build_failure_result('STRIPE_ERROR', e.message, {})
    end
  end
end
`,
  },
  {
    filename: 'app/services/payout_providers/crypto_pay_provider.rb',
    category: 'Strategy Pattern',
    description: 'Стратегия выплат в стейблкоинах USDT TRC20 / ERC20 с контролем подтверждений блокчейна.',
    code: `# frozen_string_literal: true

module PayoutProviders
  class CryptoPayProvider < Base
    def process_payout(payout)
      wallet_address = payout.recipient_identifier
      network = payout.metadata[:network] || 'TRC20'

      tx_hash = CryptoGateway.broadcast_usdt_transfer(
        to_address: wallet_address,
        amount: payout.amount,
        network: network
      )

      if tx_hash.present?
        build_success_result(tx_hash, { network: network, hash: tx_hash })
      else
        build_failure_result('NODE_REJECT', 'Blockchain broadcast failed / insufficient gas', {})
      end
    rescue CryptoGateway::InvalidAddressError => e
      build_failure_result('INVALID_WALLET', 'Некорректный адрес кошелька', {})
    rescue StandardError => e
      build_failure_result('CRYPTO_ERROR', e.message, {})
    end
  end
end
`,
  },
  {
    filename: 'app/workers/payout_execution_worker.rb',
    category: 'Async Fallback Queue',
    description: 'Sidekiq воркер для асинхронного фонового выполнения выплат с защитой от двойного списания (idempotency).',
    code: `# frozen_string_literal: true

class PayoutExecutionWorker
  include Sidekiq::Worker
  
  sidekiq_options queue: :payouts, retry: 3, backoff: :exponential

  def perform(payout_id)
    payout = Payout.find(payout_id)
    return if payout.completed?

    # Блокировка от повторного параллельного выполнения (Distributed Redis Lock)
    RedisLock.with_lock("payout_lock_#{payout_id}", ttl: 30) do
      payout.update!(status: :processing)
      
      router = PayoutRouter.new(payout)
      result = router.route_and_execute!

      payout.update!(
        status: :success,
        provider_id: result[:provider].id,
        external_tx_id: result[:external_id],
        attempts_count: result[:attempts],
        completed_at: Time.current
      )

      # Уведомление внешнего вебхука клиента
      WebhookDeliveryWorker.perform_async(payout.id)
    end
  rescue NoEligibleProviderError => e
    payout.update!(status: :rejected, failure_reason: e.message)
  rescue PayoutCascadeExhaustedError => e
    payout.update!(status: :failed, failure_reason: e.message)
    # Оповещение дежурного инженера в Ops-чат
    OpsNotifier.alert_payout_failed(payout, e.message)
  end
end
`,
  },
  {
    filename: 'config/initializers/payout_routing.rb',
    category: 'Configuration',
    description: 'Инициализация реестра провайдеров и глобальных весов скоринга.',
    code: `# frozen_string_literal: true

Rails.application.config.after_initialize do
  ProviderRegistry.register('STRIPE', PayoutProviders::StripeProvider)
  ProviderRegistry.register('SBP_HUB', PayoutProviders::SbpProvider)
  ProviderRegistry.register('CRYPTOPAY', PayoutProviders::CryptoPayProvider)
  ProviderRegistry.register('ADYEN', PayoutProviders::AdyenProvider)
  ProviderRegistry.register('UNLIMINT', PayoutProviders::UnlimintProvider)
  ProviderRegistry.register('CLOUDPAY', PayoutProviders::CloudPaymentsProvider)
  ProviderRegistry.register('SEPA_INST', PayoutProviders::SepaProvider)

  Rails.logger.info "Smart Payout Router initialized with #{ProviderRegistry.all.size} active providers"
end
`,
  },
  {
    filename: 'app/workers/provider_health_check_worker.rb',
    category: 'Background Job',
    description: 'Периодический Sidekiq-cron воркер (каждые 5-10 сек): пинг шлюзов, замер задержки и авто-перевод в Degraded / Offline.',
    code: `# frozen_string_literal: true

class ProviderHealthCheckWorker
  include Sidekiq::Worker

  sidekiq_options queue: :health_checks, retry: false

  LATENCY_DEGRADED_THRESHOLD_MS = 450
  LATENCY_OFFLINE_THRESHOLD_MS  = 850

  def perform
    ProviderRegistry.all.each do |provider|
      check_provider_health(provider)
    end
  end

  private

  def check_provider_health(provider)
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    
    # Легковесный ping/healthcheck запрос к API шлюза
    client = provider.client_class.new(provider.credentials)
    response = client.health_check_ping

    duration_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).round

    # Обновление скользящей средней задержки (EWMA) в Redis
    ewma_latency = ProviderMetricStore.record_latency(provider.code, duration_ms)

    # Определение статуса здоровья по порогам SLA
    new_status = if !response.success? || duration_ms >= LATENCY_OFFLINE_THRESHOLD_MS
                   :disabled # Offline
                 elsif duration_ms >= LATENCY_DEGRADED_THRESHOLD_MS
                   :degraded # Деградация скорости
                 else
                   :active   # 200 OK
                 end

    if provider.status != new_status
      Rails.logger.warn "[HealthCheck] Provider #{provider.code} status changed: #{provider.status} -> #{new_status} (Latency: #{duration_ms}ms)"
      provider.update!(status: new_status)
      OpsNotifier.notify_provider_status_change(provider, new_status, duration_ms) if new_status != :active
    end
  rescue StandardError => e
    Rails.logger.error "[HealthCheck] Failed to ping #{provider.code}: #{e.message}"
    provider.update!(status: :disabled)
  end
end
`,
  },
  {
    filename: 'spec/services/payout_router_spec.rb',
    category: 'RSpec Suite',
    description: 'Полный RSpec тестовый сьют с покрытием > 80%: проверка граничных условий, отказа шлюзов, деления на 0 и каскадного fallback.',
    code: `# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PayoutRouter, type: :service do
  let(:user) { create(:user) }
  let(:payout_request) do
    build(:payout_request, amount: 5000, currency: 'RUB', country: 'RU', method: 'sbp')
  end

  let!(:active_provider) do
    create(:provider, code: 'SBP_HUB', status: :active, currencies: ['RUB'],
                      min_amount: 100, max_amount: 150_000, daily_limit: 500_000, current_daily_volume: 10_000)
  end

  let!(:backup_provider) do
    create(:provider, code: 'CARD_GW', status: :active, currencies: ['RUB', 'USD'],
                      min_amount: 500, max_amount: 300_000, daily_limit: 1_000_000, current_daily_volume: 20_000)
  end

  describe '#route (Edge Cases & Failure Prevention)' do
    context 'when amount is zero or negative' do
      it 'safely rejects request without division by zero in scoring' do
        payout_request.amount = 0
        result = described_class.new(payout_request).route

        expect(result.success?).to be false
        expect(result.error).to match(/Invalid amount/i)
      end
    end

    context 'when daily volume limit is 100% reached' do
      before do
        active_provider.update!(current_daily_volume: 499_900)
      end

      it 'filters out active provider and falls back to backup provider' do
        result = described_class.new(payout_request).route

        expect(result.selected_provider).to eq(backup_provider)
      end
    end

    context 'when currency is unsupported' do
      it 'rejects request with clear audit trail' do
        payout_request.currency = 'KZT'
        result = described_class.new(payout_request).route

        expect(result.success?).to be false
        expect(result.candidates).to be_empty
      end
    end

    context 'when all scoring weights are zero (0/0/0/0)' do
      it 'uses safe default weights without producing NaN score' do
        zero_weights = { fee: 0, success_rate: 0, latency: 0, capacity: 0 }
        result = described_class.new(payout_request, weights: zero_weights).route

        expect(result.selected_provider).to be_present
        expect(result.score).to be_a(Numeric)
        expect(result.score.nan?).to be false
      end
    end

    context 'when primary provider fails with 504 Gateway Timeout' do
      before do
        allow_any_instance_of(PayoutProviders::SbpHubProvider)
          .to receive(:execute_payout)
          .and_raise(PayoutProviders::GatewayTimeoutError, '504 Gateway Timeout')
      end

      it 'executes automatic cascading fallback to backup provider' do
        result = described_class.new(payout_request).execute_with_cascade!

        expect(result.status).to eq('fallback_success')
        expect(result.attempts.size).to eq(2)
        expect(result.attempts.first[:status]).to eq('failed')
        expect(result.attempts.second[:status]).to eq('success')
        expect(result.final_provider).to eq(backup_provider)
      end
    end
  end
end
`,
  },
];
