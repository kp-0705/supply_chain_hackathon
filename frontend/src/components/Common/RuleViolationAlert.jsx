import React from 'react';
import { AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function RuleViolationAlert({ violations = [], warnings = [] }) {
  if (violations.length === 0 && warnings.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 p-2.5 rounded-xl font-mono">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>All business validation rules passed successfully.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Errors (Blockers) */}
      {violations.map((v, i) => (
        <div 
          key={i} 
          className="flex items-start space-x-2.5 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl text-xs text-rose-300"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center space-x-1.5 font-bold font-mono">
              <span className="px-1.5 py-0.5 rounded bg-rose-900/80 text-rose-200 text-[10px]">
                RULE {v.rule}
              </span>
              <span>Validation Failed</span>
            </div>
            <p className="mt-0.5 text-slate-300 leading-relaxed">{v.message}</p>
          </div>
        </div>
      ))}

      {/* Warnings (Non-blockers or Escalation Flags) */}
      {warnings.map((w, i) => (
        <div 
          key={i} 
          className="flex items-start space-x-2.5 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-xl text-xs text-amber-300"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center space-x-1.5 font-bold font-mono">
              <span className="px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-200 text-[10px]">
                RULE {w.rule} (WARNING)
              </span>
            </div>
            <p className="mt-0.5 text-slate-300 leading-relaxed">{w.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
