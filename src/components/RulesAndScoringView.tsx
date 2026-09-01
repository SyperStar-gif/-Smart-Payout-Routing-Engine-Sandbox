import React, { useState } from 'react';
import { ScoringWeights, RoutingRule, Provider, Currency, Country, PaymentMethod } from '../types';
import {
  Sliders,
  Percent,
  TrendingUp,
  Clock,
  HardDrive,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Shield,
  ArrowUp,
  ArrowDown,
  Lock,
  Ban,
  Zap,
} from 'lucide-react';

interface RulesAndScoringViewProps {
  weights: ScoringWeights;
  onUpdateWeights: (weights: ScoringWeights) => void;
  rules: RoutingRule[];
  onUpdateRules: (rules: RoutingRule[]) => void;
  providers: Provider[];
}

const PRESET_WEIGHTS: Array<{
  name: string;
  description: string;
  weights: ScoringWeights;
}> = [
  {
    name: 'Сбалансированный (По умолчанию)',
    description: 'Оптимальный баланс между экономией и высокой скоростью конверсии',
    weights: { feeWeight: 35, successRateWeight: 35, latencyWeight: 15, capacityWeight: 15 },
  },
  {
    name: 'Экономия комиссий (Cost Minimizer)',
    description: 'Максимальный приоритет дешевым шлюзам для сокращения расходов',
    weights: { feeWeight: 60, successRateWeight: 25, latencyWeight: 5, capacityWeight: 10 },
  },
  {
    name: 'Максимальная надежность (VIP / 99.9% SLA)',
    description: 'Приоритет провайдерам с наивысшим историческим процентом успеха',
    weights: { feeWeight: 15, successRateWeight: 65, latencyWeight: 10, capacityWeight: 10 },
  },
  {
    name: 'Ультра-быстрые выплаты (Instant Speed)',
    description: 'Приоритет мгновенным межбанковским рельсам (СБП, TIPS)',
    weights: { feeWeight: 20, successRateWeight: 25, latencyWeight: 45, capacityWeight: 10 },
  },
];

export const RulesAndScoringView: React.FC<RulesAndScoringViewProps> = ({
  weights,
  onUpdateWeights,
  rules,
  onUpdateRules,
  providers,
}) => {
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [targetProviderId, setTargetProviderId] = useState(providers[0]?.id || '');
  const [actionType, setActionType] = useState<'boost_provider' | 'force_provider' | 'exclude_provider'>('boost_provider');
  const [filterCurrency, setFilterCurrency] = useState<string>('ALL');
  const [filterCountry, setFilterCountry] = useState<string>('ALL');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [boostMultiplier, setBoostMultiplier] = useState<number>(1.2);
  const [showAddForm, setShowAddForm] = useState(false);

  const totalWeight =
    weights.feeWeight + weights.successRateWeight + weights.latencyWeight + weights.capacityWeight;

  const handleSliderChange = (key: keyof ScoringWeights, value: number) => {
    onUpdateWeights({
      ...weights,
      [key]: value,
    });
  };

  const toggleRule = (id: string) => {
    onUpdateRules(
      rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const deleteRule = (id: string) => {
    onUpdateRules(rules.filter((r) => r.id !== id));
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= rules.length) return;

    const reordered = [...rules];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    // Recalculate priority numbers
    const updated = reordered.map((r, i) => ({ ...r, priority: i + 1 }));
    onUpdateRules(updated);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName) return;

    const newRule: RoutingRule = {
      id: `rule_${Date.now()}`,
      name: newRuleName,
      description: newRuleDesc || 'Пользовательское правило роутинга',
      enabled: true,
      priority: rules.length + 1,
      condition: {
        currency: filterCurrency !== 'ALL' ? (filterCurrency as Currency) : undefined,
        country: filterCountry !== 'ALL' ? (filterCountry as Country) : undefined,
        method: filterMethod !== 'ALL' ? (filterMethod as PaymentMethod) : undefined,
      },
      action: {
        type: actionType,
        targetProviderId,
        boostMultiplier: actionType === 'boost_provider' ? Number(boostMultiplier) : undefined,
      },
    };

    onUpdateRules([...rules, newRule]);
    setNewRuleName('');
    setNewRuleDesc('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Weights Tuning Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Конфигурация весов скоринга (Multi-Factor Scoring Formula)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Настройте относительное влияние каждого фактора в формуле выбора оптимального провайдера.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border ${
                totalWeight === 100
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              Сумма весов: {totalWeight}% {totalWeight === 100 ? '✓' : '(Не 100%)'}
            </span>
          </div>
        </div>

        {/* Preset Strategies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-5">
          {PRESET_WEIGHTS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => onUpdateWeights(preset.weights)}
              className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 text-left transition group"
            >
              <span className="text-xs font-bold text-slate-200 group-hover:text-white block mb-1">
                {preset.name}
              </span>
              <p className="text-[11px] text-slate-400 leading-snug mb-2">
                {preset.description}
              </p>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span className="text-emerald-400">F: {preset.weights.feeWeight}%</span>
                <span className="text-teal-400">S: {preset.weights.successRateWeight}%</span>
                <span className="text-sky-400">L: {preset.weights.latencyWeight}%</span>
                <span className="text-indigo-400">C: {preset.weights.capacityWeight}%</span>
              </div>
            </button>
          ))}
        </div>

        {/* 4 Weight Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-xs">
          {/* Fee Weight */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <Percent className="w-4 h-4 text-emerald-400" />
                <span>1. Комиссия за транзакцию (Fees)</span>
              </div>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {weights.feeWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={weights.feeWeight}
              onChange={(e) => handleSliderChange('feeWeight', Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              Максимизирует скоринг шлюзов с минимальной итоговой процентной и фикс. комиссией.
            </p>
          </div>

          {/* Success Rate Weight */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                <span>2. Исторический Success Rate</span>
              </div>
              <span className="font-mono font-bold text-teal-400 text-sm">
                {weights.successRateWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={weights.successRateWeight}
              onChange={(e) => handleSliderChange('successRateWeight', Number(e.target.value))}
              className="w-full accent-teal-500"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              Штрафует провайдеров с частыми отказами банков и повышает стабильные шлюзы.
            </p>
          </div>

          {/* Latency Weight */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>3. Скорость обработки (SLA / Latency)</span>
              </div>
              <span className="font-mono font-bold text-sky-400 text-sm">
                {weights.latencyWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={weights.latencyWeight}
              onChange={(e) => handleSliderChange('latencyWeight', Number(e.target.value))}
              className="w-full accent-sky-500"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              Повышает приоритет рельсам с мгновенным подтверждением (СБП 190ms vs Карты 450ms).
            </p>
          </div>

          {/* Capacity Headroom Weight */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <span>4. Запас суточного лимита (Capacity Headroom)</span>
              </div>
              <span className="font-mono font-bold text-indigo-400 text-sm">
                {weights.capacityWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={weights.capacityWeight}
              onChange={(e) => handleSliderChange('capacityWeight', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              Предотвращает исчерпание лимитов одного шлюза и плавно перераспределяет трафик.
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Rule Engine */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Динамические бизнес-правила (Rule Engine Overrides)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Специальные правила переопределения и повышающие коэффициенты для локальных методов и валют.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить правило</span>
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAddRule} className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-3">
            <h4 className="font-bold text-white">Новое правило маршрутизации</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Название правила</label>
                <input
                  type="text"
                  required
                  placeholder="Например: VIP буст для крипто-выплат"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Тип действия (Action)</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
                >
                  <option value="boost_provider">Повысить приоритет (Boost score)</option>
                  <option value="force_provider">Жестко назначить первым (Force Provider)</option>
                  <option value="exclude_provider">Исключить из маршрутизации (Exclude)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Целевой провайдер</label>
                <select
                  value={targetProviderId}
                  onChange={(e) => setTargetProviderId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {actionType === 'boost_provider' && (
                <div>
                  <label className="block text-slate-400 mb-1">Множитель скоринга (Boost 1.0 - 2.0x)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="2.0"
                    value={boostMultiplier}
                    onChange={(e) => setBoostMultiplier(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Фильтр валюты</label>
                <select
                  value={filterCurrency}
                  onChange={(e) => setFilterCurrency(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="ALL">Любая валюта</option>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="USDT">USDT</option>
                  <option value="KZT">KZT</option>
                  <option value="GBP">GBP</option>
                  <option value="TRY">TRY</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Фильтр страны</label>
                <select
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="ALL">Любая страна</option>
                  <option value="RU">RU (Россия)</option>
                  <option value="US">US (США)</option>
                  <option value="EU">EU (Европа)</option>
                  <option value="KZ">KZ (Казахстан)</option>
                  <option value="GB">GB (Великобритания)</option>
                  <option value="TR">TR (Турция)</option>
                  <option value="SG">SG (Сингапур)</option>
                  <option value="AE">AE (ОАЭ)</option>
                  <option value="GLOBAL">GLOBAL</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Фильтр метода</label>
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="ALL">Любой метод</option>
                  <option value="sbp">СБП</option>
                  <option value="card">Карта</option>
                  <option value="crypto">Крипто</option>
                  <option value="bank_transfer">SEPA / ACH</option>
                  <option value="e_wallet">Эл. кошельки</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30"
              >
                Создать правило
              </button>
            </div>
          </form>
        )}

        {/* Existing Rules Table */}
        <div className="space-y-3">
          {rules.map((rule, index) => {
            const targetProv = providers.find((p) => p.id === rule.action.targetProviderId);

            return (
              <div
                key={rule.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                  rule.enabled
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-950/20 border-slate-900 opacity-50'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  {/* Priority order controls */}
                  <div className="flex flex-col items-center gap-0.5 pt-0.5 sm:pt-0">
                    <button
                      onClick={() => movePriority(index, 'up')}
                      disabled={index === 0}
                      className="text-slate-500 hover:text-white disabled:opacity-20 p-0.5"
                      title="Повысить приоритет"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1 rounded">
                      #{rule.priority || index + 1}
                    </span>
                    <button
                      onClick={() => movePriority(index, 'down')}
                      disabled={index === rules.length - 1}
                      className="text-slate-500 hover:text-white disabled:opacity-20 p-0.5"
                      title="Понизить приоритет"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => toggleRule(rule.id)}
                    className="text-slate-400 hover:text-white mt-1 sm:mt-0"
                  >
                    {rule.enabled ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{rule.name}</h4>
                      {rule.action.type === 'force_provider' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1 font-mono">
                          <Lock className="w-2.5 h-2.5" /> FORCE
                        </span>
                      )}
                      {rule.action.type === 'exclude_provider' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1 font-mono">
                          <Ban className="w-2.5 h-2.5" /> EXCLUDE
                        </span>
                      )}
                      {rule.action.type === 'boost_provider' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 font-mono">
                          <Zap className="w-2.5 h-2.5" /> BOOST
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400">{rule.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] font-mono text-slate-400">
                      {rule.condition.currency && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300">
                          Cur: {rule.condition.currency}
                        </span>
                      )}
                      {rule.condition.country && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-teal-300">
                          Country: {rule.condition.country}
                        </span>
                      )}
                      {rule.condition.method && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 uppercase">
                          {rule.condition.method}
                        </span>
                      )}
                      {targetProv && rule.action.type === 'boost_provider' && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          +{(rule.action.boostMultiplier || 1.2)}x к скору {targetProv.name}
                        </span>
                      )}
                      {targetProv && rule.action.type === 'force_provider' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Принудительно направлять в {targetProv.name}
                        </span>
                      )}
                      {targetProv && rule.action.type === 'exclude_provider' && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          Исключить {targetProv.name} из выборки
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    title="Удалить правило"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
