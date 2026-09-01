# frozen_string_literal: true

module Api
  module V1
    class PayoutsController
      def self.create(params)
        request_data = {
          id: "req_#{SecureRandom.hex(6)}",
          idempotency_key: params[:idempotency_key] || SecureRandom.uuid,
          amount: params[:amount].to_f,
          currency: params[:currency].to_s.upcase,
          country: params[:country].to_s.upcase,
          method: params[:method].to_s,
          recipient: {
            name: params.dig(:recipient, :name),
            account_identifier: params.dig(:recipient, :account_identifier)
          }
        }

        # Initialize Default Providers
        providers = [
          PayoutProviders::SbpProvider.new,
          PayoutProviders::StripeProvider.new,
          PayoutProviders::CryptoPayProvider.new
        ]

        router = PayoutRouter.new(providers: providers)
        result = router.route_and_execute(request_data)

        if result.success
          {
            status: 200,
            json: {
              success: true,
              transaction_id: result.transaction_id,
              provider_id: result.provider.id,
              provider_name: result.provider.name,
              attempts: result.attempts
            }
          }
        else
          {
            status: 422,
            json: {
              success: false,
              error: result.error,
              attempts: result.attempts
            }
          }
        end
      end
    end
  end
end
