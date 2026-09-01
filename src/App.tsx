import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Provider,
  ScoringWeights,
  RoutingRule,
  PayoutTransaction,
  PayoutRequest,
  HealthCheckConfig,
} from './types';
import { INITIAL_PROVIDERS } from './data/initialProviders';
import {
  DEFAULT_WEIGHTS,
  DEFAULT_RULES,
  DEFAULT_HEALTH_CONFIG,
  RouterEngine,
} from './services/routerEngine';
import { Navbar, ActiveTab } from './components/Navbar';
import { LiveRoutingView } from './components/LiveRoutingView';
import { BatchSimulatorView } from './components/BatchSimulatorView';
import { ProvidersView } from './components/ProvidersView';
import { RulesAndScoringView } from './components/RulesAndScoringView';
import { AnalyticsView } from './components/AnalyticsView';
import { TestSuiteView } from './components/TestSuiteView';
import { RubyCodeView } from './components/RubyCodeView';

// Seed sample historical transactions
const SEED_TRANSACTIONS: PayoutTransaction[] = [
  {
    id: 'tx_seed_101',
    request: {
      id: 'req_101',
      amount: 25000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: { name: 'Дмитрий В. К.', accountIdentifier: '+7 (916) 123-45-67' },
      notes: 'Выплата дивидендов',
      createdAt: Date.now() - 3600000 * 2,
    },
    status: 'success',
    filterResults: [],
    scoredCandidates: [],
    selectedInitialProvider: INITIAL_PROVIDERS[1], // SBP
    executionAttempts: [
      {
        attemptNumber: 1,
        providerId: 'prov_sbp_hub',
        providerName: 'СБП Платформа (NSPK/SBP Hub)',
        providerCode: 'SBP_HUB',
        status: 'success',
        latencyMs: 195,
        feeCharged: 201,
        timestamp: Date.now() - 3600000 * 2,
      },
    ],
    finalProvider: INITIAL_PROVIDERS[1],
    totalAttempts: 1,
    totalLatencyMs: 195,
    totalFeeCharged: 201,
    naiveDefaultFee: 725.8,
    feeSaved: 524.8,
    traceLogs: [
      { stage: 'VALIDATION', message: 'Запрос 25,000 RUB валидирован', timestamp: Date.now() - 3600000 * 2 },
      { stage: 'FILTERING', message: 'Допущено 3 провайдера: SBP_HUB, CLOUDPAY, UNLIMINT', timestamp: Date.now() - 3600000 * 2 },
      { stage: 'SCORING', message: 'Лидер: SBP_HUB (Score: 94.2)', timestamp: Date.now() - 3600000 * 2 },
      { stage: 'EXECUTION', message: 'Выплата успешно проведена за 195ms', timestamp: Date.now() - 3600000 * 2 },
    ],
    createdAt: Date.now() - 3600000 * 2,
    completedAt: Date.now() - 3600000 * 2 + 195,
  },
  {
    id: 'tx_seed_102',
    request: {
      id: 'req_102',
      amount: 1200,
      currency: 'USD',
      country: 'US',
      method: 'card',
      recipient: { name: 'Elena Rostova', accountIdentifier: '4276 1122 3344 5566' },
      notes: 'Creative contractor fee',
      createdAt: Date.now() - 3600000 * 1.5,
    },
    status: 'fallback_success',
    filterResults: [],
    scoredCandidates: [],
    selectedInitialProvider: INITIAL_PROVIDERS[0], // Stripe
    executionAttempts: [
      {
        attemptNumber: 1,
        providerId: 'prov_stripe',
        providerName: 'Stripe Global Payouts',
        providerCode: 'STRIPE',
        status: 'failed',
        latencyMs: 410,
        errorMessage: '504 Gateway Timeout: Bank rail latency',
        errorCode: 'STRIPE_TIMEOUT_504',
        timestamp: Date.now() - 3600000 * 1.5,
      },
      {
        attemptNumber: 2,
        providerId: 'prov_adyen',
        providerName: 'Adyen Global Direct',
        providerCode: 'ADYEN',
        status: 'success',
        latencyMs: 430,
        feeCharged: 21.35,
        timestamp: Date.now() - 3600000 * 1.5 + 410,
      },
    ],
    finalProvider: INITIAL_PROVIDERS[2], // Adyen
    totalAttempts: 2,
    totalLatencyMs: 840,
    totalFeeCharged: 21.35,
    naiveDefaultFee: 35.6,
    feeSaved: 14.25,
    traceLogs: [
      { stage: 'VALIDATION', message: 'Запрос $1,200 USD валидирован', timestamp: Date.now() - 3600000 * 1.5 },
      { stage: 'SCORING', message: 'Основной: Stripe, Fallback #1: Adyen', timestamp: Date.now() - 3600000 * 1.5 },
      { stage: 'FALLBACK', message: 'Сбой у Stripe (504). Авто-переход на Adyen...', timestamp: Date.now() - 3600000 * 1.5 + 410 },
      { stage: 'EXECUTION', message: 'Выплата успешно проведена через Adyen', timestamp: Date.now() - 3600000 * 1.5 + 840 },
    ],
    createdAt: Date.now() - 3600000 * 1.5,
    completedAt: Date.now() - 3600000 * 1.5 + 840,
  },
  {
    id: 'tx_seed_103',
    request: {
      id: 'req_103',
      amount: 4500,
      currency: 'USDT',
      country: 'GLOBAL',
      method: 'crypto',
      recipient: { name: 'BlockNode Payouts', accountIdentifier: 'TY9qK...4zLm' },
      notes: 'Affiliate rewards settlement',
      createdAt: Date.now() - 3600000 * 0.8,
    },
    status: 'success',
    filterResults: [],
    scoredCandidates: [],
    selectedInitialProvider: INITIAL_PROVIDERS[3], // CryptoPay
    executionAttempts: [
      {
        attemptNumber: 1,
        providerId: 'prov_cryptopay',
        providerName: 'CryptoPay USDT Settlement',
        providerCode: 'CRYPTOPAY',
        status: 'success',
        latencyMs: 620,
        feeCharged: 24.0,
        timestamp: Date.now() - 3600000 * 0.8,
      },
    ],
    finalProvider: INITIAL_PROVIDERS[3],
    totalAttempts: 1,
    totalLatencyMs: 620,
    totalFeeCharged: 24.0,
    naiveDefaultFee: 131.3,
    feeSaved: 107.3,
    traceLogs: [
      { stage: 'VALIDATION', message: 'Запрос 4,500 USDT валидирован', timestamp: Date.now() - 3600000 * 0.8 },
      { stage: 'SCORING', message: 'Лидер: CryptoPay (Score: 96.8)', timestamp: Date.now() - 3600000 * 0.8 },
      { stage: 'EXECUTION', message: 'Broadcast подтвержден в TRON сети', timestamp: Date.now() - 3600000 * 0.8 },
    ],
    createdAt: Date.now() - 3600000 * 0.8,
    completedAt: Date.now() - 3600000 * 0.8 + 620,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [providers, setProviders] = useState<Provider[]>(INITIAL_PROVIDERS);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [rules, setRules] = useState<RoutingRule[]>(DEFAULT_RULES);
  const [transactions, setTransactions] = useState<PayoutTransaction[]>(SEED_TRANSACTIONS);
  const [forcedFailures, setForcedFailures] = useState<Record<string, boolean>>({});
  const [healthConfig, setHealthConfig] = useState<HealthCheckConfig>(DEFAULT_HEALTH_CONFIG);
  const [isProbing, setIsProbing] = useState(false);
  const [lastProbeSummary, setLastProbeSummary] = useState<{
    timestamp: number;
    healthyCount: number;
    degradedCount: number;
    offlineCount: number;
    avgLatencyMs: number;
    probedCount: number;
  } | null>(null);

  // References to prevent interval recreation loops
  const providersRef = useRef(providers);
  const forcedFailuresRef = useRef(forcedFailures);
  const healthConfigRef = useRef(healthConfig);

  useEffect(() => {
    providersRef.current = providers;
  }, [providers]);

  useEffect(() => {
    forcedFailuresRef.current = forcedFailures;
  }, [forcedFailures]);

  useEffect(() => {
    healthConfigRef.current = healthConfig;
  }, [healthConfig]);

  // Execute a health probe cycle
  const executeHealthProbeCycle = useCallback(() => {
    setIsProbing(true);
    const { updatedProviders, summary } = RouterEngine.runHealthCheckProbe(
      providersRef.current,
      forcedFailuresRef.current,
      healthConfigRef.current
    );
    setProviders(updatedProviders);
    setLastProbeSummary(summary);

    setTimeout(() => {
      setIsProbing(false);
    }, 350);
  }, []);

  // Automated periodic health-check timer
  useEffect(() => {
    if (!healthConfig.enabled) return;

    const intervalId = window.setInterval(() => {
      executeHealthProbeCycle();
    }, healthConfig.intervalSeconds * 1000);

    return () => window.clearInterval(intervalId);
  }, [healthConfig.enabled, healthConfig.intervalSeconds, executeHealthProbeCycle]);

  // Manual single-provider probe
  const handleRunSingleProbe = useCallback((providerId: string) => {
    setProviders((currentProviders) => {
      const target = currentProviders.find((p) => p.id === providerId);
      if (!target) return currentProviders;

      const { updatedProviders } = RouterEngine.runHealthCheckProbe(
        [target],
        forcedFailuresRef.current,
        healthConfigRef.current
      );

      const newTarget = updatedProviders[0];
      return currentProviders.map((p) => (p.id === providerId ? newTarget : p));
    });
  }, []);

  // Global aggregate metrics
  const totalVolume = transactions.reduce(
    (acc, t) => acc + (t.status !== 'failed' ? t.request.amount : 0),
    0
  );
  const successfulCount = transactions.filter(
    (t) => t.status === 'success' || t.status === 'fallback_success'
  ).length;
  const overallSuccessRate =
    transactions.length > 0 ? (successfulCount / transactions.length) * 100 : 100;

  const handleExecutePayout = (
    newTx: PayoutTransaction,
    updatedProviders: Provider[]
  ) => {
    setTransactions((prev) => [newTx, ...prev]);
    setProviders(updatedProviders);
  };

  const handleBatchTransactionsGenerated = (
    newTxs: PayoutTransaction[],
    updatedProviders: Provider[]
  ) => {
    setTransactions((prev) => [...newTxs, ...prev]);
    setProviders(updatedProviders);
  };

  const handleUpdateProvider = (updated: Provider) => {
    setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleResetData = () => {
    if (confirm('Сбросить все метрики, транзакции и вернуть шлюзы к исходному состоянию?')) {
      setProviders(INITIAL_PROVIDERS);
      setWeights(DEFAULT_WEIGHTS);
      setRules(DEFAULT_RULES);
      setTransactions(SEED_TRANSACTIONS);
      setForcedFailures({});
      setHealthConfig(DEFAULT_HEALTH_CONFIG);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalVolume={totalVolume}
        totalTransactions={transactions.length}
        successRate={overallSuccessRate}
        onResetData={handleResetData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'live' && (
          <LiveRoutingView
            providers={providers}
            weights={weights}
            rules={rules}
            onExecutePayout={handleExecutePayout}
            forcedFailures={forcedFailures}
            setForcedFailures={setForcedFailures}
          />
        )}

        {activeTab === 'batch' && (
          <BatchSimulatorView
            providers={providers}
            weights={weights}
            rules={rules}
            onBatchTransactionsGenerated={handleBatchTransactionsGenerated}
            forcedFailures={forcedFailures}
          />
        )}

        {activeTab === 'providers' && (
          <ProvidersView
            providers={providers}
            onUpdateProvider={handleUpdateProvider}
            forcedFailures={forcedFailures}
            setForcedFailures={setForcedFailures}
            healthConfig={healthConfig}
            onUpdateHealthConfig={setHealthConfig}
            onRunHealthProbeNow={executeHealthProbeCycle}
            onRunSingleProbe={handleRunSingleProbe}
            isProbing={isProbing}
          />
        )}

        {activeTab === 'rules' && (
          <RulesAndScoringView
            weights={weights}
            onUpdateWeights={setWeights}
            rules={rules}
            onUpdateRules={setRules}
            providers={providers}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView transactions={transactions} providers={providers} />
        )}

        {activeTab === 'tests' && <TestSuiteView />}

        {activeTab === 'ruby' && <RubyCodeView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Smart Payout Routing Engine • Архитектура Ruby Strategy & Sidekiq Fallback
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Pim pim patapim team solution
          </span>
        </div>
      </footer>
    </div>
  );
}
