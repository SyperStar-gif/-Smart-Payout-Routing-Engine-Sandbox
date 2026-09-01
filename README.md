# 💎 Smart Payout Routing Engine (Ruby 3.3+ / Rails Architecture)

[![Ruby](https://img.shields.io/badge/Ruby-3.3%2B-red.svg)](https://www.ruby-lang.org/)
[![RSpec](https://img.shields.io/badge/Tests-RSpec%203.13-green.svg)](https://rspec.info/)
[![Sidekiq](https://img.shields.io/badge/Queue-Sidekiq%207.2-blue.svg)](https://sidekiq.org/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

Высоконагруженный интеллектуальный движок маршрутизации выплат (**Smart Payout Router**) на **Ruby 3.3+**, спроектированный по стандартам Fintech-инфраструктуры (PCI-DSS / 115-ФЗ / AML KYT / OFAC).

Обеспечивает выбор оптимального платёжного шлюза на основе многофакторного скоринга (TOPSIS/AHP), автоматический каскадный переход (Fallback) при сбоях (HTTP 504 Timeout, Insufficient Funds) и защиту от каскадных аварий через паттерн **Circuit Breaker**.

---

## 🏗️ Архитектура системы (Ruby)

```
├── app/
│   ├── controllers/
│   │   └── api/v1/
│   │       └── payouts_controller.rb     # REST API контроллер выплат
│   ├── models/
│   │   ├── payout_transaction.rb         # Модель транзакции и статусов
│   │   └── routing_rule.rb               # Бизнес-правила (Boost/Force/Exclude)
│   ├── services/
│   │   ├── payout_router.rb              # Ядро маршрутизации (4-этапный пайплайн)
│   │   ├── circuit_breaker.rb            # Автомат защиты шлюзов (Closed/Open/Half-Open)
│   │   ├── risk/
│   │   │   └── aml_scorer.rb             # Скоринг 115-ФЗ, санкций и крипто-миксеров
│   │   ├── routing/
│   │   │   ├── topsis_scorer.rb          # Многокритериальная оптимизация TOPSIS
│   │   │   ├── adaptive_learning.rb      # Сглаживание задержек EWMA и авто-подстройка весов
│   │   │   └── batch_processor.rb        # Параллельный батч-процессинг выплат
│   │   ├── crypto/
│   │   │   ├── address_validator.rb      # Валидация адресов TRC-20, ERC-20, BTC, Solana
│   │   │   └── precision_calculator.rb   # 8-значная арифметика без потери точности
│   │   └── payout_providers/
│   │       ├── base.rb                   # Базовый абстрактный провайдер (Strategy Pattern)
│   │       ├── sbp_provider.rb           # Интеграция СБП (Россия)
│   │       ├── stripe_provider.rb        # Интеграция Stripe Connect (США/ЕС)
│   │       └── crypto_pay_provider.rb    # Интеграция ончейн-криптовыплат (USDT/BTC)
│   └── workers/
│       ├── payout_execution_worker.rb    # Sidekiq-воркер с защитой Redlock от двойных выплат
│       └── provider_health_check_worker.rb # Периодический мониторинг доступности шлюзов
├── lib/
│   └── smart_routing.rb                  # Корневой модуль и версионирование
├── spec/                                 # Спецификации RSpec
│   ├── spec_helper.rb
│   └── services/
│       ├── payout_router_spec.rb         # Тесты фильтрации, скоринга и каскадов
│       ├── topsis_scorer_spec.rb         # Тесты многофакторного ранжирования
│       ├── circuit_breaker_spec.rb       # Тесты автоматов защиты
│       ├── aml_scorer_spec.rb            # Тесты комплаенс-скоринга
│       └── crypto_spec.rb                # Тесты ончейн-валидаций
├── Gemfile                               # Манифест зависимостей Ruby
├── Rakefile                              # Rake-задачи для сборки и тестов
└── .gitattributes                        # Конфигурация GitHub Linguist (100% Ruby)
```

---

## ⚡ Быстрый старт на Ruby

### 1. Установка зависимостей
```bash
bundle install
```

### 2. Запуск тестового сьюта (RSpec)
```bash
bundle exec rspec
```

### 3. Пример использования сервиса роутинга в Ruby-коде
```ruby
require_relative 'lib/smart_routing'

# Инициализация доступных провайдеров
providers = [
  PayoutProviders::SbpProvider.new,
  PayoutProviders::StripeProvider.new,
  PayoutProviders::CryptoPayProvider.new
]

# Создание экземпляра роутера
router = PayoutRouter.new(
  providers: providers,
  weights: { fee: 0.35, success_rate: 0.30, latency: 0.20, headroom: 0.15 }
)

# Запрос на выплату
payout_request = {
  id: 'payout_1001',
  idempotency_key: 'uniq_idempotency_token_99',
  amount: 15_000.0,
  currency: 'RUB',
  country: 'RU',
  method: 'sbp',
  recipient: {
    name: 'Иван Петров',
    account_identifier: '+79991234567'
  }
}

# Исполнение маршрутизации с каскадным переходом
result = router.route_and_execute(payout_request)

if result.success
  puts "✅ Выплата успешно проведена через #{result.provider.name} (TxID: #{result.transaction_id})"
else
  puts "❌ Ошибка проведения выплаты: #{result.error}"
end
```

---

## 🛡️ Ключевые возможности алгоритма

1. **4-х факторная модель скоринга (TOPSIS / AHP)**:
   $$\text{Score} = w_{\text{fee}} \cdot S_{\text{fee}} + w_{\text{sr}} \cdot S_{\text{sr}} + w_{\text{lat}} \cdot S_{\text{lat}} + w_{\text{cap}} \cdot S_{\text{cap}}$$
2. **Circuit Breaker (Паттерн автомата защиты)**:
   Шлюзы со сбоями автоматически изолируются в состояние `OPEN`, не замедляя основной поток, и плавно возвращаются в строй через `HALF_OPEN`.
3. **AML & KYT Compliance Engine**:
   - Автоматическая проверка по 115-ФЗ (порог 600,000 ₽ / $10,000).
   - Определение санкционных адресов и крипто-миксеров (Tornado Cash, Blender).
4. **Гарантия точности (8 знаков)**:
   Использование `BigDecimal` для исключения потери точности в сатоши/вей при конвертации валют.
