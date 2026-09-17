import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import RulesChecklist from '../Common/RulesChecklist';
import { 
  Sliders, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Calendar, 
  ShieldAlert, 
  Info,
  MessageSquare
} from 'lucide-react';

export default function MatchingPlanner({ demand, onClose, onAllocationComplete }) {
  const [weeks, setWeeks] = useState([]);
  const [allocations, setAllocations] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const reqDate = new Date(demand.required_date);
  const month = reqDate.getMonth() + 1;

  useEffect(() => {
    async function loadAvailability() {
      setLoading(true);
      try {
        const res = await api.getSupplyAvailability(demand.product_id, month);
        setWeeks(res.data);

        // Auto-compute FIFO distribution suggestion as starting values
        let remainingNeeded = Number(demand.requested_quantity);
        const initial = { 1: 0, 2: 0, 3: 0, 4: 0 };

        for (const w of res.data) {
          const avail = Math.max(0, Number(w.available_quantity) - Number(w.allocated_quantity));
          if (avail > 0 && remainingNeeded > 0) {
            const take = Math.min(avail, remainingNeeded);
            initial[w.week] = take;
            remainingNeeded -= take;
          }
        }
        setAllocations(initial);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAvailability();
  }, [demand.demand_id]);

  const handleWeekChange = (weekNum, val) => {
    const qty = Math.max(0, parseInt(val, 10) || 0);
    setAllocations(prev => ({ ...prev, [weekNum]: qty }));
  };

  const totalAllocated = Object.values(allocations).reduce((sum, q) => sum + q, 0);
  const requestedQty = Number(demand.requested_quantity);
  const unitPrice = Number(demand.unit_price);
  const standardCost = Number(demand.standard_cost);

  const totalOrderValue = totalAllocated * unitPrice;
  const totalProfit = totalAllocated * (unitPrice - standardCost);
  const marginPct = totalOrderValue > 0 ? ((totalProfit / totalOrderValue) * 100).toFixed(2) : 0;

  // Rules 3.5 & 3.6 Risk Flags
  const isLowMargin = Number(marginPct) < 8;
  const isHighValue = totalOrderValue > 1000000;
  const isFullyAllocated = totalAllocated >= requestedQty;

  const handleSubmit = async () => {
    if (totalAllocated === 0) {
      setError('Total allocated quantity must be greater than 0');
      return;
    }

    if (!comment.trim()) {
      setError('A planner allocation rationale comment is mandatory before committing.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const manualWeeks = Object.entries(allocations).map(([w, q]) => ({
        week: Number(w),
        quantity: Number(q)
      }));

      const res = await api.allocateSupply(demand.demand_id, manualWeeks, comment.trim());
      onAllocationComplete(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Header Context */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Target Demand:</span>
          <strong className="text-white font-mono">#{demand.demand_id} ({demand.customer_name})</strong>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Product:</span>
          <span className="text-cyan-300 font-semibold">{demand.product_name}</span>
        </div>
        <div className="flex items-center justify-between font-mono pt-1 border-t border-slate-800/60">
          <span className="text-slate-400">Requested Quantity:</span>
          <strong className="text-white text-sm">{requestedQty.toLocaleString()} units</strong>
        </div>
      </div>

      {/* Rules Checklist */}
      <RulesChecklist level={3} demand={demand} />

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Week-by-Week Allocation Sliders */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Weekly Production Yield Reservation</span>
          <span className="text-slate-500 font-mono">Month {month} Capacity</span>
        </h4>

        {loading ? (
          <p className="text-slate-500 text-center py-4 font-mono">Loading weekly availability...</p>
        ) : (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map(w => {
              const weekData = weeks.find(item => Number(item.week) === w);
              const maxAvailable = weekData ? Math.max(0, Number(weekData.available_quantity) - Number(weekData.allocated_quantity)) : 0;
              const currentVal = allocations[w] || 0;
              const isOver = currentVal > maxAvailable;

              return (
                <div key={w} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between font-mono">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold text-[10px]">
                        WEEK {w}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Max Available: <strong className="text-emerald-400">{maxAvailable.toLocaleString()}</strong>
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        min="0"
                        max={maxAvailable}
                        value={currentVal}
                        onChange={(e) => handleWeekChange(w, e.target.value)}
                        className={`w-24 px-2 py-1 bg-slate-900 border rounded-lg text-right font-mono text-xs focus:outline-none ${
                          isOver ? 'border-rose-500 text-rose-300' : 'border-slate-700 text-white focus:border-cyan-500'
                        }`}
                      />
                      <span className="text-slate-400 text-[10px]">units</span>
                    </div>
                  </div>

                  {/* Range Slider for rapid allocation adjustment */}
                  <input
                    type="range"
                    min="0"
                    max={maxAvailable || 100}
                    value={Math.min(currentVal, maxAvailable)}
                    onChange={(e) => handleWeekChange(w, e.target.value)}
                    disabled={maxAvailable === 0}
                    className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  {isOver && (
                    <p className="text-[10px] text-rose-400 font-mono">
                      Allocation exceeds available capacity for Week {w}!
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Real-time Financial & Governance Telemetry */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 font-mono">
        <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Total Allocated</span>
            <span className="text-base font-bold text-cyan-400">{totalAllocated.toLocaleString()} units</span>
            <span className="text-[10px] text-slate-500 block">
              {isFullyAllocated ? '100% Full Fulfillment' : `${((totalAllocated / requestedQty) * 100).toFixed(1)}% Partial`}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Order Financial Value</span>
            <span className="text-base font-bold text-emerald-400">${totalOrderValue.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block">Profit: ${totalProfit.toLocaleString()}</span>
          </div>
        </div>

        {/* Live Margin Calculation */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>Projected Margin:</span>
          </span>
          <span className={`text-sm font-bold ${isLowMargin ? 'text-amber-400' : 'text-emerald-400'}`}>
            {marginPct}% {isLowMargin ? '(Low Margin <8%)' : '(Target Met)'}
          </span>
        </div>

        {/* Exceptions & Risk Badges */}
        <div className="space-y-1.5 pt-1">
          {isLowMargin && (
            <div className="flex items-center space-x-2 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/50 p-2 rounded-lg font-sans">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Rule 3.5 Alert: Margin is below 8%. Will raise 'LOW_MARGIN' exception for Level 4 executive review.</span>
            </div>
          )}

          {isHighValue && (
            <div className="flex items-center space-x-2 text-[11px] text-purple-300 bg-purple-950/30 border border-purple-800/50 p-2 rounded-lg font-sans">
              <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Rule 3.6 Alert: Order value exceeds $1,000,000. Automatic escalation to Level 4 executive approver.</span>
            </div>
          )}

          {!isFullyAllocated && (
            <div className="flex items-center space-x-2 text-[11px] text-cyan-300 bg-cyan-950/30 border border-cyan-800/50 p-2 rounded-lg font-sans">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Partial Allocation: Retains order at Level 3. System auto-completion engine will allocate remaining units when new supply is published.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mandatory Planner Comment */}
      <div className="space-y-1 font-sans">
        <label className="block text-slate-300 font-bold text-xs flex items-center space-x-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span>Planner Allocation Rationale & Yield Notes *</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Enter mandatory allocation rationale, yield batch details, and delivery confirmations..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting || totalAllocated === 0}
          onClick={handleSubmit}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold font-mono text-xs shadow-lg shadow-cyan-600/20 flex items-center space-x-1.5 transition-all disabled:opacity-50"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{submitting ? 'Executing Allocation Lock...' : isFullyAllocated ? 'Commit Full Allocation & Forward to L4' : 'Commit Partial Allocation'}</span>
        </button>
      </div>
    </div>
  );
}
