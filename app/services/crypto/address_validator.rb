# frozen_string_literal: true

module Crypto
  class AddressValidator
    # Supported network formats
    TRC20_REGEX = /\AT[1-9A-HJ-NP-Za-km-z]{33}\z/
    EVM_REGEX = /\A0x[a-fA-F0-9]{40}\z/
    BTC_LEGACY_REGEX = /\A[13][a-km-zA-HJ-NP-Z1-9]{25,34}\z/
    BTC_BECH32_REGEX = /\Abc1[a-z0-9]{39,59}\z/
    SOLANA_REGEX = /\A[1-9A-HJ-NP-Za-km-z]{32,44}\z/

    def self.validate(address, currency = 'USDT')
      return { valid: false, error: 'Address cannot be blank' } if address.to_s.strip.empty?

      addr = address.to_s.strip
      detected_network = detect_network(addr)

      if detected_network == :unknown
        return { valid: false, error: 'Unrecognized crypto address format' }
      end

      # Check network currency compatibility
      valid = case currency.to_s.upcase
              when 'USDT' then %i[trc20 evm solana].include?(detected_network)
              when 'BTC' then %i[btc_legacy btc_bech32].include?(detected_network)
              when 'ETH' then detected_network == :evm
              when 'SOL' then detected_network == :solana
              else true
              end

      {
        valid: valid,
        network: detected_network,
        error: valid ? nil : "Address #{addr} is not compatible with #{currency}"
      }
    end

    def self.detect_network(address)
      case address
      when TRC20_REGEX then :trc20
      when EVM_REGEX then :evm
      when BTC_BECH32_REGEX then :btc_bech32
      when BTC_LEGACY_REGEX then :btc_legacy
      when SOLANA_REGEX then :solana
      else :unknown
      end
    end
  end
end
