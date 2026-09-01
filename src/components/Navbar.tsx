import React from 'react';
import {
  Zap,
  Layers,
  Cpu,
  Sliders,
  BarChart3,
  Code2,
  Activity,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export type ActiveTab =
  | 'live'
  | 'batch'
  | 'providers'
  | 'rules'
  | 'analytics'
  | 'tests'
  | 'ruby';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  totalVolume: number;
  totalTransactions: number;
  successRate: number;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalVolume,
  totalTransactions,
  successRate,
  onResetData,
}) => {
  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    { id: 'live', label: 'Живой роутинг & Каскад', icon: <Zap className="w-4 h-4" />, badge: 'Live' },
    { id: 'batch', label: 'Пакетный стресс-тест', icon: <Activity className="w-4 h-4" /> },
    { id: 'providers', label: 'Провайдеры и шлюзы', icon: <Cpu className="w-4 h-4" /> },
    { id: 'rules', label: 'Веса и правила', icon: <Sliders className="w-4 h-4" /> },
    { id: 'analytics', label: 'Журнал & Аналитика', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'tests', label: 'Тесты & Покрытие', icon: <ShieldCheck className="w-4 h-4" />, badge: '99% Cover' },
    { id: 'ruby', label: 'Код на Ruby (Strategy)', icon: <Code2 className="w-4 h-4" />, badge: 'Backend' },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-bold">
              <Zap className="w-6 h-6 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">
                  Smart Payout Router
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.4 Production
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Динамический скоринг & каскадный fallback
              </p>
            </div>
          </div>

          {/* Real-time System Metrics */}
          <div className="hidden lg:flex items-center gap-6 text-xs bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2">
            <div>
              <span className="text-slate-400 block text-[10px]">Всего транзакций</span>
              <span className="font-mono font-bold text-slate-200">
                {totalTransactions.toLocaleString()}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-400 block text-[10px]">Общий объем</span>
              <span className="font-mono font-bold text-emerald-400">
                ${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-400 block text-[10px]">Success Rate</span>
              <span className="font-mono font-bold text-teal-400">
                {successRate.toFixed(1)}%
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Cascade Active</span>
            </div>
          </div>

          {/* Reset Action */}
          <button
            onClick={onResetData}
            title="Сбросить состояние к начальным значениям"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-2.5 py-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сбросить метрики</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto no-scrollbar py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
