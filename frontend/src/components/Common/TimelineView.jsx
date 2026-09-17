import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  Zap, 
  CornerDownRight, 
  UserCheck 
} from 'lucide-react';

export default function TimelineView({ actions = [] }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="text-center p-6 text-slate-500 text-xs font-mono">
        No action log history recorded yet.
      </div>
    );
  }

  const getActionIcon = (type) => {
    switch (type) {
      case 'APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'PARTIALLY_ALLOCATED':
        return <Layers className="w-4 h-4 text-amber-400" />;
      case 'AUTO_COMPLETED':
        return <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-sky-400" />;
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'APPROVED':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
      case 'REJECTED':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
      case 'PARTIALLY_ALLOCATED':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/60';
      case 'AUTO_COMPLETED':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
      {actions.map((act, index) => (
        <div key={act.action_id || index} className="relative group">
          {/* Timeline Node Dot */}
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow">
            {getActionIcon(act.action_type)}
          </div>

          {/* Action Card */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5 space-y-1.5 shadow-sm hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${getBadgeStyle(act.action_type)}`}>
                  LEVEL {act.level}: {act.action_type}
                </span>
                {act.approved_quantity !== null && (
                  <span className="text-xs font-mono text-cyan-400 font-semibold">
                    {Number(act.approved_quantity).toLocaleString()} units
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(act.created_at).toLocaleString()}
              </span>
            </div>

            {/* Rationale / Reason */}
            {act.reason && (
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {act.reason}
              </p>
            )}

            {/* Approver / User */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 pt-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>
                By: <strong className="text-slate-300">{act.user_name || 'System Auto-Engine'}</strong>
                {act.user_role && ` (${act.user_role})`}
              </span>
            </div>

            {/* Executive Comment if present */}
            {act.comment && (
              <div className="mt-2 text-[11px] p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-cyan-200/90 flex items-start space-x-2 font-mono">
                <CornerDownRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>Note: {act.comment}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
