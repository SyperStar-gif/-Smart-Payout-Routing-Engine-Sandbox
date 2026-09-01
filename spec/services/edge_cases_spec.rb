# frozen_string_literal: true

require 'spec_helper'

RSpec.describe 'Comprehensive Smart Payout Router Invariants' do
  let(:mock_redis) { double('Redis', set: true, del: true, get: nil) }

  describe 'Edge Case: Division by zero and micro-amounts' do
    it 'handles 0.0001 amount safely without crashing' do
      provider = PayoutProviders::Base.new(
        id: 'prov_micro',
        name: 'Micro Provider',
        min_amount: 0.00001,
        max_amount: 1000,
        fee_percent: 1.0,
        fee_fixed: 0.00001
      )
      router = PayoutRouter.new(providers: [provider], redis: mock_redis)
      req = { amount: 0.0001, currency: 'USD', country: 'US', method: 'card' }
      candidates = router.score_and_rank([provider], req)
      expect(candidates.first[:score]).to be_a(Float)
      expect(candidates.first[:score]).not_to be_nan
    end
  end

  describe 'Edge Case: All providers circuit breaker open' do
    it 'returns clean NO_ELIGIBLE_PROVIDERS error instead of hanging' do
      provider = PayoutProviders::SbpProvider.new
      5.times { provider.record_failure('500') }
      expect(provider.circuit_breaker.open?).to be true

      router = PayoutRouter.new(providers: [provider], redis: mock_redis)
      req = {
        idempotency_key: 'cb_test_1',
        amount: 5000,
        currency: 'RUB',
        country: 'RU',
        method: 'sbp'
      }

      res = router.route_and_execute(req)
      expect(res.success).to be false
      expect(res.error).to include('NO_ELIGIBLE_PROVIDERS')
    end
  end

  describe 'Edge Case: Dynamic Business Rules (Force & Exclude Priority)' do
    it 'excludes unwanted providers and forces preferred provider regardless of higher fee' do
      cheap_provider = PayoutProviders::Base.new(
        id: 'prov_cheap_bad',
        name: 'Cheap Unstable Provider',
        fee_percent: 0.1,
        currencies: %w[USD],
        countries: %w[US GLOBAL],
        methods: %w[card]
      )
      expensive_provider = PayoutProviders::Base.new(
        id: 'prov_vip_fast',
        name: 'VIP Fast Provider',
        fee_percent: 4.0,
        currencies: %w[USD],
        countries: %w[US GLOBAL],
        methods: %w[card]
      )

      rule_exclude = RoutingRule.new(
        id: 'rule_ex',
        name: 'Exclude Cheap Provider',
        enabled: true,
        priority: 1,
        condition_currency: 'USD',
        action_type: :exclude_provider,
        target_provider_id: 'prov_cheap_bad'
      )

      rule_force = RoutingRule.new(
        id: 'rule_fc',
        name: 'Force VIP Provider',
        enabled: true,
        priority: 2,
        condition_currency: 'USD',
        action_type: :force_provider,
        target_provider_id: 'prov_vip_fast'
      )

      router = PayoutRouter.new(
        providers: [cheap_provider, expensive_provider],
        rules: [rule_exclude, rule_force],
        redis: mock_redis
      )

      req = { amount: 1000, currency: 'USD', country: 'US', method: 'card' }
      candidates = router.score_and_rank([cheap_provider, expensive_provider], req)

      expect(candidates.map { |c| c[:provider].id }).not_to include('prov_cheap_bad')
      expect(candidates.first[:provider].id).to eq('prov_vip_fast')
      expect(candidates.first[:score]).to be > 500.0
    end
  end

  describe 'Edge Case: Multi-threaded Concurrent Batch Execution' do
    it 'executes a batch of 10 concurrent requests without race conditions' do
      provider = PayoutProviders::StripeProvider.new
      router = PayoutRouter.new(providers: [provider], redis: mock_redis)

      requests = (1..10).map do |i|
        {
          idempotency_key: "batch_item_#{i}",
          amount: 50.0 + i,
          currency: 'USD',
          country: 'US',
          method: 'card',
          recipient: { name: "User #{i}" }
        }
      end

      batch_res = Routing::BatchProcessor.process_batch(router, requests, max_concurrency: 4)
      expect(batch_res[:total]).to eq(10)
      expect(batch_res[:successful]).to eq(10)
      expect(batch_res[:failed]).to eq(0)
    end
  end

  describe 'Edge Case: Daily Volume Limit Exceeded (Headroom Depletion)' do
    it 'filters out provider when single payout pushes volume over daily ceiling' do
      near_limit_provider = PayoutProviders::Base.new(
        id: 'prov_near_limit',
        name: 'Near Limit Gateway',
        daily_limit: 10_000.0,
        stats: { volume_today: 9_500.0 },
        currencies: %w[USD],
        countries: %w[US GLOBAL],
        methods: %w[card]
      )

      router = PayoutRouter.new(providers: [near_limit_provider], redis: mock_redis)
      req = { amount: 600.0, currency: 'USD', country: 'US', method: 'card' }

      eligible = router.filter_providers(req)
      expect(eligible).to be_empty
    end
  end
end
