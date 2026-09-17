import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { RefreshCw, Layers, Eye, Filter, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import DemandTimeline from '../Customer/DemandTimeline';

export default function DemandsHistory({ title = 'Validation History & Order Log', defaultStatus = 'ALL' }) {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);
  const [selectedDemandId, setSelectedDemandId] = useState(null);

  const fetchDemands = async () => {
    setLoading(true);
    try {
      const res = await api.getAllDemands();
      setDemands(res.data || []);
    } catch (e) {
      console.error('Failed to fetch demands history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemands();
  }, []);

  if (selectedDemandId) {
    return (
      <DemandTimeline
        demandId={selectedDemandId}
        onBack={() => {
          setSelectedDemandId(null);
          fetchDemands();
        }}
      />
    );
  }

  const filteredDemands = demands.filter(d => {
    if (selectedStatus === 'ALL') return true;
    return d.status === selectedStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      case 'REJECTED':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'PARTIALLY_ALLOCATED':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      default:
        return 'bg-sky-950/80 text-sky-300 border-sky-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs text-slate-400">
            Real-time audit log of procurement demands, allocation progress, and fulfillment statuses.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Status Filter Buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            {['ALL', 'PENDING', 'APPROVED', 'PARTIALLY_ALLOCATED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg transition-all font-mono text-[11px] ${
                  selectedStatus === st
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>

          <button
            onClick={fetchDemands}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Demands List */}
      {loading ? (
        <p className="text-slate-500 text-xs font-mono py-12 text-center">Loading demands history...</p>
      ) : filteredDemands.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No demands found</p>
          <p className="text-xs text-slate-500">
            No procurement demands match the current status filter ({selectedStatus}).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredDemands.map(d => {
            const requested = Number(d.requested_quantity || 0);
            const allocated = Number(d.allocated_quantity || 0);
            const unitPrice = Number(d.unit_price || 0);
            const totalVal = requested * unitPrice;

            return (
              <div
                key={d.demand_id}
                className="glass-card rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-white">#{d.demand_id}</span>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(d.status)}`}>
                      {d.status}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Level {d.level}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {d.customer_name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-400 font-mono pt-1">
                    <span>Product: <strong className="text-slate-200">{d.product_name}</strong></span>
                    <span>Qty: <strong className="text-cyan-400">{requested.toLocaleString()}</strong> units</span>
                    <span>Allocated: <strong className="text-emerald-400">{allocated.toLocaleString()}</strong></span>
                    <span>Value: <strong className="text-white">${totalVal.toLocaleString()}</strong></span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end md:self-center">
                  <button
                    onClick={() => setSelectedDemandId(d.demand_id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Audit Timeline</span>
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
