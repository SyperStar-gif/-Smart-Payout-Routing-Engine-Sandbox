# frozen_string_literal: true

require_relative 'base'
require 'securerandom'

module PayoutProviders
  class CryptoPayProvider < Base
    def initialize(opts = {})
      defaults = {
        id: 'prov_crypto_direct',
        name: 'CryptoPayouts Pro (TRC20 / ERC20 / SOL)',
        fee_percent: 0.5,
        fee_fixed: 1.0,
        min_amount: 10.0,
        max_amount: 1_000_000.0,
        daily_limit: 10_000_000.0,
        currencies: %w[USDT BTC ETH SOL],
        countries: %w[GLOBAL RU US EU KZ GB TR SG AE],
        methods: %w[crypto]
      }
      super(**defaults.merge(opts))
    end

    def process_payout(request)
      address = request.dig(:recipient, :account_identifier)
      raise 'Missing destination blockchain address' unless address

      # Simulated broadcast to node mempool
      tx_hash = "0x#{SecureRandom.hex(32)}"

      {
        success: true,
        transaction_id: "CRYPTO-#{SecureRandom.hex(6).upcase}",
        tx_hash: tx_hash,
        status: :broadcasted,
        fee_charged: calculate_fee(request[:amount]),
        network: request[:currency] == 'USDT' ? 'TRON (TRC20)' : 'NATIVE'
      }
    end
  end
end
