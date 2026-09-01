import React, { useState } from 'react';
import { PayoutTransaction, Provider } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { TransactionDetailModal } from './TransactionDetailModal';

interface AnalyticsViewProps {
  transactions: PayoutTransaction[];
  providers: Provider[];
}

const COLORS = ['#6366F1', '#10B981', '#06B6D4', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6'];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ transactions, providers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'success' | 'fallback_success' | 'failed'>('ALL');
  const [selectedTx, setSelectedTx] = useState<PayoutTransaction | null>(null);

  // Compute stats
  const totalTxs = transactions.length;
  const directSuccess = transactions.filter((t) => t.status === 'success').length;
  const fallbackSuccess = transactions.filter((t) => t.status === 'fallback_success').length;
  const failedCount = transactions.filter((t) => t.status === 'failed').length;
  const totalVolume = transactions.reduce((acc, t) => acc + (t.status !== 'failed' ? t.request.amount : 0), 0);
  const totalFeeSaved = transactions.reduce((acc, t) => acc + t.feeSaved, 0);

  // AML Stats
  const highRiskTxs = transactions.filter((t) => t.riskAssessment?.riskLevel === 'HIGH').length;
  const mediumRiskTxs = transactions.filter((t) => t.riskAssessment?.riskLevel === 'MEDIUM').length;
  const kycFlaggedTxs = transactions.filter((t) => t.riskAssessment?.requiresEnhancedKYC).length;

  // Chart 1: Provider Volume Share
  const providerVolumeData = providers.map((p) => ({
    name: p.name.split(' ')[0],
    volume: p.stats.volumeProcessed,
    successRate: p.stats.successRate,
  }));

  // Chart 2: Status distribution
  const statusPieData = [
    { name: 'Прямой успех', value: directSuccess, color: '#10B981' },
    { name: 'Fallback спасено', value: fallbackSuccess, color: '#F59E0B' },
    { name: 'Отказы', value: failedCount, color: '#EF4444' },
  ].filter((d) => d.value > 0);

  // Chart 3: Provider Latency comparison
  const latencyData = providers.map((p) => ({
    name: p.code,
    latency: p.stats.avgLatencyMs,
    base: p.baseLatencyMs,
  }));

  // Filter transactions
  const filteredTxs = transactions.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.request.recipient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.request.amount.toString().includes(searchQuery) ||
      t.request.currency.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.finalProvider?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.riskAssessment?.riskLevel || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(transactions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `payout_audit_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] text-slate-400 font-semibold block mb-1">
            Всего выплачено через систему
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-mono font-black text-white">
              ${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {totalTxs} выплат
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] text-slate-400 font-semibold block mb-1">
            Сэкономлено на комиссиях
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-mono font-black text-emerald-400">
              +${totalFeeSaved.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded-full">
              vs Default Naive
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] text-slate-400 font-semibold block mb-1">
            Спасено через Fallback Каскад
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-mono font-black text-amber-400">
              {fallbackSuccess} выплат
            </span>
            <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
              Авто-восстановление
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] text-slate-400 font-semibold block mb-1">
            Итоговый Conversion Rate
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-mono font-black text-teal-400">
              {totalTxs > 0 ? (((directSuccess + fallbackSuccess) / totalTxs) * 100).toFixed(1) : '100.0'}%
            </span>
            <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">
              SLA Met
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Volume by Provider */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-1">Объем выплат по шлюзам</h3>
          <p className="text-xs text-slate-400 mb-4">
            Динамическое распределение объема в зависимости от скоринга
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerVolumeData}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Bar dataKey="volume" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Latency Benchmark */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-1">Скорость обработки (SLA Latency, ms)</h3>
          <p className="text-xs text-slate-400 mb-4">
            Среднее время ответа шлюзов по скользящему среднему (EWMA)
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latencyData}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Bar dataKey="latency" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Conversion & AML Risk */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Конверсия & AML Профиль</h3>
            <p className="text-xs text-slate-400 mb-2">
              Статусы исполнения и оценка рисков транзакций
            </p>
          </div>

          <div className="h-40">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={55}
                    innerRadius={30}
                    paddingAngle={3}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Нет данных для диаграммы
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-1 text-[10px] text-center">
            <div className="bg-slate-950 p-1.5 rounded-lg">
              <span className="text-slate-400 block">Low Risk</span>
              <span className="font-bold text-emerald-400 font-mono">
                {totalTxs - highRiskTxs - mediumRiskTxs}
              </span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded-lg">
              <span className="text-slate-400 block">Med/High</span>
              <span className="font-bold text-amber-400 font-mono">
                {mediumRiskTxs + highRiskTxs}
              </span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded-lg">
              <span className="text-slate-400 block">115-ФЗ KYC</span>
              <span className="font-bold text-teal-400 font-mono">{kycFlaggedTxs}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Журнал транзакций & Аудит решений (Transaction Ledger)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Каждая выплата содержит полный аудит-трейс принятого решения
            </p>
          </div>

          <button
            onClick={exportJSON}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт JSON</span>
          </button>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 my-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Поиск по ID, имени получателя, сумме, провайдеру..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                statusFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setStatusFilter('success')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                statusFilter === 'success' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Прямой успех
            </button>
            <button
              onClick={() => setStatusFilter('fallback_success')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                statusFilter === 'fallback_success' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fallback
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                statusFilter === 'failed' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Отказы
            </button>
          </div>
        </div>

        {/* Table */}
        {filteredTxs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Нет транзакций, удовлетворяющих условиям фильтра
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">ID / Дата</th>
                  <th className="py-2.5 px-3">Сумма</th>
                  <th className="py-2.5 px-3">Получатель & Метод</th>
                  <th className="py-2.5 px-3">Выбранный шлюз</th>
                  <th className="py-2.5 px-3">Каскад</th>
                  <th className="py-2.5 px-3">Комиссия</th>
                  <th className="py-2.5 px-3">Экономия</th>
                  <th className="py-2.5 px-3">Статус</th>
                  <th className="py-2.5 px-3 text-right">Детали</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      {tx.id}
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {tx.request.amount.toLocaleString()} {tx.request.currency}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-slate-200 font-semibold block truncate max-w-[140px]">
                        {tx.request.recipient.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          {tx.request.method} • {tx.request.country}
                        </span>
                        {tx.riskAssessment && tx.riskAssessment.riskLevel === 'HIGH' && (
                          <span className="text-[9px] font-bold px-1 rounded bg-rose-500/20 text-rose-300 font-mono">
                            HIGH RISK
                          </span>
                        )}
                        {tx.riskAssessment && tx.riskAssessment.riskLevel === 'MEDIUM' && (
                          <span className="text-[9px] font-bold px-1 rounded bg-amber-500/20 text-amber-300 font-mono">
                            MED
                          </span>
                        )}
                        {tx.riskAssessment?.requiresEnhancedKYC && (
                          <span className="text-[9px] font-bold px-1 rounded bg-teal-500/20 text-teal-300 font-mono">
                            115-ФЗ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-200">
                      {tx.finalProvider?.name || tx.selectedInitialProvider?.name || '—'}
                    </td>
                    <td className="py-3 px-3">
                      {tx.totalAttempts > 1 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {tx.totalAttempts}x Fallback
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          1st Try
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400">
                      {tx.totalFeeCharged} {tx.request.currency}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-teal-400">
                      +{tx.feeSaved} {tx.request.currency}
                    </td>
                    <td className="py-3 px-3">
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
                          FAIL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Посмотреть полный аудит-трейс"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTx && (
        <TransactionDetailModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />
      )}
    </div>
  );
};
