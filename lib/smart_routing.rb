# frozen_string_literal: true

require_relative '../app/services/payout_router'
require_relative '../app/services/circuit_breaker'
require_relative '../app/services/risk/aml_scorer'
require_relative '../app/services/payout_providers/base'
require_relative '../app/services/payout_providers/sbp_provider'
require_relative '../app/services/payout_providers/stripe_provider'
require_relative '../app/services/payout_providers/crypto_pay_provider'

module SmartRouting
  VERSION = '1.0.0'

  class Error < StandardError; end
  class AllProvidersFailedError < Error; end
  class NoEligibleProvidersError < Error; end
  class RiskCheckFailedError < Error; end
end
