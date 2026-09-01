import React, { useState, useRef, useEffect } from 'react';
import {
  Provider,
  ScoringWeights,
  RoutingRule,
  PayoutTransaction,
  PayoutRequest,
  Currency,
  Country,
  PaymentMethod,
} from '../types';
import { RouterEngine } from '../services/routerEngine';
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  DollarSign,
  Zap,
  ShieldCheck,
} from 'lucide-react';

interface BatchSimulatorProps {
  providers: Provider[];
  weights: ScoringWeights;
  rules: RoutingRule[];
  onBatchTransactionsGenerated: (txs: PayoutTransaction[], updatedProviders: Provider[]) => void;
  forcedFailures: Record<string, boolean>;
}

const SAMPLE_CURRENCIES: Currency[] = ['RUB', 'USD', 'EUR', 'USDT', 'KZT', 'GBP'];
const SAMPLE_COUNTRIES: Country[] = ['RU', 'US', 'EU', 'KZ', 'GB', 'GLOBAL'];
const SAMPLE_METHODS: PaymentMethod[] = ['sbp', 'card', 'crypto', 'bank_transfer', 'e_wallet'];

export const BatchSimulatorView: React.FC<BatchSimulatorProps> = ({
  providers,
  weights,
  rules,
  onBatchTransactionsGenerated,
  forcedFailures,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<number>(300); // ms per payout
  const [batchCount, setBatchCount] = useState<number>(25);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [recentLiveLogs, setRecentLiveLogs] = useState<PayoutTransaction[]>([]);

  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const providersRef = useRef(providers);
  providersRef.current = providers;

  const generateRandomPayoutRequest = (): PayoutRequest => {
    const currency = SAMPLE_CURRENCIES[Math.floor(Math.random() * SAMPLE_CURRENCIES.length)];
    let country: Country = 'GLOBAL';
    let method: PaymentMethod = 'card';
    let amount = 500;

    if (currency === 'RUB') {
      country = Math.random() > 0.3 ? 'RU' : 'KZ';
      method = Math.random() > 0.35 ? 'sbp' : 'card';
      amount = Math.round(500 + Math.random() * 85000);
    } else if (currency === 'USDT') {
      country = 'GLOBAL';
      method = 'crypto';
      amount = Math.round(50 + Math.random() * 12000);
    } else if (currency === 'EUR') {
      country = 'EU';
      method = Math.random() > 0.5 ? 'bank_transfer' : 'card';
      amount = Math.round(100 + Math.random() * 8000);
    } else {
      country = SAMPLE_COUNTRIES[Math.floor(Math.random() * SAMPLE_COUNTRIES.length)];
      method = SAMPLE_METHODS[Math.floor(Math.random() * SAMPLE_METHODS.length)];
      amount = Math.round(20 + Math.random() * 4500);
    }

    return {
      id: `batch_${Date.now().toString().slice(-5)}_${Math.floor(Math.random() * 1000)}`,
      amount,
      currency,
      country,
      method,
      recipient: {
        name: `User #${Math.floor(1000 + Math.random() * 9000)}`,
        accountIdentifier: `ACC-${Math.floor(100000 + Math.random() * 900000)}`,
      },
      notes: 'Automated batch stream payout',
      createdAt: Date.now(),
    };
  };

  const runBatch = async (count: number) => {
    setIsRunning(true);
    let currentPool = [...providersRef.current];
    const generatedTxs: PayoutTransaction[] = [];

    for (let i = 0; i < count; i++) {
      if (!isRunningRef.current && i > 0) break;

      const req = generateRandomPayoutRequest();
      const filterRes = RouterEngine.filterProviders(req, currentPool);
      const passed = filterRes.filter((r) => r.passed).map((r) => r.provider);
      const scored = RouterEngine.scoreProviders(req, passed, weights, rules);

      const { transaction, updatedProviders } = await RouterEngine.executePayoutSimulation(
        req,
        filterRes,
        scored,
        currentPool,
        forcedFailures
      );

      currentPool = updatedProviders;
      generatedTxs.unshift(transaction);
      setRecentLiveLogs((prev) => [transaction, ...prev.slice(0, 19)]);
      setProcessedCount((prev) => prev + 1);

      await new Promise((r) => setTimeout(r, speed));
    }

    setIsRunning(false);
    onBatchTransactionsGenerated(generatedTxs, currentPool);
  };

  const runAtomicConcurrencyBatch = (count: number) => {
    setIsRunning(true);
    const requests: PayoutRequest[] = [];
    for (let i = 0; i < count; i++) {
      requests.push(generateRandomPayoutRequest());
    }

    const { transactions, updatedProviders, rejectedQuotaCount } =
      RouterEngine.simulateAtomicConcurrentBatch(requests, providersRef.current, {
        forcedFailures,
        rules,
        weights,
      });

    setRecentLiveLogs(transactions.slice(0, 20));
    setProcessedCount((prev) => prev + transactions.length);
    setIsRunning(false);
    onBatchTransactionsGenerated(transactions, updatedProviders);
  };

  const stopBatch = () => {
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Control Deck */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Генератор пакетных выплат & Нагрузочный стресс-тест
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Симулирует непрерывный поток разнородных выплат (СБП, Карты, USDT, SEPA) и проверяет
              балансировку нагрузки и срабатывание Fallback в реальном времени.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <>
                <button
                  onClick={() => runBatch(10)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                  <span>+10 Выплат</span>
                </button>
                <button
                  onClick={() => runBatch(50)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <FastForward className="w-3.5 h-3.5 text-indigo-400" />
                  <span>+50 Поток</span>
                </button>
                <button
                  onClick={() => runAtomicConcurrencyBatch(50)}
                  className="px-3.5 py-2 rounded-xl bg-teal-900/60 hover:bg-teal-800 text-teal-200 border border-teal-500/30 text-xs font-bold transition flex items-center gap-1.5"
                  title="Тестирует параллельные выплаты с атомарной проверкой суточного лимита и headroom"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>50x Headroom Batch</span>
                </button>
                <button
                  onClick={() => runBatch(100)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>+100 Стресс-тест</span>
                </button>
              </>
            ) : (
              <button
                onClick={stopBatch}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Приостановить поток</span>
              </button>
            )}
          </div>
        </div>

        {/* Speed & Tuning Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Интервал генерации: <strong className="text-indigo-400">{speed} ms</strong>
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-4 sm:col-span-2">
            <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Обработано в сессии</span>
              <span className="font-mono font-bold text-white text-sm">
                {processedCount.toLocaleString()} выплат
              </span>
            </div>
            <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Статус симулятора</span>
              <span className="font-mono font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                {isRunning ? 'Активный поток' : 'Ожидание'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stream Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Живая лента обработки транзакций
          </h3>
          <span className="text-xs text-slate-400">Последние {recentLiveLogs.length} событий</span>
        </div>

        {recentLiveLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Нажмите кнопку запуска пакета, чтобы начать потоковую симуляцию
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">ID / Время</th>
                  <th className="py-2.5 px-3">Сумма & Метод</th>
                  <th className="py-2.5 px-3">Страна</th>
                  <th className="py-2.5 px-3">Выбранный маршрут</th>
                  <th className="py-2.5 px-3">Попытки / Fallback</th>
                  <th className="py-2.5 px-3">Комиссия</th>
                  <th className="py-2.5 px-3">SLA Время</th>
                  <th className="py-2.5 px-3 text-right">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {recentLiveLogs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      {tx.id.replace('batch_', '')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      {tx.request.amount.toLocaleString()} {tx.request.currency}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {tx.request.method.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{tx.request.country}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-200">
                      {tx.finalProvider?.name || tx.selectedInitialProvider?.name || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {tx.totalAttempts > 1 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {tx.totalAttempts} попытки (Fallback)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          1 попытка
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">
                      {tx.totalFeeCharged} {tx.request.currency}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {tx.totalLatencyMs} ms
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {tx.status === 'success' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          OK
                        </span>
                      )}
                      {tx.status === 'fallback_success' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          RECOVERED
                        </span>
                      )}
                      {tx.status === 'failed' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          FAILED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
