# frozen_string_literal: true

require_relative 'base'
require 'securerandom'

module PayoutProviders
  class SbpProvider < Base
    def initialize(opts = {})
      defaults = {
        id: 'prov_sbp_fast',
        name: 'СБП B2C (Faster Payments Russia)',
        fee_percent: 0.7,
        fee_fixed: 15.0,
        min_amount: 100.0,
        max_amount: 500_000.0,
        daily_limit: 15_000_000.0,
        currencies: %w[RUB],
        countries: %w[RU],
        methods: %w[sbp card]
      }
      super(**defaults.merge(opts))
    end

    def process_payout(request)
      # Simulating HTTP Call to Central Bank NSPK / SBP API
      phone = request.dig(:recipient, :account_identifier)
      raise 'Invalid phone number for SBP' if phone && !phone.match?(/^\+?7\d{10}$/)

      {
        success: true,
        transaction_id: "SBP-#{SecureRandom.hex(8).upcase}",
        status: :settled,
        fee_charged: calculate_fee(request[:amount]),
        provider_reference: "NSPK-#{Time.now.to_i}-#{SecureRandom.hex(4)}"
      }
    end
  end
end
