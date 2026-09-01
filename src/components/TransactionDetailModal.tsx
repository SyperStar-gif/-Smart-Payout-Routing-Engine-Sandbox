import React from 'react';
import { PayoutTransaction } from '../types';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface TransactionDetailModalProps {
  transaction: PayoutTransaction;
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
}) => {
  const req = transaction.request;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-base">
                Транзакция {transaction.id}
              </span>
              {transaction.status === 'success' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  SUCCESS (Direct)
                </span>
              )}
              {transaction.status === 'fallback_success' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  FALLBACK RECOVERED
                </span>
              )}
              {transaction.status === 'failed' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  FAILED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Создано: {new Date(transaction.createdAt).toLocaleTimeString()} • Общее время:{' '}
              <strong className="text-indigo-400">{transaction.totalLatencyMs}ms</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 text-xs">
          {/* Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block">Сумма выплаты</span>
              <span className="font-mono font-bold text-white text-sm">
                {req.amount.toLocaleString()} {req.currency}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Метод & Страна</span>
              <span className="font-bold text-slate-200 uppercase">
                {req.method} ({req.country})
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Итоговая комиссия</span>
              <span className="font-mono font-bold text-emerald-400">
                {transaction.totalFeeCharged} {req.currency}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Экономия на роутинге</span>
              <span className="font-mono font-bold text-teal-400">
                +{transaction.feeSaved} {req.currency}
              </span>
            </div>
          </div>

          {/* Recipient info */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
              Получатель выплаты
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-200">{req.recipient.name}</span>
              <span className="font-mono text-indigo-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {req.recipient.accountIdentifier}
              </span>
            </div>
          </div>

          {/* Risk Assessment & AML Profiling */}
          {transaction.riskAssessment && (
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  AML Профилирование и Антифрод (Risk Engine)
                </span>
                <span
                  className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                    transaction.riskAssessment.riskLevel === 'LOW'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : transaction.riskAssessment.riskLevel === 'MEDIUM'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  Уровень: {transaction.riskAssessment.riskLevel} (Скор: {transaction.riskAssessment.riskScore}/100)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                {transaction.riskAssessment.detectedBinInfo && (
                  <span className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded font-mono border border-indigo-500/20">
                    БИН {transaction.riskAssessment.detectedBinInfo.bin} ({transaction.riskAssessment.detectedBinInfo.brand})
                    {transaction.riskAssessment.detectedBinInfo.isDomesticRu ? ' • РФ Domestic' : ''}
                  </span>
                )}
                {transaction.riskAssessment.requiresEnhancedKYC && (
                  <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-500/20">
                    115-ФЗ: Крупная транзакция &gt; 600,000 RUB
                  </span>
                )}
                {transaction.riskAssessment.triggeredRules.map((rule, rIdx) => (
                  <span key={rIdx} className="bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono text-[10px]">
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cascading Execution Attempts */}
          <div>
            <h4 className="font-bold text-white mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Каскадные попытки выполнения (Execution Cascade)
            </h4>
            <div className="space-y-2">
              {transaction.executionAttempts.map((att, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    att.status === 'success'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        att.status === 'success' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                      }`}
                    >
                      #{att.attemptNumber}
                    </span>
                    <div>
                      <span className="font-bold text-white text-xs">{att.providerName}</span>
                      <span className="text-[10px] text-slate-400 ml-2">({att.latencyMs} ms)</span>
                      {att.status === 'failed' && (
                        <p className="text-[11px] text-rose-400 mt-0.5">{att.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-bold">
                    {att.status === 'success' ? 'SUCCESS 200' : 'DECLINED'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Trace Logs */}
          <div>
            <h4 className="font-bold text-white mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              Полный аудит-лог принятия решений (Audit Trace)
            </h4>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 font-mono text-[11px] max-h-48 overflow-y-auto">
              {transaction.traceLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-500 text-[10px]">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span
                    className={`font-bold uppercase text-[10px] px-1 py-0.2 rounded ${
                      log.stage === 'VALIDATION'
                        ? 'bg-slate-800 text-slate-300'
                        : log.stage === 'FILTERING'
                        ? 'bg-amber-500/10 text-amber-400'
                        : log.stage === 'SCORING'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : log.stage === 'FALLBACK'
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    {log.stage}
                  </span>
                  <span className="text-slate-300 flex-1">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
