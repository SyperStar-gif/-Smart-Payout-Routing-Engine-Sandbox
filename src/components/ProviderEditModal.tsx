import React, { useState } from 'react';
import { Provider, ProviderStatus, Currency, Country, PaymentMethod } from '../types';
import { X, Check, Save } from 'lucide-react';

interface ProviderEditModalProps {
  provider: Provider;
  onClose: () => void;
  onSave: (updated: Provider) => void;
}

const ALL_CURRENCIES: Currency[] = ['RUB', 'USD', 'EUR', 'USDT', 'KZT', 'GBP', 'TRY'];
const ALL_COUNTRIES: Country[] = ['RU', 'US', 'EU', 'KZ', 'GB', 'TR', 'SG', 'AE', 'GLOBAL'];
const ALL_METHODS: PaymentMethod[] = ['sbp', 'card', 'crypto', 'bank_transfer', 'e_wallet'];

export const ProviderEditModal: React.FC<ProviderEditModalProps> = ({
  provider,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(provider.name);
  const [status, setStatus] = useState<ProviderStatus>(provider.status);
  const [feePercent, setFeePercent] = useState(provider.feePercent);
  const [feeFixed, setFeeFixed] = useState(provider.feeFixed);
  const [minAmount, setMinAmount] = useState(provider.minAmount);
  const [maxAmount, setMaxAmount] = useState(provider.maxAmount);
  const [dailyVolumeLimit, setDailyVolumeLimit] = useState(provider.dailyVolumeLimit);
  const [baseLatencyMs, setBaseLatencyMs] = useState(provider.baseLatencyMs);
  const [simulatedFailureRate, setSimulatedFailureRate] = useState(provider.simulatedFailureRate);

  const [supportedCurrencies, setSupportedCurrencies] = useState<Currency[]>(provider.supportedCurrencies);
  const [supportedCountries, setSupportedCountries] = useState<Country[]>(provider.supportedCountries);
  const [supportedMethods, setSupportedMethods] = useState<PaymentMethod[]>(provider.supportedMethods);

  const toggleCurrency = (cur: Currency) => {
    setSupportedCurrencies((prev) =>
      prev.includes(cur) ? prev.filter((c) => c !== cur) : [...prev, cur]
    );
  };

  const toggleCountry = (ctry: Country) => {
    setSupportedCountries((prev) =>
      prev.includes(ctry) ? prev.filter((c) => c !== ctry) : [...prev, ctry]
    );
  };

  const toggleMethod = (meth: PaymentMethod) => {
    setSupportedMethods((prev) =>
      prev.includes(meth) ? prev.filter((m) => m !== meth) : [...prev, meth]
    );
  };

  const handleSave = () => {
    const updated: Provider = {
      ...provider,
      name,
      status,
      feePercent: Number(feePercent),
      feeFixed: Number(feeFixed),
      minAmount: Number(minAmount),
      maxAmount: Number(maxAmount),
      dailyVolumeLimit: Number(dailyVolumeLimit),
      baseLatencyMs: Number(baseLatencyMs),
      simulatedFailureRate: Number(simulatedFailureRate),
      supportedCurrencies,
      supportedCountries,
      supportedMethods,
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">
              Настройка шлюза: {provider.name}
            </h3>
            <p className="text-xs text-slate-400 font-mono">Код: {provider.code}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Status & Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Название провайдера</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Рабочий статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProviderStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
              >
                <option value="active">Active (В работе)</option>
                <option value="degraded">Degraded (Замедлен)</option>
                <option value="maintenance">Maintenance (Тех. работы)</option>
                <option value="disabled">Disabled (Отключен)</option>
              </select>
            </div>
          </div>

          {/* Fees */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Комиссия (%)</label>
              <input
                type="number"
                step="0.1"
                value={feePercent}
                onChange={(e) => setFeePercent(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Фиксированная комиссия</label>
              <input
                type="number"
                step="0.1"
                value={feeFixed}
                onChange={(e) => setFeeFixed(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Мин. сумма транзакции</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Макс. сумма транзакции</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Суточный лимит объема</label>
              <input
                type="number"
                value={dailyVolumeLimit}
                onChange={(e) => setDailyVolumeLimit(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          {/* SLA & Failure simulation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Базовое SLA время (ms)</label>
              <input
                type="number"
                value={baseLatencyMs}
                onChange={(e) => setBaseLatencyMs(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Симулируемый шанс сбоя (0..1)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={simulatedFailureRate}
                onChange={(e) => setSimulatedFailureRate(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          {/* Supported Currencies Chips */}
          <div>
            <label className="block text-slate-400 font-medium mb-1.5">Поддерживаемые валюты</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CURRENCIES.map((cur) => {
                const isSelected = supportedCurrencies.includes(cur);
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => toggleCurrency(cur)}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {cur}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Supported Countries */}
          <div>
            <label className="block text-slate-400 font-medium mb-1.5">Поддерживаемые страны / регионы</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_COUNTRIES.map((ctry) => {
                const isSelected = supportedCountries.includes(ctry);
                return (
                  <button
                    key={ctry}
                    type="button"
                    onClick={() => toggleCountry(ctry)}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold transition text-[11px] ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {ctry}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Supported Methods */}
          <div>
            <label className="block text-slate-400 font-medium mb-1.5">Методы выплаты</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_METHODS.map((meth) => {
                const isSelected = supportedMethods.includes(meth);
                return (
                  <button
                    key={meth}
                    type="button"
                    onClick={() => toggleMethod(meth)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition uppercase ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {meth}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Сохранить параметры</span>
          </button>
        </div>
      </div>
    </div>
  );
};
