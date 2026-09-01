import {
  PayoutRequest,
  Provider,
  ProviderFilterResult,
  CandidateScore,
  ScoringWeights,
  RoutingRule,
  PayoutTransaction,
  ExecutionAttempt,
  HealthCheckConfig,
  HealthCheckResult,
  HealthCheckHistoryPoint,
  ProviderStatus,
  CircuitBreakerStatus,
  RiskAssessmentResult,
  TieredVolumeBracket,
} from '../types';

export const DEFAULT_WEIGHTS: ScoringWeights = {
  feeWeight: 35,
  successRateWeight: 35,
  latencyWeight: 15,
  capacityWeight: 15,
};

export const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  enabled: true,
  intervalSeconds: 5,
  latencyThresholdDegraded: 450,
  latencyThresholdOffline: 850,
};

export const DEFAULT_RULES: RoutingRule[] = [
  {
    id: 'rule_instant_sbp',
    name: 'Приоритет СБП для выплат в рублях (RU)',
    description: 'Автоматически повышает скоринг СБП для мгновенных переводов по РФ',
    enabled: true,
    priority: 1,
    condition: {
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
    },
    action: {
      type: 'boost_provider',
      targetProviderId: 'prov_sbp_hub',
      boostMultiplier: 1.15,
    },
  },
  {
    id: 'rule_crypto_high_value',
    name: 'USDT для трансграничных и крипто выплат',
    description: 'Для криптовалютных методов использует низкие комиссии USDT rails',
    enabled: true,
    priority: 2,
    condition: {
      method: 'crypto',
    },
    action: {
      type: 'boost_provider',
      targetProviderId: 'prov_cryptopay',
      boostMultiplier: 1.2,
    },
  },
  {
    id: 'rule_eur_sepa_instant',
    name: 'SEPA Instant для платежей в Еврозоне',
    description: 'Оптимизация межбанковских платежей в EUR',
    enabled: true,
    priority: 3,
    condition: {
      currency: 'EUR',
      country: 'EU',
      method: 'bank_transfer',
    },
    action: {
      type: 'boost_provider',
      targetProviderId: 'prov_sepa_direct',
      boostMultiplier: 1.25,
    },
  },
];

export class RouterEngine {
  // Step 1: Filter providers based on hard constraints
  static filterProviders(
    request: PayoutRequest,
    providers: Provider[]
  ): ProviderFilterResult[] {
    if (!providers || !Array.isArray(providers)) {
      return [];
    }

    return providers.map((provider) => {
      const reasons: string[] = [];

      // Check request validity
      if (!request || typeof request.amount !== 'number' || request.amount <= 0 || isNaN(request.amount)) {
        reasons.push(`Некорректная сумма выплаты: ${request?.amount} (должна быть строго положительной)`);
      }

      // Check operational status
      if (provider.status === 'disabled') {
        reasons.push('Провайдер выключен оператором');
      } else if (provider.status === 'maintenance') {
        reasons.push('Технические работы на шлюзе (Maintenance)');
      }

      // Check currency
      if (!provider.supportedCurrencies?.includes(request?.currency)) {
        reasons.push(`Не поддерживает валюту ${request?.currency || 'UNKNOWN'}`);
      }

      // Check country
      const supportsCountry =
        provider.supportedCountries?.includes(request?.country) ||
        provider.supportedCountries?.includes('GLOBAL');
      if (!supportsCountry) {
        reasons.push(`Не поддерживает страну ${request?.country || 'UNKNOWN'}`);
      }

      // Check payment method
      if (!provider.supportedMethods?.includes(request?.method)) {
        reasons.push(`Не поддерживает метод выплаты: ${(request?.method || '').toUpperCase()}`);
      }

      // Check amount limits
      if (typeof request?.amount === 'number') {
        if (request.amount < provider.minAmount) {
          reasons.push(`Сумма ${request.amount} < мин. лимита ${provider.minAmount} ${request.currency}`);
        }
        if (request.amount > provider.maxAmount) {
          reasons.push(`Сумма ${request.amount} > макс. лимита ${provider.maxAmount} ${request.currency}`);
        }

        // Check daily volume headroom
        const dailyLimit = provider.dailyVolumeLimit || 0;
        if (provider.currentDailyVolume + request.amount > dailyLimit) {
          reasons.push(`Превышен дневной лимит шлюза (${provider.currentDailyVolume.toLocaleString()} / ${dailyLimit.toLocaleString()})`);
        }
      }

      return {
        provider,
        passed: reasons.length === 0,
        reasons,
      };
    });
  }

  // Step 2: Calculate scoring for passed candidates
  static scoreProviders(
    request: PayoutRequest,
    passedProviders: Provider[],
    weights: ScoringWeights = DEFAULT_WEIGHTS,
    rules: RoutingRule[] = []
  ): CandidateScore[] {
    if (!passedProviders || passedProviders.length === 0) {
      return [];
    }

    // Check if any rule overrides weights or boosts providers
    let activeWeights = { ...weights };
    const boostMap: Record<string, number> = {};
    const forceSet = new Set<string>();
    const excludeSet = new Set<string>();

    (rules || [])
      .filter((r) => r && r.enabled)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      .forEach((rule) => {
        const matchesCurrency = !rule.condition?.currency || rule.condition.currency === request?.currency;
        const matchesCountry = !rule.condition?.country || rule.condition.country === request?.country;
        const matchesMethod = !rule.condition?.method || rule.condition.method === request?.method;
        const matchesMin = typeof rule.condition?.minAmount !== 'number' || (request?.amount || 0) >= rule.condition.minAmount;
        const matchesMax = typeof rule.condition?.maxAmount !== 'number' || (request?.amount || 0) <= rule.condition.maxAmount;

        if (matchesCurrency && matchesCountry && matchesMethod && matchesMin && matchesMax) {
          if (rule.action.type === 'boost_provider' && rule.action.targetProviderId && rule.action.boostMultiplier) {
            boostMap[rule.action.targetProviderId] = rule.action.boostMultiplier;
          } else if (rule.action.type === 'force_provider' && rule.action.targetProviderId) {
            forceSet.add(rule.action.targetProviderId);
          } else if (rule.action.type === 'exclude_provider' && rule.action.targetProviderId) {
            excludeSet.add(rule.action.targetProviderId);
          } else if (rule.action.type === 'set_weight_preset' && rule.action.customWeights) {
            activeWeights = { ...rule.action.customWeights };
          }
        }
      });

    const weightSum =
      (activeWeights.feeWeight || 0) +
      (activeWeights.successRateWeight || 0) +
      (activeWeights.latencyWeight || 0) +
      (activeWeights.capacityWeight || 0);

    const safeWeights: ScoringWeights =
      weightSum > 0
        ? activeWeights
        : { feeWeight: 25, successRateWeight: 25, latencyWeight: 25, capacityWeight: 25 };

    const totalWeightDenom =
      (safeWeights.feeWeight +
        safeWeights.successRateWeight +
        safeWeights.latencyWeight +
        safeWeights.capacityWeight) || 100;

    const safeAmount = Math.max(0.0001, request?.amount || 0.0001);

    // Filter out excluded providers by business rules
    const nonExcludedProviders = passedProviders.filter((p) => !excludeSet.has(p.id));

    const candidates: CandidateScore[] = nonExcludedProviders.map((provider) => {
      // 1. Fee score
      const calculatedFee = Math.max(0, (safeAmount * ((provider.feePercent || 0) / 100)) + (provider.feeFixed || 0));
      const effectiveFeePercent = (calculatedFee / safeAmount) * 100;
      // Formula: lowest fee gives highest score (0-100)
      const feeScore = Math.max(5, Math.min(100, 100 - (effectiveFeePercent * 20)));

      // 2. Success rate score (direct percentage 0-100)
      const successScore = Math.max(0, Math.min(100, provider.stats?.successRate ?? 0));

      // 3. Latency score (SLA)
      const effectiveLatency = Math.max(1, provider.stats?.avgLatencyMs || provider.baseLatencyMs || 200);
      const latencyScore = Math.max(10, Math.min(100, 100 - ((effectiveLatency - 150) / 10)));

      // 4. Capacity score (daily limit headroom)
      const safeLimit = Math.max(1, provider.dailyVolumeLimit || 1);
      const usedRatio = Math.max(0, (provider.currentDailyVolume + (request?.amount || 0)) / safeLimit);
      const capacityScore = Math.max(5, Math.min(100, (1 - usedRatio) * 100));

      // Total weighted base score
      let totalScore =
        (feeScore * safeWeights.feeWeight +
          successScore * safeWeights.successRateWeight +
          latencyScore * safeWeights.latencyWeight +
          capacityScore * safeWeights.capacityWeight) /
        totalWeightDenom;

      // Apply rule boost if any
      if (boostMap[provider.id]) {
        totalScore = Math.min(100, totalScore * boostMap[provider.id]);
      }

      // If forced by rule, give top score boost (rank 1 priority)
      if (forceSet.has(provider.id)) {
        totalScore = 500 + totalScore;
      }

      totalScore = isNaN(totalScore) ? 50 : totalScore;

      return {
        provider,
        totalScore: Math.round(totalScore * 100) / 100,
        feeScore: Math.round((isNaN(feeScore) ? 50 : feeScore) * 10) / 10,
        successScore: Math.round((isNaN(successScore) ? 50 : successScore) * 10) / 10,
        latencyScore: Math.round((isNaN(latencyScore) ? 50 : latencyScore) * 10) / 10,
        capacityScore: Math.round((isNaN(capacityScore) ? 50 : capacityScore) * 10) / 10,
        calculatedFee: Math.round(calculatedFee * 100) / 100,
        effectiveFeePercent: Math.round(effectiveFeePercent * 100) / 100,
        estimatedLatencyMs: effectiveLatency,
        rank: 0,
      };
    });

    // Sort descending by score
    candidates.sort((a, b) => b.totalScore - a.totalScore);
    candidates.forEach((cand, idx) => {
      cand.rank = idx + 1;
    });

    return candidates;
  }

  // Step 3: Simulate payout execution with automatic fallback
  static async executePayoutSimulation(
    request: PayoutRequest,
    filterResults: ProviderFilterResult[],
    scoredCandidates: CandidateScore[],
    providerPool: Provider[],
    forcedFailures: Record<string, boolean> = {}
  ): Promise<{
    transaction: PayoutTransaction;
    updatedProviders: Provider[];
  }> {
    const traceLogs: PayoutTransaction['traceLogs'] = [];
    const attempts: ExecutionAttempt[] = [];
    let updatedProviders = [...providerPool];

    // Evaluate AML Risk & Anti-fraud score
    const riskAssessment = RouterEngine.assessTransactionRisk(request);

    traceLogs.push({
      stage: 'VALIDATION',
      message: `Валидация запроса & AML: ${request.amount} ${request.currency}, ${request.country}, метод ${request.method.toUpperCase()} (Risk Score: ${riskAssessment.riskScore}, Level: ${riskAssessment.riskLevel}${riskAssessment.requiresEnhancedKYC ? ' [115-ФЗ Крупная сумма]' : ''}${riskAssessment.detectedBinInfo?.isDomesticRu ? ' [МИР Domestic]' : ''})`,
      timestamp: Date.now(),
      details: { request, riskAssessment },
    });

    const passedCount = filterResults.filter((r) => r.passed).length;
    traceLogs.push({
      stage: 'FILTERING',
      message: `Фильтрация: ${passedCount} из ${filterResults.length} провайдеров допущены к скорингу`,
      timestamp: Date.now(),
      details: filterResults.filter((r) => !r.passed).map((r) => ({ name: r.provider.name, reasons: r.reasons })),
    });

    if (scoredCandidates.length === 0) {
      traceLogs.push({
        stage: 'EXECUTION',
        message: 'Отказ в выплате: нет подходящих активных провайдеров',
        timestamp: Date.now(),
      });

      const fallbackProvider: Provider = filterResults[0]?.provider || providerPool[0] || {
        id: 'prov_none',
        name: 'Нет доступного шлюза',
        code: 'NO_PROVIDER',
        category: 'Fallback',
        description: 'Резервный обработчик при отсутствии подходящих шлюзов',
        color: '#64748B',
        status: 'disabled',
        supportedCurrencies: [],
        supportedCountries: [],
        supportedMethods: [],
        minAmount: 0,
        maxAmount: 0,
        dailyVolumeLimit: 0,
        currentDailyVolume: 0,
        feePercent: 0,
        feeFixed: 0,
        baseLatencyMs: 0,
        simulatedFailureRate: 1,
        badge: 'None',
        stats: {
          totalPayouts: 0,
          successfulPayouts: 0,
          failedPayouts: 0,
          successRate: 0,
          avgLatencyMs: 0,
          totalFeesPaid: 0,
          volumeProcessed: 0,
          recentOutcomes: [],
        },
        tags: [],
      };

      const tx: PayoutTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        request,
        status: 'failed',
        filterResults,
        scoredCandidates: [],
        selectedInitialProvider: fallbackProvider,
        executionAttempts: [],
        totalAttempts: 0,
        totalLatencyMs: 0,
        totalFeeCharged: 0,
        naiveDefaultFee: 0,
        feeSaved: 0,
        riskAssessment,
        traceLogs,
        createdAt: request?.createdAt || Date.now(),
        completedAt: Date.now(),
      };

      return { transaction: tx, updatedProviders };
    }

    traceLogs.push({
      stage: 'SCORING',
      message: `Скоринг завершен. Рекомендованный лидер: ${scoredCandidates[0].provider.name} (Score: ${scoredCandidates[0].totalScore})`,
      timestamp: Date.now(),
      details: scoredCandidates.map((c) => ({
        name: c.provider.name,
        score: c.totalScore,
        fee: c.calculatedFee,
        latency: c.estimatedLatencyMs,
      })),
    });

    let isSuccess = false;
    let finalProvider: Provider | undefined;
    let totalLatencyMs = 0;
    let totalFeeCharged = 0;

    // Default naive fee (e.g. if we had just used a generic expensive card processor without smart routing)
    const naiveDefaultFee = Math.round(((request.amount * 0.029) + 0.8) * 100) / 100;

    // Cascading execution attempt
    for (let i = 0; i < scoredCandidates.length; i++) {
      const candidate = scoredCandidates[i];
      const provider = candidate.provider;
      const attemptNumber = i + 1;

      // Simulated network/bank latency
      const simulatedLatency = Math.round(
        provider.baseLatencyMs + (Math.random() * 80 - 40)
      );
      totalLatencyMs += simulatedLatency;

      traceLogs.push({
        stage: i === 0 ? 'EXECUTION' : 'FALLBACK',
        message: `Попытка #${attemptNumber} через [${provider.name}] (${provider.code})...`,
        timestamp: Date.now(),
      });

      // Check if this provider fails (either manually forced or via simulated error probability)
      const isForcedFail = !!forcedFailures[provider.id];
      const isRandomFail = Math.random() < provider.simulatedFailureRate;
      const willFail = isForcedFail || isRandomFail;

      if (!willFail) {
        // Success!
        const feeCharged = candidate.calculatedFee;
        totalFeeCharged = feeCharged;
        isSuccess = true;
        finalProvider = provider;

        attempts.push({
          attemptNumber,
          providerId: provider.id,
          providerName: provider.name,
          providerCode: provider.code,
          status: 'success',
          latencyMs: simulatedLatency,
          feeCharged,
          timestamp: Date.now(),
        });

        traceLogs.push({
          stage: 'EXECUTION',
          message: `Успех! Выплата подтверждена шлюзом ${provider.name} за ${simulatedLatency}ms (Комиссия: ${feeCharged} ${request.currency})`,
          timestamp: Date.now(),
        });

        // Adaptive learning for this winning provider
        updatedProviders = updatedProviders.map((p) => {
          if (p.id === provider.id) {
            const prev = p.stats;
            const newTotal = prev.totalPayouts + 1;
            const newSuccess = prev.successfulPayouts + 1;
            const newSuccessRate = Math.round((newSuccess / newTotal) * 10000) / 100;
            const newAvgLatency = Math.round(prev.avgLatencyMs * 0.8 + simulatedLatency * 0.2);

            return {
              ...p,
              currentDailyVolume: p.currentDailyVolume + request.amount,
              stats: {
                ...prev,
                totalPayouts: newTotal,
                successfulPayouts: newSuccess,
                successRate: newSuccessRate,
                avgLatencyMs: newAvgLatency,
                totalFeesPaid: Math.round((prev.totalFeesPaid + feeCharged) * 100) / 100,
                volumeProcessed: prev.volumeProcessed + request.amount,
                recentOutcomes: [
                  { success: true, latencyMs: simulatedLatency, timestamp: Date.now() },
                  ...prev.recentOutcomes.slice(0, 9),
                ],
              },
            };
          }
          return p;
        });

        break;
      } else {
        // Failure or timeout
        const errorReasons = [
          '504 Gateway Timeout: Нет ответа от клиринга банка',
          '422 Declining Bank: Лимит авторизации эмитента исчерпан',
          '429 Too Many Requests: Временное замедление шлюза',
          '502 Bad Gateway: Ошибка внешнего протокола провайдера',
        ];
        const errorMsg = isForcedFail
          ? 'Принудительная симуляция сбоя шлюза'
          : errorReasons[Math.floor(Math.random() * errorReasons.length)];

        attempts.push({
          attemptNumber,
          providerId: provider.id,
          providerName: provider.name,
          providerCode: provider.code,
          status: 'failed',
          latencyMs: simulatedLatency,
          errorMessage: errorMsg,
          errorCode: 'PROV_ERR_' + Math.floor(100 + Math.random() * 900),
          timestamp: Date.now(),
        });

        traceLogs.push({
          stage: 'FALLBACK',
          message: `Сбой у [${provider.name}]: ${errorMsg}. Запуск автоматического fallback к следующему кандидату...`,
          timestamp: Date.now(),
        });

        // Adaptive learning on failure
        updatedProviders = updatedProviders.map((p) => {
          if (p.id === provider.id) {
            const prev = p.stats;
            const newTotal = prev.totalPayouts + 1;
            const newSuccessRate = Math.round((prev.successfulPayouts / newTotal) * 10000) / 100;
            const newAvgLatency = Math.round(prev.avgLatencyMs * 0.85 + simulatedLatency * 0.15);

            return {
              ...p,
              stats: {
                ...prev,
                totalPayouts: newTotal,
                failedPayouts: prev.failedPayouts + 1,
                successRate: newSuccessRate,
                avgLatencyMs: newAvgLatency,
                recentOutcomes: [
                  { success: false, latencyMs: simulatedLatency, timestamp: Date.now() },
                  ...prev.recentOutcomes.slice(0, 9),
                ],
              },
            };
          }
          return p;
        });
      }
    }

    const finalStatus: PayoutTransaction['status'] = isSuccess
      ? attempts.length > 1
        ? 'fallback_success'
        : 'success'
      : 'failed';

    const feeSaved = isSuccess ? Math.max(0, Math.round((naiveDefaultFee - totalFeeCharged) * 100) / 100) : 0;

    traceLogs.push({
      stage: 'LEARNING',
      message: `Адаптивное обучение: метрики провайдеров обновлены в реальном времени. Экономия на маршрутизации: ${feeSaved} ${request.currency}`,
      timestamp: Date.now(),
    });

    const tx: PayoutTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      request,
      status: finalStatus,
      filterResults,
      scoredCandidates,
      selectedInitialProvider: scoredCandidates[0].provider,
      executionAttempts: attempts,
      finalProvider,
      totalAttempts: attempts.length,
      totalLatencyMs,
      totalFeeCharged,
      naiveDefaultFee,
      feeSaved,
      riskAssessment,
      traceLogs,
      createdAt: request.createdAt,
      completedAt: Date.now(),
    };

    return {
      transaction: tx,
      updatedProviders,
    };
  }

  // Step 4: Automated Periodic Health-Check Probe Task
  static runHealthCheckProbe(
    providers: Provider[],
    forcedFailures: Record<string, boolean> = {},
    config: HealthCheckConfig = DEFAULT_HEALTH_CONFIG
  ): {
    updatedProviders: Provider[];
    summary: {
      timestamp: number;
      healthyCount: number;
      degradedCount: number;
      offlineCount: number;
      avgLatencyMs: number;
      probedCount: number;
    };
  } {
    const timestamp = Date.now();
    let totalLatency = 0;
    let healthyCount = 0;
    let degradedCount = 0;
    let offlineCount = 0;

    const updatedProviders = providers.map((provider) => {
      const isForcedFail = !!forcedFailures[provider.id];
      const isRandomSpike = Math.random() < (provider.simulatedFailureRate * 1.5);

      // Realistic jitter around base latency
      const jitter = (Math.random() - 0.5) * 50;
      let probeLatency = Math.max(30, Math.round(provider.baseLatencyMs + jitter));

      if (isForcedFail) {
        probeLatency = Math.round(920 + Math.random() * 280); // 920-1200ms timeout
      } else if (isRandomSpike) {
        probeLatency = Math.round(config.latencyThresholdDegraded + 80 + Math.random() * 320); // Spikes above degraded threshold
      }

      totalLatency += probeLatency;

      // Determine operational status based on latency thresholds & forced failures
      let computedStatus: ProviderStatus = 'active';
      let isHealthy = true;
      let statusCode = 200;
      let message = `HTTP 200 OK • Отклик ${probeLatency}ms (SLA в норме)`;

      if (isForcedFail || probeLatency >= config.latencyThresholdOffline) {
        computedStatus = 'disabled';
        isHealthy = false;
        statusCode = 504;
        offlineCount++;
        message = isForcedFail
          ? `504 Gateway Timeout: Имитация аппаратного сбоя (${probeLatency}ms)`
          : `504 Gateway Timeout: Задержка ${probeLatency}ms > ${config.latencyThresholdOffline}ms (Критический сбой)`;
      } else if (probeLatency >= config.latencyThresholdDegraded) {
        computedStatus = 'degraded';
        isHealthy = false;
        statusCode = 429;
        degradedCount++;
        message = `429 High Latency: Задержка ${probeLatency}ms > ${config.latencyThresholdDegraded}ms (Деградация SLA)`;
      } else {
        healthyCount++;
      }

      // If provider was explicitly in maintenance, preserve maintenance status
      let finalStatus: ProviderStatus = computedStatus;
      if (provider.status === 'maintenance') {
        finalStatus = 'maintenance';
        message = `Maintenance: Запланированные тех. работы (${probeLatency}ms)`;
      }

      const healthCheck: HealthCheckResult = {
        isHealthy,
        latencyMs: probeLatency,
        timestamp,
        status: finalStatus,
        message,
        statusCode,
        packetLossRate: isForcedFail ? 100 : isRandomSpike ? 25 : 0,
      };

      const prevHistory = provider.healthHistory || [
        {
          timestamp: timestamp - 15000,
          latencyMs: provider.baseLatencyMs,
          isHealthy: true,
          status: 'active',
        },
      ];

      const newHistoryPoint: HealthCheckHistoryPoint = {
        timestamp,
        latencyMs: probeLatency,
        isHealthy,
        status: finalStatus,
      };

      // Keep last 12 health-check probes
      const healthHistory = [...prevHistory.slice(-11), newHistoryPoint];

      // Update moving average latency
      const newAvgLatency = Math.round(
        provider.stats.avgLatencyMs * 0.85 + probeLatency * 0.15
      );

      return {
        ...provider,
        status: finalStatus,
        healthCheck,
        healthHistory,
        stats: {
          ...provider.stats,
          avgLatencyMs: newAvgLatency,
        },
      };
    });

    const avgLatencyMs = Math.round(totalLatency / (updatedProviders.length || 1));

    return {
      updatedProviders,
      summary: {
        timestamp,
        healthyCount,
        degradedCount,
        offlineCount,
        avgLatencyMs,
        probedCount: updatedProviders.length,
      },
    };
  }

  // Step 5: Circuit Breaker & Flapping Evaluation
  static evaluateCircuitBreaker(
    provider: Provider,
    consecutiveFailuresThreshold = 3
  ): CircuitBreakerStatus {
    const history = provider.healthHistory || [];
    if (history.length === 0) {
      return {
        providerId: provider.id,
        state: 'CLOSED',
        consecutiveFailures: 0,
        failureRate: 0,
        lastStateChange: Date.now(),
        reason: 'Провайдер стабилен. Нет истории сбоев.',
      };
    }

    // Count consecutive trailing failures
    let consecutiveFailures = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i].isHealthy) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    const failedTotal = history.filter((h) => !h.isHealthy).length;
    const failureRate = Math.round((failedTotal / history.length) * 100);

    if (consecutiveFailures >= consecutiveFailuresThreshold) {
      return {
        providerId: provider.id,
        state: 'OPEN',
        consecutiveFailures,
        failureRate,
        lastStateChange: Date.now(),
        reason: `Circuit Breaker сработал (OPEN): ${consecutiveFailures} подряд сбоев ответа шлюза. Трафик заблокирован.`,
      };
    }

    // If last probe was healthy but previous was failing, it is in HALF_OPEN probationary mode
    if (history.length >= 2 && history[history.length - 1].isHealthy && !history[history.length - 2].isHealthy) {
      return {
        providerId: provider.id,
        state: 'HALF_OPEN',
        consecutiveFailures,
        failureRate,
        lastStateChange: Date.now(),
        reason: 'Circuit Breaker в режиме испытания (HALF_OPEN): первый успешный отклик после сбоя.',
      };
    }

    return {
      providerId: provider.id,
      state: 'CLOSED',
      consecutiveFailures,
      failureRate,
      lastStateChange: Date.now(),
      reason: 'Circuit Breaker в норме (CLOSED): шлюз доступен для маршрутизации.',
    };
  }

  // Step 6: AML, Fraud & Velocity Risk Assessment
  static assessTransactionRisk(
    request: PayoutRequest,
    recentRequests: PayoutRequest[] = []
  ): RiskAssessmentResult {
    let riskScore = 0;
    const triggeredRules: string[] = [];
    let requiresEnhancedKYC = false;

    const recipientId = request.recipient?.accountIdentifier || '';

    // 1. Velocity check: rapid payments to identical destination in last 60s
    const now = request.createdAt || Date.now();
    const velocityWindowMs = 60 * 1000;
    const sameRecipientCount = recentRequests.filter(
      (r) =>
        r.recipient?.accountIdentifier === recipientId &&
        Math.abs(now - r.createdAt) <= velocityWindowMs
    ).length;

    if (sameRecipientCount >= 3) {
      riskScore += 45;
      triggeredRules.push(
        `VELOCITY_SPIKE_DETECTED: Зафиксировано ${sameRecipientCount + 1} запросов на один счет за 60 секунд`
      );
    }

    // 2. High-value compliance threshold (115-ФЗ / AML Directive)
    const isHighValue =
      (request.currency === 'RUB' && request.amount >= 600000) ||
      (request.currency === 'USD' && request.amount >= 10000) ||
      (request.currency === 'EUR' && request.amount >= 10000) ||
      (request.currency === 'USDT' && request.amount >= 10000);

    if (isHighValue) {
      riskScore += 30;
      requiresEnhancedKYC = true;
      triggeredRules.push(
        `LARGE_VALUE_COMPLIANCE_THRESHOLD: Сумма превышает порог обязательного финансового контроля (${request.amount} ${request.currency})`
      );
    }

    // 3. Micro-transaction dust flood attack check
    if (request.amount <= 0.1 && (request.currency === 'USD' || request.currency === 'EUR' || request.currency === 'USDT')) {
      riskScore += 35;
      triggeredRules.push('MICRO_TRANSACTION_DUST_SUSPECTED: Подозрение на спам-тестирование кошельков');
    } else if (request.amount < 10 && request.currency === 'RUB') {
      riskScore += 25;
      triggeredRules.push('MICRO_TRANSACTION_DUST_SUSPECTED: Сумма выплаты ниже экономической рентабельности');
    }

    // 4. Card BIN identification
    let detectedBinInfo: RiskAssessmentResult['detectedBinInfo'] | undefined;
    if (request.method === 'card' && recipientId) {
      const cleanCard = recipientId.replace(/\D/g, '');
      const bin = cleanCard.substring(0, 6);
      let brand: 'MIR' | 'VISA' | 'MASTERCARD' | 'UNIONPAY' | 'UNKNOWN' = 'UNKNOWN';
      let isDomesticRu = false;

      if (cleanCard.startsWith('2200') || cleanCard.startsWith('2204') || cleanCard.startsWith('2202')) {
        brand = 'MIR';
        isDomesticRu = true;
      } else if (cleanCard.startsWith('4')) {
        brand = 'VISA';
        isDomesticRu = request.country === 'RU';
      } else if (cleanCard.startsWith('51') || cleanCard.startsWith('52') || cleanCard.startsWith('53') || cleanCard.startsWith('54') || cleanCard.startsWith('55')) {
        brand = 'MASTERCARD';
        isDomesticRu = request.country === 'RU';
      } else if (cleanCard.startsWith('62')) {
        brand = 'UNIONPAY';
      }

      detectedBinInfo = {
        bin,
        brand,
        isDomesticRu,
      };
    }

    // 5. Crypto address KYT & Mixer check
    if (request.method === 'crypto' || request.currency === 'USDT') {
      const lowerAddress = recipientId.toLowerCase();
      // Blacklist / Mixer patterns
      const isMixerOrSanctioned =
        lowerAddress.includes('tornado') ||
        lowerAddress.includes('mixer') ||
        lowerAddress.includes('blender') ||
        lowerAddress.includes('darknet') ||
        lowerAddress.startsWith('0x0000000000000000000000000000000000000000');

      if (isMixerOrSanctioned) {
        riskScore += 80;
        triggeredRules.push('SANCTIONED_OR_MIXER_WALLET_DETECTED: Адрес кошелька связан с миксерами или санкционными списками (OFAC)');
      }

      // Check format length
      const isTrc20 = recipientId.startsWith('T') && recipientId.length === 34;
      const isEvm = recipientId.startsWith('0x') && recipientId.length === 42;
      const isBtc = (recipientId.startsWith('1') || recipientId.startsWith('3') || recipientId.startsWith('bc1')) && recipientId.length >= 26;
      const isSolana = recipientId.length >= 32 && recipientId.length <= 44 && !recipientId.startsWith('0x');

      if (recipientId && !isTrc20 && !isEvm && !isBtc && !isSolana && !isMixerOrSanctioned) {
        riskScore += 20;
        triggeredRules.push('NON_STANDARD_CRYPTO_ADDRESS: Нестандартный формат блокчейн-адреса, требуется дополнительная верификация сети');
      }
    }

    // Determine Risk Level & Action
    let riskLevel: RiskAssessmentResult['riskLevel'] = 'LOW';
    let action: RiskAssessmentResult['action'] = 'ALLOW';

    if (riskScore >= 75) {
      riskLevel = 'CRITICAL';
      action = 'REJECT';
    } else if (riskScore >= 50) {
      riskLevel = 'HIGH';
      action = 'STEP_UP_ROUTING';
    } else if (riskScore >= 25) {
      riskLevel = 'MEDIUM';
      action = 'ALLOW';
    }

    return {
      riskScore,
      riskLevel,
      triggeredRules,
      requiresEnhancedKYC,
      action,
      detectedBinInfo,
    };
  }

  // Step 7: Floating-Point Epsilon Safe Crypto Arithmetic
  static calculatePreciseCryptoFee(
    amount: number,
    feePercent: number,
    feeFixed: number,
    decimals = 8
  ): { calculatedFee: number; netAmount: number; effectiveRate: number } {
    const factor = Math.pow(10, decimals);
    const amountUnits = Math.round(amount * factor);
    const percentUnits = Math.round((amountUnits * feePercent) / 100);
    const fixedUnits = Math.round(feeFixed * factor);
    const totalFeeUnits = percentUnits + fixedUnits;
    const netUnits = Math.max(0, amountUnits - totalFeeUnits);

    const calculatedFee = totalFeeUnits / factor;
    const netAmount = netUnits / factor;
    const effectiveRate = amount > 0 ? (calculatedFee / amount) * 100 : 0;

    return {
      calculatedFee: Number(calculatedFee.toFixed(decimals)),
      netAmount: Number(netAmount.toFixed(decimals)),
      effectiveRate: Number(effectiveRate.toFixed(4)),
    };
  }

  // Step 8: Tiered Volume Bracket Calculations
  static calculateTieredFee(
    provider: Provider,
    requestAmount: number,
    customBrackets?: TieredVolumeBracket[]
  ): { calculatedFee: number; effectiveFeePercent: number; appliedBracket: TieredVolumeBracket } {
    const brackets: TieredVolumeBracket[] = customBrackets || [
      { upToVolume: 100000, feePercent: provider.feePercent, feeFixed: provider.feeFixed },
      { upToVolume: 500000, feePercent: Math.max(0.5, provider.feePercent - 0.4), feeFixed: provider.feeFixed * 0.8 },
      { upToVolume: Infinity, feePercent: Math.max(0.3, provider.feePercent - 0.8), feeFixed: provider.feeFixed * 0.5 },
    ];

    const currentVol = provider.stats.volumeProcessed || 0;
    const appliedBracket =
      brackets.find((b) => currentVol < b.upToVolume) || brackets[brackets.length - 1];

    const calculatedFee = (requestAmount * appliedBracket.feePercent) / 100 + appliedBracket.feeFixed;
    const effectiveFeePercent = requestAmount > 0 ? (calculatedFee / requestAmount) * 100 : 0;

    return {
      calculatedFee: Number(calculatedFee.toFixed(2)),
      effectiveFeePercent: Number(effectiveFeePercent.toFixed(3)),
      appliedBracket,
    };
  }

  // Step 9: Atomic Concurrent Headroom Batch Simulation
  static simulateAtomicConcurrentBatch(
    requests: PayoutRequest[],
    initialProviders: Provider[],
    options: {
      forcedFailures?: Record<string, boolean>;
      rules?: RoutingRule[];
      weights?: ScoringWeights;
    } = {}
  ): {
    transactions: PayoutTransaction[];
    updatedProviders: Provider[];
    rejectedQuotaCount: number;
  } {
    let currentProviders = JSON.parse(JSON.stringify(initialProviders)) as Provider[];
    const transactions: PayoutTransaction[] = [];
    let rejectedQuotaCount = 0;

    for (const req of requests) {
      const filterResults = this.filterProviders(req, currentProviders);
      const eligible = filterResults.filter((r) => r.passed).map((r) => r.provider);
      const scored = this.scoreProviders(
        req,
        eligible,
        options.weights || DEFAULT_WEIGHTS,
        options.rules || DEFAULT_RULES
      );

      // Execute synchronous step
      let topCandidate = scored[0];
      let status: PayoutTransaction['status'] = 'failed';
      let finalProv: Provider | undefined;
      let attempts: ExecutionAttempt[] = [];

      if (!topCandidate) {
        rejectedQuotaCount++;
        transactions.push({
          id: `tx_${req.id}`,
          request: req,
          status: 'failed',
          filterResults,
          scoredCandidates: [],
          selectedInitialProvider: {
            id: 'prov_none',
            name: 'Нет доступного шлюза',
            code: 'NO_PROVIDER',
            category: 'Fallback',
            description: 'Лимиты исчерпаны',
            color: '#64748B',
            status: 'disabled',
            supportedCurrencies: [],
            supportedCountries: [],
            supportedMethods: [],
            minAmount: 0,
            maxAmount: 0,
            dailyVolumeLimit: 0,
            currentDailyVolume: 0,
            feePercent: 0,
            feeFixed: 0,
            baseLatencyMs: 0,
            simulatedFailureRate: 0,
            badge: 'None',
            stats: {
              totalPayouts: 0,
              successfulPayouts: 0,
              failedPayouts: 0,
              successRate: 0,
              avgLatencyMs: 0,
              totalFeesPaid: 0,
              volumeProcessed: 0,
              recentOutcomes: [],
            },
            tags: [],
          },
          executionAttempts: [],
          totalAttempts: 0,
          totalLatencyMs: 0,
          totalFeeCharged: 0,
          naiveDefaultFee: 0,
          feeSaved: 0,
          traceLogs: [
            {
              stage: 'VALIDATION',
              message: 'Отказ в выплате: исчерпан суточный лимит доступных шлюзов',
              timestamp: Date.now(),
            },
          ],
          createdAt: req.createdAt,
          completedAt: Date.now(),
        });
        continue;
      }

      // Check cascade
      for (let rankIdx = 0; rankIdx < scored.length; rankIdx++) {
        const candidate = scored[rankIdx];
        const prov = currentProviders.find((p) => p.id === candidate.provider.id)!;
        const isForcedFail = Boolean(options.forcedFailures?.[prov.id]);

        if (isForcedFail) {
          attempts.push({
            attemptNumber: rankIdx + 1,
            providerId: prov.id,
            providerName: prov.name,
            providerCode: prov.code,
            status: 'failed',
            latencyMs: prov.baseLatencyMs,
            errorMessage: 'Имитация сбоя',
            timestamp: Date.now(),
          });
        } else {
          // Success
          status = rankIdx === 0 ? 'success' : 'fallback_success';
          finalProv = prov;
          attempts.push({
            attemptNumber: rankIdx + 1,
            providerId: prov.id,
            providerName: prov.name,
            providerCode: prov.code,
            status: 'success',
            latencyMs: prov.baseLatencyMs,
            feeCharged: candidate.calculatedFee,
            timestamp: Date.now(),
          });

          // Atomically deduct headroom from state
          prov.currentDailyVolume += req.amount;
          prov.stats.totalPayouts += 1;
          prov.stats.successfulPayouts += 1;
          prov.stats.volumeProcessed += req.amount;
          prov.stats.totalFeesPaid += candidate.calculatedFee;
          break;
        }
      }

      const totalFee = finalProv ? scored.find((s) => s.provider.id === finalProv?.id)?.calculatedFee || 0 : 0;

      transactions.push({
        id: `tx_${req.id}`,
        request: req,
        status,
        filterResults,
        scoredCandidates: scored,
        selectedInitialProvider: topCandidate.provider,
        executionAttempts: attempts,
        finalProvider: finalProv,
        totalAttempts: attempts.length,
        totalLatencyMs: attempts.reduce((sum, a) => sum + a.latencyMs, 0),
        totalFeeCharged: totalFee,
        naiveDefaultFee: (req.amount * 0.035) + 1.0,
        feeSaved: Math.max(0, ((req.amount * 0.035) + 1.0) - totalFee),
        traceLogs: [],
        createdAt: req.createdAt,
        completedAt: Date.now(),
      });
    }

    return {
      transactions,
      updatedProviders: currentProviders,
      rejectedQuotaCount,
    };
  }

  // Step 10: Rule Matrix & Conflict Resolution
  static resolveConflictingRules(
    rules: RoutingRule[],
    request: PayoutRequest
  ): { activeRules: RoutingRule[]; overriddenRules: Array<{ rule: RoutingRule; reason: string }> } {
    const enabledRules = rules.filter((r) => r.enabled);
    const matchedRules = enabledRules.filter((r) => {
      if (r.condition.currency && r.condition.currency !== request.currency) return false;
      if (r.condition.country && r.condition.country !== request.country) return false;
      if (r.condition.method && r.condition.method !== request.method) return false;
      if (r.condition.minAmount !== undefined && request.amount < r.condition.minAmount) return false;
      if (r.condition.maxAmount !== undefined && request.amount > r.condition.maxAmount) return false;
      return true;
    });

    // Sort by priority ascending (1 = highest priority)
    matchedRules.sort((a, b) => a.priority - b.priority);

    const activeRules: RoutingRule[] = [];
    const overriddenRules: Array<{ rule: RoutingRule; reason: string }> = [];
    const targetActions = new Map<string, RoutingRule>();

    for (const rule of matchedRules) {
      const targetId = rule.action.targetProviderId;
      if (!targetId) {
        activeRules.push(rule);
        continue;
      }

      const existingRule = targetActions.get(targetId);
      if (existingRule) {
        overriddenRules.push({
          rule,
          reason: `Переопределено правилом "${existingRule.name}" с более высоким приоритетом (#${existingRule.priority} > #${rule.priority})`,
        });
      } else {
        targetActions.set(targetId, rule);
        activeRules.push(rule);
      }
    }

    return {
      activeRules,
      overriddenRules,
    };
  }

  // Step 11: Jitter and P99 Latency Variance Penalty
  static calculateBimodalPenaltyScore(
    provider: Provider,
    p99LatencyMs: number,
    avgLatencyMs: number
  ): number {
    if (avgLatencyMs <= 0) return 100;
    const jitterRatio = p99LatencyMs / avgLatencyMs;
    // If p99 is more than 3x the average, apply quadratic penalty
    if (jitterRatio > 3.0) {
      const penalty = Math.min(50, Math.round((jitterRatio - 3.0) * 12));
      return Math.max(10, 100 - penalty);
    }
    return 100;
  }
}
