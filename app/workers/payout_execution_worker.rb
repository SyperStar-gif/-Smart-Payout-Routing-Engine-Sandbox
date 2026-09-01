# frozen_string_literal: true

require 'sidekiq'
require_relative '../services/payout_router'

class PayoutExecutionWorker
  include Sidekiq::Worker

  sidekiq_options queue: :payouts, retry: 3, dead: true

  def perform(payout_request_json)
    request = Oj.load(payout_request_json, symbol_keys: true)

    router = PayoutRouter.new(
      providers: default_providers,
      weights: PayoutRouter::DEFAULT_WEIGHTS
    )

    result = router.route_and_execute(request)

    if result.success
      logger.info "Payout #{request[:id]} successfully settled via #{result.provider.name} (TxID: #{result.transaction_id})"
    else
      logger.error "Payout #{request[:id]} failed: #{result.error}"
      raise SmartRouting::AllProvidersFailedError, result.error
    end
  end

  private

  def default_providers
    [
      PayoutProviders::SbpProvider.new,
      PayoutProviders::StripeProvider.new,
      PayoutProviders::CryptoPayProvider.new
    ]
  end
end
