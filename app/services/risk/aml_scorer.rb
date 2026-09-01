# frozen_string_literal: true

module Risk
  class AmlScorer
    HIGH_RISK_COUNTRIES = %w[KP IR SY MM CU].freeze
    SANCTIONED_MARKERS = %w[tornado mixer blender darknet 0x0000000000000000000000000000000000000000].freeze

    def self.assess(request)
      score = 0
      reasons = []
      requires_enhanced_kyc = false

      # 1. Sanctioned Countries / High-Risk Jurisdictions
      country = request[:country].to_s.upcase
      if HIGH_RISK_COUNTRIES.include?(country)
        score += 90
        reasons << "HIGH_RISK_JURISDICTION: Country #{country} is under international sanctions"
      end

      # 2. Crypto Mixer / OFAC Sanctioned Wallet check
      if request[:method].to_s == 'crypto' || request[:currency].to_s.upcase == 'USDT'
        recipient_id = request.dig(:recipient, :account_identifier).to_s.downcase
        if SANCTIONED_MARKERS.any? { |marker| recipient_id.include?(marker) }
          score += 85
          reasons << 'SANCTIONED_OR_MIXER_WALLET_DETECTED: Address linked to cryptocurrency mixers or sanctions'
        end
      end

      # 3. 115-FZ Mandatory Regulatory Control Threshold (> 600,000 RUB or $10k equivalent)
      amount = request[:amount].to_f
      currency = request[:currency].to_s.upcase
      is_above_threshold = (currency == 'RUB' && amount >= 600_000.0) ||
                           (%w[USD EUR USDT].include?(currency) && amount >= 10_000.0)

      if is_above_threshold
        requires_enhanced_kyc = true
        score += 25
        reasons << 'THRESHOLD_115_FZ: Transaction exceeds mandatory AML compliance limit'
      end

      # 4. Large single volume check (> 1,000,000 RUB or $25k)
      if (currency == 'RUB' && amount >= 1_000_000.0) || (currency == 'USD' && amount >= 25_000.0)
        score += 20
        reasons << 'LARGE_VOLUME: Single transaction volume exceeds normal velocity'
      end

      # Determine risk bucket
      risk_level = if score >= 75
                     :critical
                   elsif score >= 45
                     :high
                   elsif score >= 20
                     :medium
                   else
                     :low
                   end

      action = case risk_level
               when :critical then :reject
               when :high then :manual_review
               when :medium then :enhanced_auth
               else :allow
               end

      {
        risk_score: [score, 100].min,
        risk_level: risk_level,
        action: action,
        reasons: reasons,
        requires_enhanced_kyc: requires_enhanced_kyc
      }
    end
  end
end
