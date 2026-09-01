# frozen_string_literal: true

require 'spec_helper'

RSpec.describe PayoutRouter do
  let(:mock_redis) { double('Redis', set: true, del: true, get: nil) }
  let(:sbp_provider) { PayoutProviders::SbpProvider.new }
  let(:stripe_provider) { PayoutProviders::StripeProvider.new }
  let(:crypto_provider) { PayoutProviders::CryptoPayProvider.new }
  let(:providers) { [sbp_provider, stripe_provider, crypto_provider] }

  subject(:router) { described_class.new(providers: providers, redis: mock_redis) }

  describe '#filter_providers' do
    it 'filters out providers that do not support the target currency' do
      rub_request = {
        amount: 5000,
        currency: 'RUB',
        country: 'RU',
        method: 'sbp'
      }
      eligible = router.filter_providers(rub_request)
      expect(eligible.map(&:id)).to include('prov_sbp_fast')
      expect(eligible.map(&:id)).not_to include('prov_stripe_connect')
    end

    it 'filters out providers when amount is below minimum threshold' do
      tiny_request = {
        amount: 1.0,
        currency: 'RUB',
        country: 'RU',
        method: 'sbp'
      }
      eligible = router.filter_providers(tiny_request)
      expect(eligible).to be_empty
    end
  end

  describe '#score_and_rank' do
    it 'prioritizes provider with lowest fees when success rate and latency are equal' do
      request = {
        amount: 10_000,
        currency: 'RUB',
        country: 'RU',
        method: 'sbp'
      }
      eligible = router.filter_providers(request)
      ranked = router.score_and_rank(eligible, request)

      expect(ranked.first[:provider].id).to eq('prov_sbp_fast')
    end
  end

  describe '#route_and_execute cascade fallback' do
    it 'automatically cascades to backup provider if primary provider fails with 504 timeout' do
      allow(sbp_provider).to receive(:process_payout).and_raise(StandardError, 'Gateway Timeout (504)')

      # Add a backup provider for RUB
      backup_provider = PayoutProviders::Base.new(
        id: 'prov_backup_rub',
        name: 'Backup Card Payouts',
        currencies: %w[RUB],
        countries: %w[RU],
        methods: %w[sbp card],
        min_amount: 10,
        max_amount: 500_000,
        fee_percent: 2.5
      )
      allow(backup_provider).to receive(:process_payout).and_return(
        success: true,
        transaction_id: 'BACKUP-TX-999'
      )

      custom_router = described_class.new(
        providers: [sbp_provider, backup_provider],
        redis: mock_redis
      )

      request = {
        idempotency_key: 'req_123',
        amount: 5000,
        currency: 'RUB',
        country: 'RU',
        method: 'sbp',
        recipient: { account_identifier: '+79991234567' }
      }

      result = custom_router.route_and_execute(request)
      expect(result.success).to be true
      expect(result.provider.id).to eq('prov_backup_rub')
      expect(result.attempts).to eq(2)
    end
  end
end
