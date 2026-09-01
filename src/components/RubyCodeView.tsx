import React, { useState } from 'react';
import { RUBY_CODE_FILES, RubyCodeFile } from '../data/rubyCodeTemplates';
import {
  Code2,
  Copy,
  Check,
  FileCode,
  Layers,
  Cpu,
  GitBranch,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

export const RubyCodeView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<RubyCodeFile>(RUBY_CODE_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Architecture Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-rose-400" />
              <h2 className="text-base font-bold text-white">
                Архитектура на Ruby & Паттерн Strategy
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                Ruby 3.3+ / Rails / Sidekiq
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Реализация из технического задания: изолированные классы провайдеров с единым контрактом{' '}
              <code className="text-rose-300 font-mono">#process_payout(payout)</code>, сервис скоринга{' '}
              <code className="text-rose-300 font-mono">PayoutRouter</code> и асинхронный воркер{' '}
              <code className="text-rose-300 font-mono">PayoutExecutionWorker</code> для безопасных
              повторов и автоматического Fallback.
            </p>
          </div>
        </div>

        {/* 3 Architecture Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
              <Layers className="w-4 h-4" />
              <span>1. Strategy Pattern</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Каждый шлюз инкапсулирован в собственный класс (`StripeProvider`, `SbpProvider`, `CryptoPayProvider`),
              что позволяет подключать новые шлюзы без изменения логики ядра.
            </p>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1">
              <Cpu className="w-4 h-4" />
              <span>2. Multi-Factor Scoring</span>
            </div>
            <p className="text-[11px] text-slate-400">
              `PayoutRouter` производит предварительную фильтрацию, рассчитывает интегральный балл (Fee, SLA,
              Success Rate, Daily Cap) и выстраивает упорядоченный каскад кандидатов.
            </p>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>3. Idempotent Fallback Queue</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sidekiq воркер с Redis распределенной блокировкой (`RedisLock`) исключает риск двойного
              списания и обеспечивает непрерывный переход при таймаутах (504/422).
            </p>
          </div>
        </div>
      </div>

      {/* Code Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* File Navigator */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Файлы проекта (Rails structure)
          </h3>
          <div className="space-y-1">
            {RUBY_CODE_FILES.map((file) => {
              const isSelected = selectedFile.filename === file.filename;
              return (
                <button
                  key={file.filename}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500/60 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 font-mono font-bold text-[11px]">
                      <FileCode className="w-3.5 h-3.5 text-rose-400" />
                      <span className="truncate">{file.filename.split('/').pop()}</span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {file.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate pl-5">
                    {file.filename}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Code Viewer Panel */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Header */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-rose-400" />
              <span className="font-mono text-xs font-bold text-slate-200">
                {selectedFile.filename}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Скопировать код</span>
                </>
              )}
            </button>
          </div>

          {/* Description */}
          <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800/80 text-[11px] text-slate-400">
            {selectedFile.description}
          </div>

          {/* Code Body */}
          <div className="p-4 bg-slate-950 overflow-x-auto font-mono text-xs text-slate-200 leading-relaxed max-h-[600px] overflow-y-auto selection:bg-rose-500/30 selection:text-white">
            <pre className="text-slate-300">
              <code>{selectedFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
