export type Currency = 'USD' | 'EUR' | 'RUB' | 'KZT' | 'USDT' | 'GBP' | 'TRY';

export type Country = 'US' | 'EU' | 'RU' | 'KZ' | 'GB' | 'TR' | 'SG' | 'AE' | 'GLOBAL';

export type PaymentMethod = 'card' | 'sbp' | 'crypto' | 'bank_transfer' | 'e_wallet';

export type ProviderStatus = 'active' | 'degraded' | 'maintenance' | 'disabled';

export interface HealthCheckResult {
  isHealthy: boolean;
  latencyMs: number;
  timestamp: number;
  status: ProviderStatus;
  message: string;
  packetLossRate?: number;
  statusCode?: number;
}

export interface HealthCheckHistoryPoint {
  timestamp: number;
  latencyMs: number;
  isHealthy: boolean;
  status: ProviderStatus;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalSeconds: number; // e.g. 5
  latencyThresholdDegraded: number; // e.g. 450ms
  latencyThresholdOffline: number; // e.g. 850ms
  lastRunTimestamp?: number;
}

export interface ProviderStats {
  totalPayouts: number;
  successfulPayouts: number;
  failedPayouts: number;
  successRate: number; // 0 to 100
  avgLatencyMs: number;
  totalFeesPaid: number;
  volumeProcessed: number;
  recentOutcomes: Array<{ success: boolean; latencyMs: number; timestamp: number }>;
}

export interface Provider {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  status: ProviderStatus;
  supportedCurrencies: Currency[];
  supportedCountries: Country[];
  supportedMethods: PaymentMethod[];
  minAmount: number;
  maxAmount: number;
  dailyVolumeLimit: number;
  currentDailyVolume: number;
  feePercent: number; // e.g. 1.8%
  feeFixed: number; // e.g. $0.30
  baseLatencyMs: number;
  simulatedFailureRate: number; // 0 to 1 (probability of simulated transient error)
  color: string;
  badge: string;
  stats: ProviderStats;
  tags: string[];
  healthCheck?: HealthCheckResult;
  healthHistory?: HealthCheckHistoryPoint[];
}

export interface PayoutRequest {
  id: string;
  amount: number;
  currency: Currency;
  country: Country;
  method: PaymentMethod;
  recipient: {
    name: string;
    accountIdentifier: string; // e.g. Card number, SBP phone, USDT wallet, IBAN
  };
  clientReference?: string;
  notes?: string;
  createdAt: number;
}

export interface ProviderFilterResult {
  provider: Provider;
  passed: boolean;
  reasons: string[];
}

export interface CandidateScore {
  provider: Provider;
  totalScore: number; // 0 to 100
  feeScore: number; // 0 to 100
  successScore: number; // 0 to 100
  latencyScore: number; // 0 to 100
  capacityScore: number; // 0 to 100
  calculatedFee: number;
  effectiveFeePercent: number;
  estimatedLatencyMs: number;
  rank: number;
}

export interface ScoringWeights {
  feeWeight: number; // e.g. 35
  successRateWeight: number; // e.g. 35
  latencyWeight: number; // e.g. 15
  capacityWeight: number; // e.g. 15
}

export interface RoutingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  condition: {
    currency?: Currency;
    country?: Country;
    method?: PaymentMethod;
    minAmount?: number;
    maxAmount?: number;
  };
  action: {
    type: 'force_provider' | 'exclude_provider' | 'boost_provider' | 'set_weight_preset';
    targetProviderId?: string;
    boostMultiplier?: number;
    customWeights?: ScoringWeights;
  };
}

export interface ExecutionAttempt {
  attemptNumber: number;
  providerId: string;
  providerName: string;
  providerCode: string;
  status: 'success' | 'failed' | 'timeout';
  latencyMs: number;
  feeCharged?: number;
  errorMessage?: string;
  errorCode?: string;
  timestamp: number;
}

export interface PayoutTransaction {
  id: string;
  request: PayoutRequest;
  status: 'processing' | 'success' | 'fallback_success' | 'failed';
  filterResults: ProviderFilterResult[];
  scoredCandidates: CandidateScore[];
  selectedInitialProvider: Provider;
  executionAttempts: ExecutionAttempt[];
  finalProvider?: Provider;
  totalAttempts: number;
  totalLatencyMs: number;
  totalFeeCharged: number;
  naiveDefaultFee: number;
  feeSaved: number;
  activeRuleApplied?: string;
  riskAssessment?: RiskAssessmentResult;
  traceLogs: Array<{
    stage: 'VALIDATION' | 'FILTERING' | 'SCORING' | 'EXECUTION' | 'FALLBACK' | 'LEARNING';
    message: string;
    timestamp: number;
    details?: any;
  }>;
  createdAt: number;
  completedAt?: number;
}

export interface BatchSimulationSummary {
  total: number;
  successful: number;
  fallbackSuccessful: number;
  failed: number;
  totalVolume: number;
  totalFees: number;
  totalFeesSaved: number;
  avgLatency: number;
  providerDispatches: Record<string, number>;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
  providerId: string;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  failureRate: number;
  lastStateChange: number;
  reason: string;
}

export interface RiskAssessmentResult {
  riskScore: number; // 0 to 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggeredRules: string[];
  requiresEnhancedKYC: boolean;
  action: 'ALLOW' | 'STEP_UP_ROUTING' | 'REJECT';
  detectedBinInfo?: {
    bin: string;
    brand: 'MIR' | 'VISA' | 'MASTERCARD' | 'UNIONPAY' | 'UNKNOWN';
    isDomesticRu: boolean;
  };
}

export interface TieredVolumeBracket {
  upToVolume: number;
  feePercent: number;
  feeFixed: number;
}

