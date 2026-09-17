import React, { useState } from 'react';
import { api } from '../../services/api';
import RulesChecklist from '../Common/RulesChecklist';
import { 
  Award, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  MessageSquare 
} from 'lucide-react';

export default function ExecutiveApprover({ demand, onClose, onComplete }) {
  const [comment, setComment] = useState('');
  const [overrideExceptions, setOverrideExceptions] = useState(true);
  const [actionType, setActionType] = useState('APPROVE');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const hasExceptions = demand.exceptions && demand.exceptions.length > 0;
  const isStrategic = demand.tier === 'STRATEGIC';
  const isSpot = demand.tier === 'SPOT';

  const handleApprove = async () => {
    if (!comment || comment.trim().length < 3) {
      setError('An executive approval comment explaining the fulfillment authorization is mandatory.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.approveLevel4(demand.demand_id, comment.trim(), overrideExceptions);
      onComplete({
        success: true,
        message: `Demand #${demand.demand_id} received Final Executive Approval and has been committed for shipment.`
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Please specify an executive rejection rationale.');
      return;
    }
    if (!comment || comment.trim().length < 3) {
      setError('An executive rejection comment explaining the cancellation is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.rejectLevel4(demand.demand_id, rejectionReason, comment.trim());
      onComplete({
        success: true,
        message: `Demand #${demand.demand_id} rejected. All reserved supply allocations released back to factory inventory.`
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Financial Impact Dashboard */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 font-mono">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Customer Account</span>
            <strong className="text-white text-sm">{demand.customer_name}</strong>
            <span className="text-[11px] text-cyan-400 ml-2">({demand.tier} &bull; {demand.priority} Priority)</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[10px] uppercase block">Product</span>
            <span className="text-slate-200 font-semibold">{demand.product_name}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Fulfilled Units</span>
            <span className="text-sm font-bold text-cyan-400">
              {Number(demand.allocated_quantity || demand.requested_quantity).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Order Revenue</span>
            <span className="text-sm font-bold text-emerald-400">
              ${Number(demand.total_value || 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Profit Margin</span>
            <span className={`text-sm font-bold ${Number(demand.marginPct) < 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {demand.marginPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Live Level 4 Rules Checklist */}
      <RulesChecklist level={4} demand={demand} />

      {/* Flagged Exceptions Review Box */}
      {hasExceptions && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 space-y-2.5">
          <div className="flex items-center space-x-2 font-bold text-amber-300 font-mono text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Active Exceptions Requiring Executive Sign-Off ({demand.exceptions.length})</span>
          </div>
          <div className="space-y-1.5 font-sans">
            {demand.exceptions.map(e => (
              <div key={e.exception_id} className="p-2 rounded-lg bg-slate-900/80 border border-amber-800/40 text-[11px]">
                <strong className="text-amber-300 font-mono">{e.code}: </strong>
                <span className="text-slate-200">{e.description}</span>
                {e.resolution && <span className="text-emerald-400 block font-mono mt-0.5">&bull; Prior resolution: {e.resolution}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spot Customer Warnings if applicable */}
      {isSpot && (
        <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/50 text-[11px] text-purple-300">
          <strong>Rule 4.6 Notice:</strong> Spot customers require 100% full allocation and margin &ge;10%.
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Toggle (Approve / Reject) */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActionType('APPROVE')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
            actionType === 'APPROVE'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Final Executive Approval
        </button>
        <button
          type="button"
          onClick={() => setActionType('REJECT')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
            actionType === 'REJECT'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Executive Rejection (Release Supply)
        </button>
      </div>

      {actionType === 'APPROVE' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Executive Resolution & Audit Authorization Note *
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Mandatory: Enter executive authorization reason, shipment sign-off, or override notes..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleApprove}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold font-mono text-xs shadow-lg shadow-emerald-600/20 flex items-center space-x-1.5"
            >
              <Award className="w-4 h-4" />
              <span>{submitting ? 'Committing Order...' : 'Grant Final Fulfillment Approval'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Executive Rejection Rationale *</label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-rose-500 focus:outline-none"
            >
              <option value="">-- Select Rejection Rationale --</option>
              <option value="Profit margin below executive threshold">Profit margin below executive threshold (Rule 4.3)</option>
              <option value="Customer credit exposure exceeds limit">Customer credit exposure exceeds limit (Rule 4.2)</option>
              <option value="Spot customer non-compliance with full allocation">Spot customer non-compliance with full allocation (Rule 4.6)</option>
              <option value="Production reallocation to strategic account">Production reallocation to strategic account</option>
              <option value="Executive override denial">Executive override denial</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Detailed Explanation</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Provide executive guidance and cancellation notes..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleReject}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold font-mono text-xs shadow-lg shadow-rose-600/20 flex items-center space-x-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>{submitting ? 'Releasing Supply...' : 'Confirm Rejection & Release Supply'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
