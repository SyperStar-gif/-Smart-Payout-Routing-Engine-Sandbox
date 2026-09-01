# frozen_string_literal: true

require 'concurrent'
require 'redis'
require 'redlock'

class PayoutRouter
  # Multi-criteria scoring weights
  DEFAULT_WEIGHTS = {
    fee: 0.35,          # Economic efficiency
    success_rate: 0.30, # Historical reliability
    latency: 0.20,      # P95 response time
    headroom: 0.15      # Remaining daily limit capacity
  }.freeze

  Result = Struct.new(:success, :transaction_id, :provider, :attempts, :error, keyword_init: true)

  def initialize(providers: [], rules: [], weights: DEFAULT_WEIGHTS, redis: nil)
    @providers = providers
    @rules = rules
    @weights = weights
    @redis = redis || Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/0'))
    @lock_manager = Redlock::Client.new([@redis])
  end

  # Main routing pipeline: Risk Check -> Filter -> Score & Rank -> Execute Cascade
  def route_and_execute(payout_request)
    idempotency_key = "payout:lock:#{payout_request[:idempotency_key]}"

    # Prevent duplicate execution with distributed lock
    @lock_manager.lock(idempotency_key, 10_000) do |locked|
      raise "Concurrent execution detected for key #{payout_request[:idempotency_key]}" unless locked

      # Step 1: AML & Anti-Fraud Risk Check
      risk_assessment = Risk::AmlScorer.assess(payout_request)
      if risk_assessment[:risk_level] == :critical || risk_assessment[:action] == :reject
        return Result.new(
          success: false,
          error: "AML_REJECTED: #{risk_assessment[:reasons].join(', ')}",
          attempts: 0
        )
      end

      # Step 2: Hard Filtering (Currency, Country, Method, Limits, Circuit Breakers)
      eligible = filter_providers(payout_request)
      if eligible.empty?
        return Result.new(
          success: false,
          error: 'NO_ELIGIBLE_PROVIDERS: No providers meet technical or limit constraints',
          attempts: 0
        )
      end

      # Step 3: Multi-Criteria Scoring & Dynamic Ranking
      ranked_candidates = score_and_rank(eligible, payout_request)

      # Step 4: Cascade Fallback Execution
      execute_cascade(ranked_candidates, payout_request)
    end
  end

  def filter_providers(request)
    @providers.select do |provider|
      next false if provider.circuit_breaker&.open?
      next false unless provider.supports_currency?(request[:currency])
      next false unless provider.supports_country?(request[:country])
      next false unless provider.supports_method?(request[:method])
      next false unless provider.within_limits?(request[:amount])
      next false unless provider.has_sufficient_headroom?(request[:amount])

      true
    end
  end

  def score_and_rank(eligible_providers, request)
    return [] if eligible_providers.empty?

    # Apply Business Rule Overrides (Force / Exclude / Boost)
    active_providers, boost_map, force_set = apply_rules(eligible_providers, request)

    candidates = active_providers.map do |provider|
      # 1. Normalized Fee Score (0..100, lower fee = higher score)
      fee_amt = provider.calculate_fee(request[:amount])
      fee_pct = (fee_amt / request[:amount]) * 100.0
      fee_score = [[100.0 - (fee_pct * 15.0), 0.0].max, 100.0].min

      # 2. Success Rate Score (0..100)
      sr_score = provider.stats[:success_rate].to_f

      # 3. Latency Score (0..100, lower ms = higher score)
      latency_ms = provider.stats[:latency_ewma_ms].to_f
      latency_score = [[100.0 - ((latency_ms / 2000.0) * 100.0), 0.0].max, 100.0].min

      # 4. Headroom Score (0..100)
      used = provider.stats[:volume_today].to_f
      limit = provider.daily_limit.to_f
      headroom_ratio = limit.positive? ? [1.0 - (used / limit), 0.0].max : 1.0
      headroom_score = headroom_ratio * 100.0

      # Composite Multi-Criteria Score (TOPSIS/AHP normalized)
      composite_score = (
        (fee_score * @weights[:fee]) +
        (sr_score * @weights[:success_rate]) +
        (latency_score * @weights[:latency]) +
        (headroom_score * @weights[:headroom])
      )

      # Apply custom rule multipliers & force priority
      composite_score *= boost_map[provider.id] if boost_map[provider.id]
      composite_score += 1000.0 if force_set.include?(provider.id)

      {
        provider: provider,
        score: composite_score.round(2),
        breakdown: { fee: fee_score, sr: sr_score, latency: latency_score, headroom: headroom_score }
      }
    end

    # Sort descending by composite score
    candidates.sort_by { |c| -c[:score] }
  end

  private

  def apply_rules(providers, request)
    boost_map = {}
    force_set = Set.new
    exclude_set = Set.new

    @rules.select(&:enabled?).sort_by(&:priority).each do |rule|
      next unless rule.matches?(request)

      case rule.action_type
      when :boost_provider
        boost_map[rule.target_provider_id] = rule.boost_multiplier
      when :force_provider
        force_set.add(rule.target_provider_id)
      when :exclude_provider
        exclude_set.add(rule.target_provider_id)
      end
    end

    filtered = providers.reject { |p| exclude_set.include?(p.id) }
    [filtered, boost_map, force_set]
  end

  def execute_cascade(ranked_candidates, request)
    attempts = []

    ranked_candidates.each_with_index do |candidate, idx|
      provider = candidate[:provider]
      start_time = Concurrent.monotonic_time

      begin
        response = provider.process_payout(request)
        elapsed_ms = ((Concurrent.monotonic_time - start_time) * 1000).round(1)

        if response[:success]
          # Record success in EWMA & Circuit Breaker
          provider.record_success(elapsed_ms, request[:amount])

          return Result.new(
            success: true,
            transaction_id: response[:transaction_id],
            provider: provider,
            attempts: idx + 1
          )
        else
          # Known provider business decline
          provider.record_failure(response[:error_code])
          attempts << { provider: provider.id, error: response[:error_code], elapsed_ms: elapsed_ms }
        end
      rescue StandardError => e
        # Network timeout, 5xx, or crash
        elapsed_ms = ((Concurrent.monotonic_time - start_time) * 1000).round(1)
        provider.record_exception(e)
        attempts << { provider: provider.id, error: e.message, elapsed_ms: elapsed_ms }
      end
    end

    Result.new(
      success: false,
      error: "CASCADE_EXHAUSTED: All #{ranked_candidates.size} providers failed",
      attempts: attempts.size
    )
  end
end
