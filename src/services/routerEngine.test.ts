import { describe, it, expect } from 'vitest';
import { RouterEngine, DEFAULT_WEIGHTS, DEFAULT_RULES, DEFAULT_HEALTH_CONFIG } from './routerEngine';
import { PayoutRequest, Provider, RoutingRule, ScoringWeights } from '../types';

const MOCK_PROVIDERS: Provider[] = [
  {
    id: 'p_fast_sbp',
    name: 'SBP Fast Hub',
    code: 'SBP_FAST',
    category: 'Instant Rail',
    description: 'Direct national fast payment rail with sub-second clearing',
    color: '#10B981',
    status: 'active',
    supportedCurrencies: ['RUB'],
    supportedCountries: ['RU'],
    supportedMethods: ['sbp', 'card'],
    minAmount: 100,
    maxAmount: 150000,
    dailyVolumeLimit: 500000,
    currentDailyVolume: 50000,
    feePercent: 0.4,
    feeFixed: 10,
    baseLatencyMs: 180,
    simulatedFailureRate: 0,
    badge: 'SBP Direct',
    stats: {
      totalPayouts: 100,
      successfulPayouts: 99,
      failedPayouts: 1,
      successRate: 99.0,
      avgLatencyMs: 185,
      totalFeesPaid: 2500,
      volumeProcessed: 350000,
      recentOutcomes: [],
    },
    tags: ['Instant', 'Low-Fee'],
  },
  {
    id: 'p_global_card',
    name: 'Global Card Processor',
    code: 'CARD_GLOBAL',
    category: 'Bank Cards',
    description: 'International card acquiring & payout gateway',
    color: '#6366F1',
    status: 'active',
    supportedCurrencies: ['RUB', 'USD', 'EUR'],
    supportedCountries: ['RU', 'US', 'EU', 'GLOBAL'],
    supportedMethods: ['card'],
    minAmount: 500,
    maxAmount: 500000,
    dailyVolumeLimit: 1000000,
    currentDailyVolume: 200000,
    feePercent: 1.8,
    feeFixed: 30,
    baseLatencyMs: 400,
    simulatedFailureRate: 0,
    badge: 'Tier-1 Visa/MC',
    stats: {
      totalPayouts: 200,
      successfulPayouts: 190,
      failedPayouts: 10,
      successRate: 95.0,
      avgLatencyMs: 410,
      totalFeesPaid: 15000,
      volumeProcessed: 800000,
      recentOutcomes: [],
    },
    tags: ['Card Gateway'],
  },
  {
    id: 'p_crypto_rails',
    name: 'Crypto Settlement Rail',
    code: 'CRYPTO_RAIL',
    category: 'Crypto Rails',
    description: 'Stablecoin liquidity pool for instant multi-currency settlement',
    color: '#F59E0B',
    status: 'active',
    supportedCurrencies: ['USDT', 'USD', 'EUR'],
    supportedCountries: ['GLOBAL'],
    supportedMethods: ['crypto'],
    minAmount: 50,
    maxAmount: 1000000,
    dailyVolumeLimit: 2000000,
    currentDailyVolume: 100000,
    feePercent: 0.3,
    feeFixed: 1,
    baseLatencyMs: 600,
    simulatedFailureRate: 0,
    badge: 'TRC20 / ERC20',
    stats: {
      totalPayouts: 50,
      successfulPayouts: 49,
      failedPayouts: 1,
      successRate: 98.0,
      avgLatencyMs: 620,
      totalFeesPaid: 300,
      volumeProcessed: 400000,
      recentOutcomes: [],
    },
    tags: ['USDT', 'Low-Fee'],
  },
  {
    id: 'p_disabled_gateway',
    name: 'Disabled Gateway',
    code: 'DISABLED_GW',
    category: 'Offline',
    description: 'Disabled gateway for testing',
    color: '#94A3B8',
    status: 'disabled',
    supportedCurrencies: ['RUB', 'USD'],
    supportedCountries: ['RU', 'GLOBAL'],
    supportedMethods: ['card', 'sbp'],
    minAmount: 10,
    maxAmount: 100000,
    dailyVolumeLimit: 100000,
    currentDailyVolume: 0,
    feePercent: 1.0,
    feeFixed: 5,
    baseLatencyMs: 300,
    simulatedFailureRate: 0,
    badge: 'Offline',
    stats: {
      totalPayouts: 10,
      successfulPayouts: 5,
      failedPayouts: 5,
      successRate: 50.0,
      avgLatencyMs: 300,
      totalFeesPaid: 50,
      volumeProcessed: 1000,
      recentOutcomes: [],
    },
    tags: ['Offline'],
  },
  {
    id: 'p_maintenance_gateway',
    name: 'Maintenance Gateway',
    code: 'MAINT_GW',
    category: 'Maintenance',
    description: 'Gateway undergoing scheduled maintenance',
    color: '#E11D48',
    status: 'maintenance',
    supportedCurrencies: ['RUB'],
    supportedCountries: ['RU'],
    supportedMethods: ['sbp'],
    minAmount: 10,
    maxAmount: 100000,
    dailyVolumeLimit: 100000,
    currentDailyVolume: 0,
    feePercent: 0.5,
    feeFixed: 2,
    baseLatencyMs: 250,
    simulatedFailureRate: 0,
    badge: 'Maint',
    stats: {
      totalPayouts: 20,
      successfulPayouts: 20,
      failedPayouts: 0,
      successRate: 100,
      avgLatencyMs: 250,
      totalFeesPaid: 100,
      volumeProcessed: 5000,
      recentOutcomes: [],
    },
    tags: ['Maintenance'],
  },
];

describe('RouterEngine: Step 1 - Provider Filtering & Constraint Rules', () => {
  it('should pass matching active providers for valid RUB SBP request', () => {
    const request: PayoutRequest = {
      id: 'req_1',
      amount: 5000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const results = RouterEngine.filterProviders(request, MOCK_PROVIDERS);
    const passed = results.filter((r) => r.passed);

    expect(passed.length).toBe(1);
    expect(passed[0].provider.id).toBe('p_fast_sbp');
  });

  it('should reject disabled and maintenance providers', () => {
    const request: PayoutRequest = {
      id: 'req_maint',
      amount: 1000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const results = RouterEngine.filterProviders(request, MOCK_PROVIDERS);
    const disabledRes = results.find((r) => r.provider.id === 'p_disabled_gateway');
    const maintRes = results.find((r) => r.provider.id === 'p_maintenance_gateway');

    expect(disabledRes?.passed).toBe(false);
    expect(disabledRes?.reasons).toContain('Провайдер выключен оператором');

    expect(maintRes?.passed).toBe(false);
    expect(maintRes?.reasons).toContain('Технические работы на шлюзе (Maintenance)');
  });

  it('should reject providers when currency is unsupported', () => {
    const request: PayoutRequest = {
      id: 'req_kzt',
      amount: 5000,
      currency: 'KZT',
      country: 'KZ',
      method: 'card',
      recipient: { name: 'Recipient', accountIdentifier: '4400123456789012' },
      createdAt: Date.now(),
    };

    const results = RouterEngine.filterProviders(request, MOCK_PROVIDERS);
    const passed = results.filter((r) => r.passed);
    expect(passed.length).toBe(0);
    results.forEach((r) => {
      expect(r.passed).toBe(false);
      expect(r.reasons.some((reason) => reason.includes('валюту KZT'))).toBe(true);
    });
  });

  it('should correctly support providers with GLOBAL country tag', () => {
    const request: PayoutRequest = {
      id: 'req_global',
      amount: 200,
      currency: 'USDT',
      country: 'GLOBAL',
      method: 'crypto',
      recipient: { name: 'Recipient', accountIdentifier: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' },
      createdAt: Date.now(),
    };

    const results = RouterEngine.filterProviders(request, MOCK_PROVIDERS);
    const cryptoRes = results.find((r) => r.provider.id === 'p_crypto_rails');
    expect(cryptoRes?.passed).toBe(true);
  });

  it('should reject when amount is strictly below minAmount', () => {
    const request: PayoutRequest = {
      id: 'req_too_small',
      amount: 20, // Below min 100 for sbp, below 500 for card
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const results = RouterEngine.filterProviders(request, MOCK_PROVIDERS);
    const sbpRes = results.find((r) => r.provider.id === 'p_fast_sbp');
    expect(sbpRes?.passed).toBe(false);
    expect(sbpRes?.reasons.some((r) => r.includes('< мин. лимита 100'))).toBe(true);
  });

  it('should reject when amount exceeds maxAmount', () => {
    const request: PayoutRequest = {
      id: 'req_too_big',
      amount: 900000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'Recipient', accountIdentifier: '4400123456789012' },
      createdAt: Date.now(),
    };

    const results = RouterEngine.filterProviders(request, MOCK_PROVIDERS);
    const cardRes = results.find((r) => r.provider.id === 'p_global_card');
    expect(cardRes?.passed).toBe(false);
    expect(cardRes?.reasons.some((r) => r.includes('> макс. лимита 500000'))).toBe(true);
  });

  it('should reject when daily volume headroom is exceeded', () => {
    const request: PayoutRequest = {
      id: 'req_over_daily',
      amount: 120000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    // p_fast_sbp currentDailyVolume: 50000, dailyVolumeLimit: 500000 (headroom 450,000)
    // Create provider with almost exhausted limit
    const exhaustedProvider: Provider = {
      ...MOCK_PROVIDERS[0],
      currentDailyVolume: 490000,
      dailyVolumeLimit: 500000,
    };

    const results = RouterEngine.filterProviders(request, [exhaustedProvider]);
    expect(results[0].passed).toBe(false);
    expect(results[0].reasons.some((r) => r.includes('Превышен дневной лимит'))).toBe(true);
  });

  it('should handle invalid/edge case request amounts gracefully (0, negative, NaN)', () => {
    const invalidZeroReq: PayoutRequest = {
      id: 'req_zero',
      amount: 0,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const resZero = RouterEngine.filterProviders(invalidZeroReq, MOCK_PROVIDERS);
    expect(resZero.every((r) => !r.passed)).toBe(true);

    const invalidNegReq: PayoutRequest = {
      id: 'req_neg',
      amount: -500,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const resNeg = RouterEngine.filterProviders(invalidNegReq, MOCK_PROVIDERS);
    expect(resNeg.every((r) => !r.passed)).toBe(true);

    // Empty providers list safety
    const emptyRes = RouterEngine.filterProviders(invalidZeroReq, []);
    expect(emptyRes).toEqual([]);
  });
});

describe('RouterEngine: Step 2 - Multi-Factor Scoring & Rules Engine', () => {
  it('should score passed candidates correctly with rank 1 assigned to highest score', () => {
    const request: PayoutRequest = {
      id: 'req_score',
      amount: 10000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'Recipient', accountIdentifier: '4400123456789012' },
      createdAt: Date.now(),
    };

    const passedProviders = [MOCK_PROVIDERS[0], MOCK_PROVIDERS[1]];
    const candidates = RouterEngine.scoreProviders(request, passedProviders, DEFAULT_WEIGHTS, []);

    expect(candidates.length).toBe(2);
    expect(candidates[0].rank).toBe(1);
    expect(candidates[1].rank).toBe(2);
    expect(candidates[0].totalScore).toBeGreaterThanOrEqual(candidates[1].totalScore);

    // Verify calculated fee
    // MOCK_PROVIDERS[0]: 10000 * 0.4% + 10 = 50 RUB
    const cand0 = candidates.find((c) => c.provider.id === 'p_fast_sbp');
    expect(cand0?.calculatedFee).toBe(50);
  });

  it('should apply rule boost to target provider', () => {
    const request: PayoutRequest = {
      id: 'req_boost',
      amount: 10000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const boostRule: RoutingRule = {
      id: 'boost_sbp',
      name: 'Boost SBP',
      description: 'Test rule',
      enabled: true,
      priority: 1,
      condition: { currency: 'RUB', method: 'sbp' },
      action: {
        type: 'boost_provider',
        targetProviderId: 'p_fast_sbp',
        boostMultiplier: 1.25,
      },
    };

    const noRuleScores = RouterEngine.scoreProviders(request, [MOCK_PROVIDERS[0]], DEFAULT_WEIGHTS, []);
    const boostedScores = RouterEngine.scoreProviders(request, [MOCK_PROVIDERS[0]], DEFAULT_WEIGHTS, [boostRule]);

    expect(boostedScores[0].totalScore).toBeGreaterThan(noRuleScores[0].totalScore);
  });

  it('should handle zero or corrupted weights without division by zero / NaN', () => {
    const request: PayoutRequest = {
      id: 'req_zero_weights',
      amount: 5000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'Recipient', accountIdentifier: '4400123456789012' },
      createdAt: Date.now(),
    };

    const zeroWeights: ScoringWeights = {
      feeWeight: 0,
      successRateWeight: 0,
      latencyWeight: 0,
      capacityWeight: 0,
    };

    const candidates = RouterEngine.scoreProviders(request, [MOCK_PROVIDERS[1]], zeroWeights, []);
    expect(candidates.length).toBe(1);
    expect(isNaN(candidates[0].totalScore)).toBe(false);
    expect(candidates[0].totalScore).toBeGreaterThan(0);
  });

  it('should return empty candidate list when passed providers array is empty', () => {
    const request: PayoutRequest = {
      id: 'req_empty',
      amount: 1000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const candidates = RouterEngine.scoreProviders(request, [], DEFAULT_WEIGHTS, []);
    expect(candidates).toEqual([]);
  });
});

describe('RouterEngine: Step 3 - Cascading Execution & Fallback Simulation', () => {
  it('should successfully execute payout on 1st attempt when provider is healthy', async () => {
    const request: PayoutRequest = {
      id: 'req_exec_success',
      amount: 3000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const filterResults = RouterEngine.filterProviders(request, [MOCK_PROVIDERS[0]]);
    const scored = RouterEngine.scoreProviders(request, [MOCK_PROVIDERS[0]], DEFAULT_WEIGHTS, []);

    const { transaction, updatedProviders } = await RouterEngine.executePayoutSimulation(
      request,
      filterResults,
      scored,
      MOCK_PROVIDERS,
      {}
    );

    expect(transaction.status).toBe('success');
    expect(transaction.totalAttempts).toBe(1);
    expect(transaction.finalProvider?.id).toBe('p_fast_sbp');
    expect(transaction.executionAttempts[0].status).toBe('success');
    expect(transaction.feeSaved).toBeGreaterThanOrEqual(0);

    // Check volume and stats updated
    const updatedSbp = updatedProviders.find((p) => p.id === 'p_fast_sbp');
    expect(updatedSbp?.currentDailyVolume).toBe(MOCK_PROVIDERS[0].currentDailyVolume + 3000);
    expect(updatedSbp?.stats.successfulPayouts).toBe(MOCK_PROVIDERS[0].stats.successfulPayouts + 1);
  });

  it('should automatically fallback to 2nd candidate when 1st candidate has a forced failure', async () => {
    const request: PayoutRequest = {
      id: 'req_fallback',
      amount: 5000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'Recipient', accountIdentifier: '4400123456789012' },
      createdAt: Date.now(),
    };

    // Both p_fast_sbp and p_global_card support card
    const eligible = [MOCK_PROVIDERS[0], MOCK_PROVIDERS[1]];
    const filterResults = RouterEngine.filterProviders(request, eligible);
    const scored = RouterEngine.scoreProviders(request, eligible, DEFAULT_WEIGHTS, []);

    // Force failure on the #1 ranked provider
    const topProviderId = scored[0].provider.id;
    const forcedFailures = { [topProviderId]: true };

    const { transaction } = await RouterEngine.executePayoutSimulation(
      request,
      filterResults,
      scored,
      eligible,
      forcedFailures
    );

    expect(transaction.status).toBe('fallback_success');
    expect(transaction.totalAttempts).toBe(2);
    expect(transaction.executionAttempts[0].status).toBe('failed');
    expect(transaction.executionAttempts[0].errorMessage).toContain('Принудительная симуляция сбоя');
    expect(transaction.executionAttempts[1].status).toBe('success');
    expect(transaction.finalProvider?.id).not.toBe(topProviderId);
  });

  it('should mark transaction as failed when all cascading providers fail', async () => {
    const request: PayoutRequest = {
      id: 'req_all_fail',
      amount: 5000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'Recipient', accountIdentifier: '4400123456789012' },
      createdAt: Date.now(),
    };

    const eligible = [MOCK_PROVIDERS[0], MOCK_PROVIDERS[1]];
    const filterResults = RouterEngine.filterProviders(request, eligible);
    const scored = RouterEngine.scoreProviders(request, eligible, DEFAULT_WEIGHTS, []);

    // Force failure on all
    const forcedFailures = {
      [MOCK_PROVIDERS[0].id]: true,
      [MOCK_PROVIDERS[1].id]: true,
    };

    const { transaction } = await RouterEngine.executePayoutSimulation(
      request,
      filterResults,
      scored,
      eligible,
      forcedFailures
    );

    expect(transaction.status).toBe('failed');
    expect(transaction.totalAttempts).toBe(2);
    expect(transaction.finalProvider).toBeUndefined();
    expect(transaction.executionAttempts.every((a) => a.status === 'failed')).toBe(true);
  });

  it('should cleanly handle rejection when 0 candidates pass filter', async () => {
    const request: PayoutRequest = {
      id: 'req_unsupported',
      amount: 5000,
      currency: 'GBP', // No provider supports GBP
      country: 'GB',
      method: 'card',
      recipient: { name: 'Recipient', accountIdentifier: '4400123456789012' },
      createdAt: Date.now(),
    };

    const filterResults = RouterEngine.filterProviders(request, MOCK_PROVIDERS);
    const scored = RouterEngine.scoreProviders(request, [], DEFAULT_WEIGHTS, []);

    const { transaction } = await RouterEngine.executePayoutSimulation(
      request,
      filterResults,
      scored,
      MOCK_PROVIDERS,
      {}
    );

    expect(transaction.status).toBe('failed');
    expect(transaction.totalAttempts).toBe(0);
    expect(transaction.scoredCandidates.length).toBe(0);
    expect(transaction.traceLogs.some((l) => l.message.includes('Отказ в выплате'))).toBe(true);
  });
});

describe('RouterEngine: Step 4 - Automated Periodic Health Check Probes', () => {
  it('should probe healthy active providers and record 200 OK responses', () => {
    const { updatedProviders, summary } = RouterEngine.runHealthCheckProbe(
      MOCK_PROVIDERS.slice(0, 2),
      {},
      DEFAULT_HEALTH_CONFIG
    );

    expect(summary.probedCount).toBe(2);
    expect(summary.healthyCount).toBe(2);
    expect(summary.offlineCount).toBe(0);

    const p0 = updatedProviders[0];
    expect(p0.healthCheck).toBeDefined();
    expect(p0.healthCheck?.isHealthy).toBe(true);
    expect(p0.healthCheck?.statusCode).toBe(200);
    expect(p0.healthHistory?.length).toBeGreaterThan(0);
  });

  it('should detect forced failures and mark gateway as disabled (HTTP 504)', () => {
    const targetId = MOCK_PROVIDERS[0].id;
    const { updatedProviders, summary } = RouterEngine.runHealthCheckProbe(
      [MOCK_PROVIDERS[0]],
      { [targetId]: true },
      DEFAULT_HEALTH_CONFIG
    );

    expect(summary.offlineCount).toBe(1);
    const p0 = updatedProviders[0];
    expect(p0.status).toBe('disabled');
    expect(p0.healthCheck?.isHealthy).toBe(false);
    expect(p0.healthCheck?.statusCode).toBe(504);
    expect(p0.healthCheck?.packetLossRate).toBe(100);
  });

  it('should preserve maintenance status during health probe', () => {
    const maintProvider = MOCK_PROVIDERS.find((p) => p.status === 'maintenance')!;
    const { updatedProviders } = RouterEngine.runHealthCheckProbe(
      [maintProvider],
      {},
      DEFAULT_HEALTH_CONFIG
    );

    expect(updatedProviders[0].status).toBe('maintenance');
    expect(updatedProviders[0].healthCheck?.message).toContain('Maintenance');
  });

  it('should override weights when rule has set_weight_preset action', () => {
    const request: PayoutRequest = {
      id: 'req_preset',
      amount: 5000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'Recipient', accountIdentifier: '4400123456789012' },
      createdAt: Date.now(),
    };

    const customWeightRule: RoutingRule = {
      id: 'rule_speed_focus',
      name: 'Speed Focus',
      description: 'Focus heavily on latency',
      enabled: true,
      priority: 1,
      condition: { currency: 'RUB', method: 'card' },
      action: {
        type: 'set_weight_preset',
        customWeights: {
          feeWeight: 5,
          successRateWeight: 10,
          latencyWeight: 80,
          capacityWeight: 5,
        },
      },
    };

    const candidates = RouterEngine.scoreProviders(
      request,
      [MOCK_PROVIDERS[0], MOCK_PROVIDERS[1]],
      DEFAULT_WEIGHTS,
      [customWeightRule]
    );

    expect(candidates.length).toBe(2);
    // Faster provider (180ms vs 400ms) gets higher rank under speed-focus preset
    expect(candidates[0].provider.id).toBe('p_fast_sbp');
  });

  it('should detect degraded status when latency crosses degraded threshold', () => {
    const degradedConfig = {
      enabled: true,
      intervalSeconds: 5,
      latencyThresholdDegraded: 100, // Artificially low threshold to guarantee degraded
      latencyThresholdOffline: 900,
    };

    const { updatedProviders, summary } = RouterEngine.runHealthCheckProbe(
      [MOCK_PROVIDERS[0]], // baseLatency 180ms > 100ms
      {},
      degradedConfig
    );

    expect(summary.degradedCount).toBe(1);
    expect(updatedProviders[0].status).toBe('degraded');
    expect(updatedProviders[0].healthCheck?.statusCode).toBe(429);
  });

  it('should handle completely empty provider pools in cascading execution without crashing', async () => {
    const request: PayoutRequest = {
      id: 'req_empty_pool',
      amount: 100,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: '+79991234567' },
      createdAt: Date.now(),
    };

    const { transaction } = await RouterEngine.executePayoutSimulation(
      request,
      [],
      [],
      [],
      {}
    );

    expect(transaction.status).toBe('failed');
    expect(transaction.selectedInitialProvider).toBeDefined();
    expect(transaction.selectedInitialProvider.id).toBe('prov_none');
  });

  it('should handle null or invalid provider input to filterProviders safely', () => {
    const req: PayoutRequest = {
      id: 'req_null_test',
      amount: 100,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Recipient', accountIdentifier: 'dest' },
      createdAt: Date.now(),
    };

    expect(RouterEngine.filterProviders(req, null as any)).toEqual([]);
    expect(RouterEngine.filterProviders(req, undefined as any)).toEqual([]);
  });

  it('should trigger latency spike branch when provider has high simulatedFailureRate', () => {
    const flakyProvider: Provider = {
      ...MOCK_PROVIDERS[0],
      id: 'flaky_prov',
      baseLatencyMs: 150,
      simulatedFailureRate: 1.0, // Guarantees spike branch
    };

    const { updatedProviders } = RouterEngine.runHealthCheckProbe(
      [flakyProvider],
      {},
      DEFAULT_HEALTH_CONFIG
    );

    expect(updatedProviders[0].healthCheck).toBeDefined();
  });
});

describe('RouterEngine: Step 5 - Circuit Breakers, Network Chaos & Flapping Guard', () => {
  it('should trip circuit breaker to OPEN when provider experiences 3 consecutive outages', () => {
    const flappingProvider: Provider = {
      ...MOCK_PROVIDERS[0],
      healthHistory: [
        { timestamp: Date.now() - 30000, latencyMs: 200, isHealthy: true, status: 'active' },
        { timestamp: Date.now() - 20000, latencyMs: 950, isHealthy: false, status: 'disabled' },
        { timestamp: Date.now() - 10000, latencyMs: 1200, isHealthy: false, status: 'disabled' },
        { timestamp: Date.now(), latencyMs: 1500, isHealthy: false, status: 'disabled' },
      ],
    };

    const cb = RouterEngine.evaluateCircuitBreaker(flappingProvider, 3);
    expect(cb.state).toBe('OPEN');
    expect(cb.consecutiveFailures).toBe(3);
    expect(cb.reason).toContain('Circuit Breaker сработал (OPEN)');
  });

  it('should enter HALF_OPEN probationary mode on first successful probe after downtime', () => {
    const recoveringProvider: Provider = {
      ...MOCK_PROVIDERS[0],
      healthHistory: [
        { timestamp: Date.now() - 20000, latencyMs: 1000, isHealthy: false, status: 'disabled' },
        { timestamp: Date.now() - 10000, latencyMs: 1200, isHealthy: false, status: 'disabled' },
        { timestamp: Date.now(), latencyMs: 180, isHealthy: true, status: 'active' },
      ],
    };

    const cb = RouterEngine.evaluateCircuitBreaker(recoveringProvider, 3);
    expect(cb.state).toBe('HALF_OPEN');
    expect(cb.consecutiveFailures).toBe(0);
    expect(cb.reason).toContain('HALF_OPEN');
  });

  it('should return CLOSED for healthy provider with clean history', () => {
    const cb = RouterEngine.evaluateCircuitBreaker(MOCK_PROVIDERS[0], 3);
    expect(cb.state).toBe('CLOSED');
    expect(cb.consecutiveFailures).toBe(0);
  });

  it('should heavily penalize bimodal jitter when p99 latency spikes over 3x the average', () => {
    const steadyScore = RouterEngine.calculateBimodalPenaltyScore(MOCK_PROVIDERS[0], 210, 180); // ratio 1.16
    const jitteryScore = RouterEngine.calculateBimodalPenaltyScore(MOCK_PROVIDERS[0], 3500, 60); // ratio 58.3

    expect(steadyScore).toBe(100);
    expect(jitteryScore).toBeLessThanOrEqual(50);
  });
});

describe('RouterEngine: Step 6 - AML, Risk Scoring & Velocity Spikes', () => {
  it('should detect velocity flood when 4 rapid payouts target the same recipient card in 60 seconds', () => {
    const now = Date.now();
    const pastRequests: PayoutRequest[] = [
      { id: 'v1', amount: 5000, currency: 'RUB', country: 'RU', method: 'card', recipient: { name: 'Holder', accountIdentifier: '2200123456789012' }, createdAt: now - 45000 },
      { id: 'v2', amount: 5000, currency: 'RUB', country: 'RU', method: 'card', recipient: { name: 'Holder', accountIdentifier: '2200123456789012' }, createdAt: now - 30000 },
      { id: 'v3', amount: 5000, currency: 'RUB', country: 'RU', method: 'card', recipient: { name: 'Holder', accountIdentifier: '2200123456789012' }, createdAt: now - 15000 },
    ];

    const currentReq: PayoutRequest = {
      id: 'v4',
      amount: 5000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'Holder', accountIdentifier: '2200123456789012' },
      createdAt: now,
    };

    const risk = RouterEngine.assessTransactionRisk(currentReq, pastRequests);
    expect(risk.riskScore).toBeGreaterThanOrEqual(45);
    expect(risk.triggeredRules.some((r) => r.includes('VELOCITY_SPIKE_DETECTED'))).toBe(true);
    expect(risk.riskLevel).toBe('HIGH');
    expect(risk.action).toBe('STEP_UP_ROUTING');
  });

  it('should trigger high-value compliance threshold (>600k RUB / 10k USD) and require KYC', () => {
    const req: PayoutRequest = {
      id: 'aml_large',
      amount: 750000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Corporate Account', accountIdentifier: '+79990001122' },
      createdAt: Date.now(),
    };

    const risk = RouterEngine.assessTransactionRisk(req);
    expect(risk.requiresEnhancedKYC).toBe(true);
    expect(risk.triggeredRules.some((r) => r.includes('LARGE_VALUE_COMPLIANCE_THRESHOLD'))).toBe(true);
  });

  it('should identify MIR card BIN prefixes (2200-2204) and mark as domestic RU', () => {
    const req: PayoutRequest = {
      id: 'mir_check',
      amount: 15000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'Mir User', accountIdentifier: '2200 4567 8901 2345' },
      createdAt: Date.now(),
    };

    const risk = RouterEngine.assessTransactionRisk(req);
    expect(risk.detectedBinInfo).toBeDefined();
    expect(risk.detectedBinInfo?.brand).toBe('MIR');
    expect(risk.detectedBinInfo?.isDomesticRu).toBe(true);
    expect(risk.detectedBinInfo?.bin).toBe('220045');
  });

  it('should flag micro-transaction dust attack when amount is 0.05 USDT', () => {
    const req: PayoutRequest = {
      id: 'dust_check',
      amount: 0.05,
      currency: 'USDT',
      country: 'GLOBAL',
      method: 'crypto',
      recipient: { name: 'Dust Wallet', accountIdentifier: '0x123' },
      createdAt: Date.now(),
    };

    const risk = RouterEngine.assessTransactionRisk(req);
    expect(risk.triggeredRules.some((r) => r.includes('MICRO_TRANSACTION_DUST_SUSPECTED'))).toBe(true);
  });
});

describe('RouterEngine: Step 7 - Multi-Currency Precision & Tiered Volume Rebates', () => {
  it('should perform epsilon-safe crypto fee calculations without floating point drift', () => {
    const res = RouterEngine.calculatePreciseCryptoFee(0.00005000, 1.5, 0.00000100, 8);
    expect(res.calculatedFee).toBe(0.00000175);
    expect(res.netAmount).toBe(0.00004825);
    expect(res.effectiveRate).toBe(3.5);
  });

  it('should calculate tiered volume discounts based on provider cumulative volume', () => {
    const highVolumeProvider: Provider = {
      ...MOCK_PROVIDERS[0],
      feePercent: 2.0,
      feeFixed: 0.5,
      stats: {
        ...MOCK_PROVIDERS[0].stats,
        volumeProcessed: 250000,
      },
    };

    const res = RouterEngine.calculateTieredFee(highVolumeProvider, 10000);
    expect(res.appliedBracket.feePercent).toBe(1.6);
    expect(res.appliedBracket.upToVolume).toBe(500000);
    expect(res.calculatedFee).toBe((10000 * 0.016) + (0.5 * 0.8));
  });
});

describe('RouterEngine: Step 8 - Atomic Concurrency & Headroom Race Prevention', () => {
  it('should process concurrent batch and strictly enforce daily volume headroom without overdraft', () => {
    const provA: Provider = {
      ...MOCK_PROVIDERS[0],
      id: 'prov_limited',
      dailyVolumeLimit: 80000,
      currentDailyVolume: 0,
    };
    const provB: Provider = {
      ...MOCK_PROVIDERS[1],
      id: 'prov_backup',
      dailyVolumeLimit: 500000,
      currentDailyVolume: 0,
    };

    const batchReqs: PayoutRequest[] = Array.from({ length: 6 }).map((_, idx) => ({
      id: `race_${idx}`,
      amount: 30000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: `User ${idx}`, accountIdentifier: `4400${idx}` },
      createdAt: Date.now(),
    }));

    const { transactions, updatedProviders } = RouterEngine.simulateAtomicConcurrentBatch(
      batchReqs,
      [provA, provB]
    );

    const finalProvA = updatedProviders.find((p) => p.id === 'prov_limited');
    expect(finalProvA?.currentDailyVolume).toBe(60000); // 2 * 30000, 3rd exceeded 80k limit
    expect(transactions.length).toBe(6);
    expect(transactions.every((t) => t.status === 'success' || t.status === 'fallback_success')).toBe(true);
  });
});

describe('RouterEngine: Step 9 - Rule Matrix Conflict Resolution & Payload Sanitization', () => {
  it('should resolve conflicting rules deterministically based on priority integer', () => {
    const conflictingRules: RoutingRule[] = [
      {
        id: 'rule_high',
        name: 'High Priority Boost',
        description: 'Boost provider',
        enabled: true,
        priority: 1,
        condition: { currency: 'RUB' },
        action: { type: 'boost_provider', targetProviderId: 'p_fast_sbp', boostMultiplier: 1.2 },
      },
      {
        id: 'rule_low',
        name: 'Low Priority Exclude',
        description: 'Try to exclude same provider',
        enabled: true,
        priority: 5,
        condition: { currency: 'RUB' },
        action: { type: 'exclude_provider', targetProviderId: 'p_fast_sbp' },
      },
    ];

    const req: PayoutRequest = {
      id: 'test_conflict',
      amount: 5000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'User', accountIdentifier: '+79991234' },
      createdAt: Date.now(),
    };

    const { activeRules, overriddenRules } = RouterEngine.resolveConflictingRules(conflictingRules, req);
    expect(activeRules.length).toBe(1);
    expect(activeRules[0].id).toBe('rule_high');
    expect(overriddenRules.length).toBe(1);
    expect(overriddenRules[0].rule.id).toBe('rule_low');
    expect(overriddenRules[0].reason).toContain('Переопределено');
  });

  it('should safely handle and sanitize SQLi and XSS injection payloads in recipient identifier', async () => {
    const maliciousReq: PayoutRequest = {
      id: 'req_sqli',
      amount: 1000,
      currency: 'RUB',
      country: 'RU',
      method: 'card',
      recipient: { name: 'DROP TABLE users;--', accountIdentifier: "<script>alert('pwned')</script>4400" },
      createdAt: Date.now(),
    };

    const filter = RouterEngine.filterProviders(maliciousReq, MOCK_PROVIDERS);
    const scored = RouterEngine.scoreProviders(
      maliciousReq,
      filter.filter((r) => r.passed).map((r) => r.provider),
      DEFAULT_WEIGHTS,
      DEFAULT_RULES
    );

    const { transaction } = await RouterEngine.executePayoutSimulation(
      maliciousReq,
      filter,
      scored,
      MOCK_PROVIDERS,
      {}
    );

    expect(transaction.id).toBeDefined();
    expect(transaction.status).toBe('success');
  });
});



