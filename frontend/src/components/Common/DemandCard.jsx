import React from 'react';
import { 
  Building2, 
  Package, 
  Calendar, 
  Sparkles, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Sliders, 
  Eye, 
  AlertCircle 
} from 'lucide-react';

export default function DemandCard({
  demand,
  onApprove,
  onReject,
  onAllocate,
  onViewTimeline,
  canApprove = true,
  actionButtonLabel = 'Approve',
  showAllocateButton = false
}) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
      case 'REJECTED':
        return 'bg-rose-950/80 text-rose-300 border-rose-700/60';
      case 'PARTIALLY_ALLOCATED':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
      default:
        return 'bg-sky-950/80 text-sky-300 border-sky-700/60';
    }
  };

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'STRATEGIC':
        return 'bg-purple-950/80 text-purple-300 border-purple-700/50';
      case 'SPOT':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/50';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const unitPrice = Number(demand.unit_price || 0);
  const totalValue = Number(demand.requested_quantity || 0) * unitPrice;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 hover:border-slate-700/80 transition-all">
      {/* Header: ID, Level, Status */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-sm font-bold text-white">#{demand.demand_id}</span>
          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(demand.status)}`}>
            {demand.status}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            LEVEL {demand.level}
          </span>
        </div>
        <div className="text-right font-mono text-xs">
          <span className="text-slate-400">Order Value: </span>
          <span className="font-bold text-emerald-400">${totalValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Customer & Product Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Customer Box */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center space-x-1.5 font-medium">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Customer</span>
            </span>
            <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${getTierBadge(demand.tier)}`}>
              {demand.tier}
            </span>
          </div>
          <p className="font-semibold text-slate-200 text-sm">{demand.customer_name}</p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/40">
            <span>Credit Limit:</span>
            <span className="text-slate-200 font-semibold">${Number(demand.credit_limit || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Product Box */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center space-x-1.5 font-medium">
              <Package className="w-3.5 h-3.5 text-blue-400" />
              <span>Product</span>
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              {demand.category}
            </span>
          </div>
          <p className="font-semibold text-slate-200 text-sm truncate">{demand.product_name}</p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/40">
            <span>Unit Price:</span>
            <span className="text-slate-200 font-semibold">${unitPrice.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Metrics Row: Requested, Allocated, Required Date */}
      <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-900/60 border border-slate-800/70 font-mono text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase">Requested</span>
          <span className="font-bold text-slate-200 text-sm">{Number(demand.requested_quantity).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block uppercase">Allocated</span>
          <span className={`font-bold text-sm ${Number(demand.allocated_quantity) > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
            {Number(demand.allocated_quantity || 0).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block uppercase">Required Date</span>
          <span className="text-slate-200 text-xs flex items-center justify-center space-x-1 mt-0.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{demand.required_date ? demand.required_date.split('T')[0] : 'N/A'}</span>
          </span>
        </div>
      </div>

      {/* AI Heuristic Advice if available */}
      {demand.suggested_quantity && (
        <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-1">
          <div className="flex items-center justify-between text-cyan-400 font-semibold text-[11px]">
            <span className="flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Recommendation Engine</span>
            </span>
            <span className="font-mono">{demand.confidence}% Confidence</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Suggesting <strong className="text-white font-mono">{Number(demand.suggested_quantity).toLocaleString()} units</strong>. {demand.reason}
          </p>
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <button
          onClick={() => onViewTimeline && onViewTimeline(demand.demand_id)}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-800"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View Timeline</span>
        </button>

        <div className="flex items-center space-x-2">
          {onReject && (
            <button
              onClick={() => onReject(demand)}
              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-rose-950/40 text-rose-300 border border-rose-800/50 hover:bg-rose-900/40 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          )}

          {showAllocateButton && onAllocate && (
            <button
              onClick={() => onAllocate(demand)}
              className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20 hover:from-cyan-500 hover:to-blue-500 transition-all font-mono"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Allocate Supply</span>
            </button>
          )}

          {!showAllocateButton && onApprove && (
            <button
              onClick={() => onApprove(demand)}
              disabled={!canApprove}
              className={`flex items-center space-x-1.5 text-xs font-semibold px-4 py-1.5 rounded-xl transition-all font-mono ${
                canApprove
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{actionButtonLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
