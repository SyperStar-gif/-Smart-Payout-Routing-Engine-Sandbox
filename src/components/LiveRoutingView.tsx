import React, { useState } from 'react';
import {
  PayoutRequest,
  Currency,
  Country,
  PaymentMethod,
  Provider,
  PayoutTransaction,
  ScoringWeights,
  RoutingRule,
} from '../types';
import { RouterEngine } from '../services/routerEngine';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  TrendingUp,
  Percent,
  Clock,
  HardDrive,
  Sparkles,
  Zap,
  Repeat,
  ShieldCheck,
  ChevronDown,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LiveRoutingViewProps {
  providers: Provider[];
  weights: ScoringWeights;
  rules: RoutingRule[];
  onExecutePayout: (tx: PayoutTransaction, updatedProviders: Provider[]) => void;
  forcedFailures: Record<string, boolean>;
  setForcedFailures: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const PRESETS: Array<{
  title: string;
  badge: string;
  request: Omit<PayoutRequest, 'id' | 'createdAt'>;
}> = [
  {
    title: 'Мгновенная СБП выплата',
    badge: 'СБП 24/7',
    request: {
      amount: 15000,
      currency: 'RUB',
      country: 'RU',
      method: 'sbp',
      recipient: {
        name: 'Иван Сергеевич П.',
        accountIdentifier: '+7 (999) 450-22-11',
      },
      notes: 'Выплата партнерского вознаграждения',
    },
  },
  {
    title: 'Международная выплата на Карту USD',
    badge: 'Global Visa/MC',
    request: {
      amount: 1450,
      currency: 'USD',
      country: 'US',
      method: 'card',
      recipient: {
        name: 'Sarah Jenkins',
        accountIdentifier: '4111 2233 4455 9812',
      },
      notes: 'Freelance contractor payout',
    },
  },
  {
    title: 'USDT TRC20 Стейблкоин',
    badge: 'Zero Border',
    request: {
      amount: 5200,
      currency: 'USDT',
      country: 'GLOBAL',
      method: 'crypto',
      recipient: {
        name: 'Alex Rivera (Crypto Vault)',
        accountIdentifier: 'TYDzsYUEpvnYmQk4zGp2s8TKn9q1w3LmPQ',
      },
      notes: 'Affiliate commission batch #441',
    },
  },
  {
    title: 'SEPA Instant Eurotransfer',
    badge: 'SEPA TIPS',
    request: {
      amount: 3800,
      currency: 'EUR',
      country: 'EU',
      method: 'bank_transfer',
      recipient: {
        name: 'TechConsulting GmbH',
        accountIdentifier: 'DE89 3704 0044 0532 0130 00',
      },
      notes: 'Invoice disbursement',
    },
  },
  {
    title: 'Крупная выплата (VIP лимит)',
    badge: 'High Amount',
    request: {
      amount: 45000,
      currency: 'USD',
      country: 'GLOBAL',
      method: 'bank_transfer',
      recipient: {
        name: 'Enterprise Apex Corp',
        accountIdentifier: 'CH93 0076 2011 6238 5295 7',
      },
      notes: 'Quarterly vendor settlement',
    },
  },
];

export const LiveRoutingView: React.FC<LiveRoutingViewProps> = ({
  providers,
  weights,
  rules,
  onExecutePayout,
  forcedFailures,
  setForcedFailures,
}) => {
  const [amount, setAmount] = useState<number>(15000);
  const [currency, setCurrency] = useState<Currency>('RUB');
  const [country, setCountry] = useState<Country>('RU');
  const [method, setMethod] = useState<PaymentMethod>('sbp');
  const [recipientName, setRecipientName] = useState<string>('Иван Сергеевич П.');
  const [recipientId, setRecipientId] = useState<string>('+7 (999) 450-22-11');
  const [notes, setNotes] = useState<string>('Выплата вознаграждения');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [latestTx, setLatestTx] = useState<PayoutTransaction | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setAmount(preset.request.amount);
    setCurrency(preset.request.currency);
    setCountry(preset.request.country);
    setMethod(preset.request.method);
    setRecipientName(preset.request.recipient.name);
    setRecipientId(preset.request.recipient.accountIdentifier);
    setNotes(preset.request.notes || '');
  };

  // Preview Candidate calculation in real-time before clicking Execute
  const currentRequest: PayoutRequest = {
    id: 'req_preview',
    amount: Number(amount) || 0,
    currency,
    country,
    method,
    recipient: {
      name: recipientName,
      accountIdentifier: recipientId,
    },
    notes,
    createdAt: Date.now(),
  };

  const previewFilters = RouterEngine.filterProviders(currentRequest, providers);
  const previewPassed = previewFilters.filter((f) => f.passed).map((f) => f.provider);
  const previewScored = RouterEngine.scoreProviders(currentRequest, previewPassed, weights, rules);
  const previewRisk = RouterEngine.assessTransactionRisk(currentRequest);

  const handleRunRouting = async () => {
    if (amount <= 0) return;
    setIsProcessing(true);
    setActiveStep(1);

    const req: PayoutRequest = {
      id: `pay_${Date.now().toString().slice(-6)}`,
      amount: Number(amount),
      currency,
      country,
      method,
      recipient: {
        name: recipientName,
        accountIdentifier: recipientId,
      },
      notes,
      createdAt: Date.now(),
    };

    // 1. Filtering step visual pause
    const filterRes = RouterEngine.filterProviders(req, providers);
    const passed = filterRes.filter((r) => r.passed).map((r) => r.provider);

    await new Promise((r) => setTimeout(r, 400));
    setActiveStep(2);

    // 2. Scoring step visual pause
    const scored = RouterEngine.scoreProviders(req, passed, weights, rules);
    await new Promise((r) => setTimeout(r, 450));
    setActiveStep(3);

    // 3. Execution & Cascade
    const { transaction, updatedProviders } = await RouterEngine.executePayoutSimulation(
      req,
      filterRes,
      scored,
      providers,
      forcedFailures
    );

    await new Promise((r) => setTimeout(r, 400));
    setActiveStep(4);

    setIsProcessing(false);
    setLatestTx(transaction);
    onExecutePayout(transaction, updatedProviders);

    if (transaction.status === 'success' || transaction.status === 'fallback_success') {
      confetti({
        particleCount: transaction.status === 'fallback_success' ? 45 : 30,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10B981', '#6366F1', '#38BDF8'],
      });
    }
  };

  const toggleForcedFailure = (provId: string) => {
    setForcedFailures((prev) => ({
      ...prev,
      [provId]: !prev[provId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Presets Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Готовые сценарии выплат для тестирования
            </span>
          </div>
          <span className="text-xs text-slate-500">Нажмите для автозаполнения</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(preset)}
              className="text-left p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {preset.badge}
                </span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {preset.request.amount.toLocaleString()} {preset.request.currency}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                {preset.title}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {preset.request.method.toUpperCase()} • {preset.request.country}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form and Outage Simulator */}
        <div className="lg:col-span-4 space-y-5">
          {/* Payout Form Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                Параметры выплаты
              </h2>
              <span className="text-[11px] font-mono text-slate-400">Step 1: Input</span>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Amount & Currency */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Сумма и валюта выплаты
                </label>
                <div className="grid grid-cols-7 gap-2">
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="col-span-4 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="1000"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="col-span-3 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="RUB">RUB (₽)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USDT">USDT (₮)</option>
                    <option value="KZT">KZT (₸)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="TRY">TRY (₺)</option>
                  </select>
                </div>
              </div>

              {/* Country & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Страна получателя</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value as Country)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="RU">RU (Россия)</option>
                    <option value="US">US (США)</option>
                    <option value="EU">EU (Евросоюз)</option>
                    <option value="KZ">KZ (Казахстан)</option>
                    <option value="GB">GB (Великобритания)</option>
                    <option value="TR">TR (Турция)</option>
                    <option value="GLOBAL">GLOBAL (Весь мир)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Метод выплаты</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="sbp">СБП (Телефон)</option>
                    <option value="card">Банковская карта</option>
                    <option value="crypto">Крипто-кошелек</option>
                    <option value="bank_transfer">Банковский счет (SEPA/ACH)</option>
                    <option value="e_wallet">Электронный кошелек</option>
                  </select>
                </div>
              </div>

              {/* Recipient Details */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">Имя получателя</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="ФИО / Название контрагента"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Реквизит (Номер карты / СБП телефон / Кошелек)
                </label>
                <input
                  type="text"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="+7 999 000-00-00 или 4111 2222..."
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Назначение платежа</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="Оплата услуг по договору"
                />
              </div>

              {/* AML & Risk Assessment Live Preview */}
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                    Анализ риска (AML / Anti-Fraud):
                  </span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      previewRisk.riskLevel === 'LOW'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : previewRisk.riskLevel === 'MEDIUM'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {previewRisk.riskLevel} (Скор: {previewRisk.riskScore}/100)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                  {previewRisk.detectedBinInfo && (
                    <span className="bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded font-mono border border-indigo-500/20">
                      БИН {previewRisk.detectedBinInfo.bin}: {previewRisk.detectedBinInfo.brand} {previewRisk.detectedBinInfo.isDomesticRu ? '(РФ/МИР)' : ''}
                    </span>
                  )}
                  {previewRisk.requiresEnhancedKYC && (
                    <span className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-500/20">
                      115-ФЗ &gt; 600k₽
                    </span>
                  )}
                  {previewRisk.triggeredRules.length === 0 && (
                    <span className="text-slate-500">Чистый профиль транзакции</span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleRunRouting}
                disabled={isProcessing}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-indigo-500/30 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Repeat className="w-4 h-4 animate-spin text-white" />
                    <span>Маршрутизация и скоринг...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Запустить умный роутинг выплаты</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Simulated Fault Injection Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Симуляция сбоев (Тест Fallback)</span>
              </div>
              <span className="text-[10px] text-slate-400">Включите сбой</span>
            </div>
            <p className="text-slate-400 text-[11px] mb-3 leading-relaxed">
              Отметьте провайдера, чтобы принудительно сымитировать ошибку шлюза (504 Timeout / 422
              Declined). Система автоматически переключит выплату на следующего по рейтингу!
            </p>

            <div className="space-y-1.5">
              {providers.map((p) => {
                const isFailing = !!forcedFailures[p.id];
                return (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition ${
                      isFailing
                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isFailing}
                        onChange={() => toggleForcedFailure(p.id)}
                        className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                      />
                      <span className="font-semibold text-xs">{p.name}</span>
                    </div>
                    {isFailing && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                        Сбой активен
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Stages Pipeline */}
        <div className="lg:col-span-8 space-y-5">
          {/* Step 2: Filtering Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-xs font-bold font-mono">
                  1
                </span>
                <h3 className="text-sm font-bold text-white">
                  Фильтрация провайдеров (Hard Constraints)
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Допущено:{' '}
                <strong className="text-emerald-400">{previewPassed.length}</strong> из {providers.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              {previewFilters.map(({ provider, passed, reasons }) => (
                <div
                  key={provider.id}
                  className={`p-3 rounded-xl border transition ${
                    passed
                      ? 'bg-slate-950/60 border-emerald-500/30'
                      : 'bg-slate-950/30 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-200">{provider.name}</span>
                    {passed ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Допущен
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                        <XCircle className="w-3 h-3" /> Отсеян
                      </span>
                    )}
                  </div>

                  {passed ? (
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Комиссия: <strong className="text-slate-200">{provider.feePercent}%</strong></span>
                      <span>•</span>
                      <span>SLA: <strong className="text-slate-200">{provider.baseLatencyMs}ms</strong></span>
                      <span>•</span>
                      <span>Success: <strong className="text-teal-400">{provider.stats.successRate.toFixed(1)}%</strong></span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-400/90 font-medium">
                      {reasons.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Multi-Factor Scoring & Ranked Cascade Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono border border-indigo-500/40">
                  2
                </span>
                <h3 className="text-sm font-bold text-white">
                  Многофакторный скоринг и очередь каскада (Cascade Priority)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Веса: Fee {weights.feeWeight}%, Succ {weights.successRateWeight}%, SLA {weights.latencyWeight}%, Cap {weights.capacityWeight}%
              </span>
            </div>

            {previewScored.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800 text-xs">
                Нет доступных провайдеров под текущие критерии (проверьте валюту или сумму)
              </div>
            ) : (
              <div className="space-y-2.5">
                {previewScored.map((cand, idx) => {
                  const isLeader = idx === 0;
                  const isForcedOut = !!forcedFailures[cand.provider.id];

                  return (
                    <div
                      key={cand.provider.id}
                      className={`p-3.5 rounded-xl border transition ${
                        isLeader
                          ? 'bg-gradient-to-r from-indigo-950/40 via-slate-900 to-emerald-950/30 border-indigo-500/50 shadow-md'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold font-mono ${
                              isLeader
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            #{cand.rank}
                          </span>
                          <div>
                            <span className="font-bold text-white text-sm">
                              {cand.provider.name}
                            </span>
                            {isLeader && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Основной маршрут
                              </span>
                            )}
                            {idx === 1 && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                1st Fallback
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {isForcedOut && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              Simulated Error
                            </span>
                          )}
                          <div className="text-right">
                            <span className="text-xs text-slate-400 mr-1">Итоговый скор:</span>
                            <span className="text-sm font-mono font-black text-emerald-400">
                              {cand.totalScore.toFixed(1)} / 100
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Sub-scores breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Percent className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Комиссия: <strong className="text-white">{cand.calculatedFee} {currency} ({cand.effectiveFeePercent}%)</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                          <span>Success: <strong className="text-white">{cand.successScore.toFixed(1)}%</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-sky-400" />
                          <span>Скорость SLA: <strong className="text-white">{cand.estimatedLatencyMs}ms</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Запас лимита: <strong className="text-white">{cand.capacityScore.toFixed(0)}%</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 4: Live Execution Result & Cascading Fallback Animation */}
          {latestTx && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-300 flex items-center justify-center text-xs font-bold font-mono border border-emerald-500/40">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Результат выполнения и журнал Fallback каскада
                  </h3>
                </div>

                <div>
                  {latestTx.status === 'success' && (
                    <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Успех (С первой попытки)
                    </span>
                  )}
                  {latestTx.status === 'fallback_success' && (
                    <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <ShieldCheck className="w-3.5 h-3.5" /> Fallback Успешен (Попытка #{latestTx.totalAttempts})
                    </span>
                  )}
                  {latestTx.status === 'failed' && (
                    <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                      <XCircle className="w-3.5 h-3.5" /> Все попытки отклонены
                    </span>
                  )}
                </div>
              </div>

              {/* Cascade Timeline Steps */}
              <div className="space-y-2.5 mb-4">
                {latestTx.executionAttempts.map((att, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      att.status === 'success'
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          att.status === 'success'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        #{att.attemptNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">
                            {att.providerName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            ({att.latencyMs} ms)
                          </span>
                        </div>
                        {att.status === 'success' ? (
                          <p className="text-[11px] text-emerald-400 font-medium">
                            Выплата успешно проведена. Комиссия: {att.feeCharged} {latestTx.request.currency}
                          </p>
                        ) : (
                          <p className="text-[11px] text-rose-400 font-medium">
                            {att.errorMessage} (Код: {att.errorCode}) → Запущен автоматический Fallback
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] font-mono font-bold">
                      {att.status === 'success' ? '200 OK' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Economic Summary Banner */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Комиссия шлюза</span>
                  <span className="font-mono font-bold text-white">
                    {latestTx.totalFeeCharged} {latestTx.request.currency}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Тариф "по умолчанию"</span>
                  <span className="font-mono text-slate-400 line-through">
                    {latestTx.naiveDefaultFee} {latestTx.request.currency}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Экономия благодаря роутингу</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{latestTx.feeSaved} {latestTx.request.currency}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Общее время обработки</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {latestTx.totalLatencyMs} ms
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
