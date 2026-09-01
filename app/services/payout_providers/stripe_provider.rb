# frozen_string_literal: true

require_relative 'base'
require 'securerandom'

module PayoutProviders
  class StripeProvider < Base
    def initialize(opts = {})
      defaults = {
        id: 'prov_stripe_connect',
        name: 'Stripe Payouts Direct (US/EU)',
        fee_percent: 1.5,
        fee_fixed: 0.30,
        min_amount: 5.0,
        max_amount: 250_000.0,
        daily_limit: 5_000_000.0,
        currencies: %w[USD EUR GBP],
        countries: %w[US EU GB SG GLOBAL],
        methods: %w[card bank_transfer]
      }
      super(**defaults.merge(opts))
    end

    def process_payout(request)
      # Simulating Stripe Connect Transfers API
      {
        success: true,
        transaction_id: "po_#{SecureRandom.hex(12)}",
        status: :paid,
        fee_charged: calculate_fee(request[:amount]),
        provider_reference: "pyr_#{SecureRandom.hex(10)}"
      }
    end
  end
end
