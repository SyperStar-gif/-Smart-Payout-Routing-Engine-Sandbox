import React, { useState } from 'react';
import { Provider, HealthCheckConfig } from '../types';
import { RouterEngine } from '../services/routerEngine';
import {
  Cpu,
  Settings2,
  TrendingUp,
  Percent,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  Shield,
  Layers,
  Activity,
  Radio,
  RefreshCw,
  Sliders,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ProviderEditModal } from './ProviderEditModal';

interface ProvidersViewProps {
  providers: Provider[];
  onUpdateProvider: (updated: Provider) => void;
  forcedFailures: Record<string, boolean>;
  setForcedFailures: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  healthConfig: HealthCheckConfig;
  onUpdateHealthConfig: (config: HealthCheckConfig) => void;
  onRunHealthProbeNow: () => void;
  onRunSingleProbe: (providerId: string) => void;
  isProbing?: boolean;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  providers,
  onUpdateProvider,
  forcedFailures,
  setForcedFailures,
  healthConfig,
  onUpdateHealthConfig,
  onRunHealthProbeNow,
  onRunSingleProbe,
  isProbing = false,
}) => {
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [probingProviderId, setProbingProviderId] = useState<string | null>(null);

  const toggleForcedFailure = (id: string) => {
    setForcedFailures((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStatusChange = (provider: Provider, status: Provider['status']) => {
    onUpdateProvider({ ...provider, status });
  };

  const handleSingleProbe = (providerId: string) => {
    setProbingProviderId(providerId);
    onRunSingleProbe(providerId);
    setTimeout(() => {
      setProbingProviderId(null);
    }, 400);
  };

  const activeCount = providers.filter((p) => p.status === 'active').length;
  const degradedCount = providers.filter((p) => p.status === 'degraded').length;
  const offlineCount = providers.filter((p) => p.status === 'disabled').length;
  const maintenanceCount = providers.filter((p) => p.status === 'maintenance').length;

  const avgProbeLatency = Math.round(
    providers.reduce((acc, p) => acc + (p.healthCheck?.latencyMs || p.baseLatencyMs), 0) /
      (providers.length || 1)
  );

  return (
    <div className="space-y-6">
      {/* Overview & Automated Health-Check Monitor Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">
                Реестр платёжных шлюзов & Периодический Health-Check
              </h2>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Radio className={`w-3 h-3 ${healthConfig.enabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                {healthConfig.enabled ? `Авто-проба: каждые ${healthConfig.intervalSeconds}с` : 'Авто-проба: выкл'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Периодический опрос шлюзов в реальном времени. Автоматически переводит шлюзы в статус{' '}
              <strong className="text-amber-400">Degraded</strong> (задержка &gt; {healthConfig.latencyThresholdDegraded}ms) или{' '}
              <strong className="text-rose-400">Offline</strong> (&gt; {healthConfig.latencyThresholdOffline}ms) для защиты каскада.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => setShowConfigDrawer(!showConfigDrawer)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Пороги SLA</span>
            </button>

            <button
              onClick={onRunHealthProbeNow}
              disabled={isProbing}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
              <span>{isProbing ? 'Пингуем...' : 'Пинг всех шлюзов'}</span>
            </button>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">🟢 ONLINE (200 OK)</span>
              <span className="text-lg font-mono font-bold text-emerald-400">{activeCount}</span>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500/40" />
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">🟡 DEGRADED (SLA)</span>
              <span className="text-lg font-mono font-bold text-amber-400">{degradedCount}</span>
            </div>
            <AlertTriangle className="w-5 h-5 text-amber-500/40" />
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">🔴 OFFLINE / TIMEOUT</span>
              <span className="text-lg font-mono font-bold text-rose-400">{offlineCount}</span>
            </div>
            <XCircle className="w-5 h-5 text-rose-500/40" />
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">⚡ СРЕДНИЙ ПИНГ ПУЛА</span>
              <span className="text-lg font-mono font-bold text-teal-400">{avgProbeLatency} ms</span>
            </div>
            <Activity className="w-5 h-5 text-teal-500/40" />
          </div>
        </div>

        {/* Threshold & Health Config Drawer */}
        {showConfigDrawer && (
          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Настройки периодического Health-Check & Пороги перехода статусов
              </span>
              <button
                onClick={() => setShowConfigDrawer(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Автоматическая проверка
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      onUpdateHealthConfig({ ...healthConfig, enabled: !healthConfig.enabled })
                    }
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                      healthConfig.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {healthConfig.enabled ? 'Включена (ON)' : 'Выключена (OFF)'}
                  </button>
                  <select
                    value={healthConfig.intervalSeconds}
                    onChange={(e) =>
                      onUpdateHealthConfig({
                        ...healthConfig,
                        intervalSeconds: Number(e.target.value),
                      })
                    }
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-semibold"
                  >
                    <option value={3}>Каждые 3 сек</option>
                    <option value={5}>Каждые 5 сек</option>
                    <option value={10}>Каждые 10 сек</option>
                    <option value={30}>Каждые 30 сек</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 font-semibold">Порог Degraded (SLA)</span>
                  <span className="font-mono text-amber-400 font-bold">
                    &gt; {healthConfig.latencyThresholdDegraded} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="250"
                  max="650"
                  step="25"
                  value={healthConfig.latencyThresholdDegraded}
                  onChange={(e) =>
                    onUpdateHealthConfig({
                      ...healthConfig,
                      latencyThresholdDegraded: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 font-semibold">Порог Offline (Timeout)</span>
                  <span className="font-mono text-rose-400 font-bold">
                    &gt; {healthConfig.latencyThresholdOffline} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="650"
                  max="1200"
                  step="50"
                  value={healthConfig.latencyThresholdOffline}
                  onChange={(e) =>
                    onUpdateHealthConfig({
                      ...healthConfig,
                      latencyThresholdOffline: Number(e.target.value),
                    })
                  }
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid of Providers with Live Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {providers.map((provider) => {
          const usedDailyPct = Math.min(
            100,
            Math.round((provider.currentDailyVolume / provider.dailyVolumeLimit) * 100)
          );
          const isFailing = !!forcedFailures[provider.id];
          const isThisProbing = probingProviderId === provider.id;

          const probeLatency = provider.healthCheck?.latencyMs || provider.baseLatencyMs;
          const isHealthy = provider.healthCheck?.isHealthy ?? provider.status === 'active';
          const cbState = RouterEngine.evaluateCircuitBreaker(provider);

          return (
            <div
              key={provider.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-xl flex flex-col justify-between transition ${
                provider.status === 'disabled'
                  ? 'border-rose-500/40 bg-rose-950/10'
                  : provider.status === 'degraded'
                  ? 'border-amber-500/40 bg-amber-950/10'
                  : provider.status === 'maintenance'
                  ? 'border-slate-700 bg-slate-900/60'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top Header & Status Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: provider.color || '#6366F1' }}
                      />
                      <h3 className="text-sm font-bold text-white">{provider.name}</h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {provider.code} • {provider.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Circuit Breaker Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        cbState.state === 'CLOSED'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : cbState.state === 'HALF_OPEN'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                      }`}
                      title={`Circuit Breaker: ${cbState.state} (Отказов подряд: ${cbState.consecutiveFailures})`}
                    >
                      CB: {cbState.state}
                    </span>

                    {/* Live Health Badge */}
                    {provider.status === 'active' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ONLINE
                      </span>
                    )}
                    {provider.status === 'degraded' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        DEGRADED
                      </span>
                    )}
                    {provider.status === 'disabled' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        OFFLINE
                      </span>
                    )}
                    {provider.status === 'maintenance' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        MAINT.
                      </span>
                    )}

                    <button
                      onClick={() => setEditingProvider(provider)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Настроить параметры и лимиты"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Health Check Diagnostics Card */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/90 mb-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-semibold text-slate-300 text-[11px]">
                        Пинг-отклик шлюза:
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                          probeLatency > healthConfig.latencyThresholdOffline
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : probeLatency > healthConfig.latencyThresholdDegraded
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        ⚡ {probeLatency} ms
                      </span>

                      <button
                        onClick={() => handleSingleProbe(provider.id)}
                        disabled={isThisProbing}
                        title="Пропинговать этот шлюз сейчас"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isThisProbing ? 'animate-spin text-teal-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Health message */}
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    {provider.healthCheck?.message || 'Ожидание первого опроса health-check...'}
                  </p>

                  {/* Latency History Sparkline */}
                  {provider.healthHistory && provider.healthHistory.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>История откликов (последние пробы)</span>
                        <span className="font-mono">Базовое: {provider.baseLatencyMs}ms</span>
                      </div>
                      <div className="flex items-end gap-1 h-7 bg-slate-900/80 p-1 rounded-lg">
                        {provider.healthHistory.map((h, idx) => {
                          const maxH = 800;
                          const heightPct = Math.min(100, Math.max(15, (h.latencyMs / maxH) * 100));
                          const barColor =
                            h.latencyMs > healthConfig.latencyThresholdOffline
                              ? 'bg-rose-500'
                              : h.latencyMs > healthConfig.latencyThresholdDegraded
                              ? 'bg-amber-500'
                              : 'bg-emerald-500';

                          return (
                            <div
                              key={idx}
                              title={`${new Date(h.timestamp).toLocaleTimeString()}: ${h.latencyMs}ms (${h.status})`}
                              className={`flex-1 rounded-t transition-all ${barColor}`}
                              style={{ height: `${heightPct}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {provider.description}
                </p>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-4 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1 text-[11px]">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Success Rate</span>
                    </div>
                    <span className="font-mono font-black text-sm text-emerald-400">
                      {provider.stats.successRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {provider.stats.successfulPayouts} из {provider.stats.totalPayouts}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>EWMA Скорость</span>
                    </div>
                    <span className="font-mono font-black text-sm text-sky-400">
                      {provider.stats.avgLatencyMs} ms
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      С учётом проб health-check
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1 text-[11px]">
                      <Percent className="w-3.5 h-3.5 text-amber-400" />
                      <span>Тариф</span>
                    </div>
                    <span className="font-mono font-bold text-xs text-white">
                      {provider.feePercent}% + ${provider.feeFixed}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Лимит: ${provider.minAmount} - ${provider.maxAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1 text-[11px]">
                      <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Суточный лимит</span>
                    </div>
                    <span className="font-mono font-bold text-xs text-white">
                      {usedDailyPct}% использовано
                    </span>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          usedDailyPct > 80
                            ? 'bg-rose-500'
                            : usedDailyPct > 50
                            ? 'bg-amber-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${usedDailyPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Supported tags */}
                <div className="space-y-1.5 mb-4 text-[11px]">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-slate-400 text-[10px] mr-1">Валюты:</span>
                    {provider.supportedCurrencies.map((c) => (
                      <span
                        key={c}
                        className="px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-slate-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-slate-400 text-[10px] mr-1">Методы:</span>
                    {provider.supportedMethods.map((m) => (
                      <span
                        key={m}
                        className="px-1.5 py-0.2 rounded uppercase text-[10px] font-bold bg-slate-800/80 text-teal-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action bar with Status Override & Failure Simulation */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <select
                  value={provider.status}
                  onChange={(e) => handleStatusChange(provider, e.target.value as Provider['status'])}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-[11px] font-semibold"
                >
                  <option value="active">🟢 Active</option>
                  <option value="degraded">🟡 Degraded</option>
                  <option value="maintenance">🟠 Maint.</option>
                  <option value="disabled">🔴 Disabled</option>
                </select>

                <button
                  onClick={() => toggleForcedFailure(provider.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                    isFailing
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {isFailing ? 'Сбой активен' : 'Тест сбоя'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingProvider && (
        <ProviderEditModal
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSave={onUpdateProvider}
        />
      )}
    </div>
  );
};

