import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Eye, RefreshCw, Layers, Calendar, DollarSign } from 'lucide-react';
import DemandTimeline from './DemandTimeline';

export default function CustomerDashboard({ onNavigateSubmit }) {
  const { user, customer } = useAuth();
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDemandId, setSelectedDemandId] = useState(null);

  const fetchDemands = async () => {
    setLoading(true);
    try {
      const res = await api.getMyDemands(customer?.customer_id);
      setDemands(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemands();
  }, [customer]);

  if (selectedDemandId) {
    return (
      <DemandTimeline 
        demandId={selectedDemandId} 
        onBack={() => { setSelectedDemandId(null); fetchDemands(); }} 
      />
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'REJECTED':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'PARTIALLY_ALLOCATED':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      default:
        return 'bg-sky-950 text-sky-300 border-sky-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Procurement Demands Portal</h2>
          <p className="text-xs text-slate-400">
            {customer?.customer_name || 'Customer Account'} &bull; Tier: <span className="text-cyan-400 font-bold">{customer?.tier || 'STANDARD'}</span> &bull; Credit Limit: <span className="text-emerald-400 font-bold">${Number(customer?.credit_limit || 0).toLocaleString()}</span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchDemands}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={onNavigateSubmit}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit New Demand</span>
          </button>
        </div>
      </div>

      {/* Demands List */}
      {loading ? (
        <p className="text-slate-500 text-xs font-mono py-12 text-center">Loading demand orders...</p>
      ) : demands.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No demands submitted yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Submit your first procurement request to initiate the multi-stage factory allocation workflow.
          </p>
          <button
            onClick={onNavigateSubmit}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold font-mono inline-flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Demand Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {demands.map(d => {
            const requested = Number(d.requested_quantity);
            const allocated = Number(d.allocated_quantity || 0);
            const pct = requested > 0 ? Math.min(100, ((allocated / requested) * 100).toFixed(0)) : 0;
            const totalVal = requested * Number(d.unit_price || 0);

            return (
              <div key={d.demand_id} className="glass-card rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-white">#{d.demand_id}</span>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(d.status)}`}>
                      {d.status}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      STAGE: LEVEL {d.level}
                    </span>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="text-slate-400">Order Value: </span>
                    <span className="font-bold text-emerald-400">${totalVal.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Product</span>
                    <p className="font-semibold text-white text-sm truncate">{d.product_name}</p>
                    <p className="text-slate-400 text-[11px]">${Number(d.unit_price).toFixed(2)} per unit</p>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Fulfillment Progress</span>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-cyan-400 font-bold">{allocated.toLocaleString()}</span>
                      <span className="text-slate-400">/ {requested.toLocaleString()} units ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${Number(pct) >= 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Target Delivery</span>
                    <p className="text-slate-200 flex items-center space-x-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{d.required_date ? d.required_date.split('T')[0] : 'N/A'}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Submitted: {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {d.status === 'PARTIALLY_ALLOCATED' && (
                  <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-300 font-mono">
                    Partially allocated: {allocated}/{requested} units assigned. Automatic background engine will fulfill remaining units as new weekly production yields are published.
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                  <button
                    onClick={() => setSelectedDemandId(d.demand_id)}
                    className="flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/50 hover:bg-cyan-900/40 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Lifecycle Timeline</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
