# frozen_string_literal: true

require_relative '../circuit_breaker'

module PayoutProviders
  class Base
    attr_reader :id, :name, :fee_percent, :fee_fixed, :min_amount, :max_amount,
                :daily_limit, :currencies, :countries, :methods, :stats, :circuit_breaker

    def initialize(
      id:,
      name:,
      fee_percent: 1.5,
      fee_fixed: 0.0,
      min_amount: 10.0,
      max_amount: 100_000.0,
      daily_limit: 1_000_000.0,
      currencies: %w[USD EUR RUB USDT],
      countries: %w[RU US EU KZ GLOBAL],
      methods: %w[card sbp crypto bank_transfer],
      stats: {}
    )
      @id = id
      @name = name
      @fee_percent = fee_percent
      @fee_fixed = fee_fixed
      @min_amount = min_amount
      @max_amount = max_amount
      @daily_limit = daily_limit
      @currencies = currencies.map(&:to_s).map(&:upcase)
      @countries = countries.map(&:to_s).map(&:upcase)
      @methods = methods.map(&:to_s)
      @stats = {
        success_rate: 98.5,
        latency_ewma_ms: 120.0,
        volume_today: 0.0
      }.merge(stats)
      @circuit_breaker = CircuitBreaker.new(service_name: id)
    end

    def supports_currency?(currency)
      @currencies.include?(currency.to_s.upcase)
    end

    def supports_country?(country)
      @countries.include?('GLOBAL') || @countries.include?(country.to_s.upcase)
    end

    def supports_method?(method)
      @methods.include?(method.to_s)
    end

    def within_limits?(amount)
      amount >= @min_amount && amount <= @max_amount
    end

    def has_sufficient_headroom?(amount)
      (@stats[:volume_today] + amount) <= @daily_limit
    end

    def calculate_fee(amount)
      ((amount * (@fee_percent / 100.0)) + @fee_fixed).round(4)
    end

    def record_success(latency_ms, amount)
      # Update EWMA (Exponential Weighted Moving Average) with alpha = 0.2
      alpha = 0.2
      @stats[:latency_ewma_ms] = ((1.0 - alpha) * @stats[:latency_ewma_ms] + alpha * latency_ms).round(1)
      @stats[:volume_today] += amount
      @stats[:success_rate] = [100.0, @stats[:success_rate] + 0.1].min
      @circuit_breaker.record_success
    end

    def record_failure(_error_code)
      @stats[:success_rate] = [0.0, @stats[:success_rate] - 1.5].max
      @circuit_breaker.record_failure
    end

    def record_exception(exception)
      @stats[:success_rate] = [0.0, @stats[:success_rate] - 3.0].max
      @circuit_breaker.record_failure
    end

    # Abstract method to be overridden by concrete providers
    def process_payout(_request)
      raise NotImplementedError, "#{self.class.name}#process_payout must be implemented"
    end
  end
end
