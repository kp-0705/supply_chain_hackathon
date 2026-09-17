import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import TimelineView from '../Common/TimelineView';
import { ArrowLeft, RefreshCw, Layers, Calendar, DollarSign, ShieldAlert } from 'lucide-react';

export default function DemandTimeline({ demandId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await api.getDemandTimeline(demandId);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [demandId]);

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs">
        Loading demand timeline...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs">
        Demand not found.
      </div>
    );
  }

  const { demand, timeline, allocations, exceptions } = data;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Demands</span>
        </button>
        <button
          onClick={fetchTimeline}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Demand Summary Header Card */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-white">Demand #{demand.demand_id}</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                Level {demand.level}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {demand.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{demand.product_name} &bull; {demand.customer_name}</p>
          </div>
          <div className="text-right font-mono">
            <span className="text-xs text-slate-400">Order Value: </span>
            <span className="text-base font-bold text-emerald-400">
              ${(Number(demand.requested_quantity) * Number(demand.unit_price)).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Quantities & Progress */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-center">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Requested</span>
            <span className="text-sm font-bold text-white">{Number(demand.requested_quantity).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Allocated</span>
            <span className="text-sm font-bold text-cyan-400">{Number(demand.total_allocated || 0).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Remaining</span>
            <span className="text-sm font-bold text-amber-400">{Number(demand.remaining_quantity || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Weekly Allocation Breakdown if any */}
        {allocations.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weekly Reserved Inventory</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              {allocations.map(a => (
                <div key={a.allocation_id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Week {a.week}:</span>
                  <strong className="text-cyan-300">{Number(a.allocated_quantity).toLocaleString()} units</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Exceptions Flagged if any */}
        {exceptions.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-1.5 text-xs">
            <div className="flex items-center space-x-1.5 font-bold text-amber-400 font-mono">
              <ShieldAlert className="w-4 h-4" />
              <span>Flagged Exceptions ({exceptions.length})</span>
            </div>
            {exceptions.map(e => (
              <p key={e.exception_id} className="text-slate-300 text-[11px]">
                &bull; <strong className="text-amber-300 font-mono">{e.code}:</strong> {e.description} 
                {e.resolution ? <span className="text-emerald-400 font-mono"> (Resolved: {e.resolution})</span> : <span className="text-amber-400 font-mono"> (Pending Executive Review)</span>}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Full Audit Action History */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Decision Audit Timeline & Governance Log
        </h3>
        <TimelineView actions={timeline} />
      </div>
    </div>
  );
}
