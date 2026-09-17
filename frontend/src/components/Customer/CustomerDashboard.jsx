import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, 
  Eye, 
  RefreshCw, 
  Layers, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  CornerDownRight, 
  Clock, 
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import DemandTimeline from './DemandTimeline';
import CustomerChatbot from './CustomerChatbot';

export default function CustomerDashboard({ onNavigateSubmit }) {
  const { user, customer } = useAuth();
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDemandId, setSelectedDemandId] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});

  const toggleComments = (id) => {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  const getStatusInfo = (status, level) => {
    switch (status) {
      case 'APPROVED':
        return {
          label: 'APPROVED',
          badge: 'bg-emerald-950 text-emerald-300 border-emerald-800',
          sub: 'Level 4 Sign-Off Granted'
        };
      case 'REJECTED':
        return {
          label: 'REJECTED',
          badge: 'bg-rose-950 text-rose-300 border-rose-800',
          sub: `Rejected at Level ${level}`
        };
      case 'PARTIALLY_ALLOCATED':
        return {
          label: 'PARTIALLY ACCEPTED',
          badge: 'bg-amber-950 text-amber-300 border-amber-800',
          sub: 'Held at Level 2 (Awaiting Next Week Supply)'
        };
      default:
        return {
          label: 'PROCESSING',
          badge: 'bg-sky-950 text-sky-300 border-sky-800',
          sub: `Under Review (Level ${level === 0 ? 1 : level})`
        };
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
            Submit your procurement request to initiate factory allocation.
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
        <div className="grid grid-cols-1 gap-5">
          {demands.map(d => {
            const requested = Number(d.requested_quantity);
            const isApproved = d.status === 'APPROVED';
            // Only change allocated_quantity once accepted at 4th level!
            const allocated = isApproved 
              ? Number(d.allocated_quantity || d.approved_data?.fulfilled_quantity || 0) 
              : 0;
            const pct = requested > 0 ? Math.min(100, ((allocated / requested) * 100).toFixed(0)) : 0;
            const totalVal = requested * Number(d.unit_price || 0);
            const statusInfo = getStatusInfo(d.status, d.level);

            // Audit history
            const allActions = d.actions || [];
            const rejectedAction = allActions.slice().reverse().find(a => a.action_type === 'REJECTED');
            const passedActions = allActions.filter(a => a.action_type === 'APPROVED' || a.action_type === 'PARTIALLY_ALLOCATED' || a.action_type === 'SUBMITTED');
            const isRejected = d.status === 'REJECTED';

            return (
              <div key={d.demand_id} className="glass-card rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all">
                {/* Header: ID, Processing/Approved/Rejected Badge, Level, Value */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-white">#{d.demand_id}</span>
                    <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border ${statusInfo.badge}`}>
                      {statusInfo.label}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Level {d.level}
                    </span>
                    <span className="text-[11px] text-slate-400 font-sans">
                      &bull; {statusInfo.sub}
                    </span>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="text-slate-400">Order Value: </span>
                    <span className="font-bold text-emerald-400">${totalVal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Product, Fulfillment & Delivery Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Product</span>
                    <p className="font-semibold text-white text-sm truncate">{d.product_name}</p>
                    <p className="text-slate-400 text-[11px]">${Number(d.unit_price).toFixed(2)} per unit</p>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Allocated Quantity</span>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={`font-bold ${isApproved ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {allocated.toLocaleString()} units
                      </span>
                      <span className="text-slate-400">/ {requested.toLocaleString()} req</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${isApproved ? 'bg-emerald-500' : 'bg-slate-600'}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">
                      {isApproved 
                        ? '100% Final Executive Authorization Committed' 
                        : isRejected 
                        ? 'Allocation cancelled due to rejection' 
                        : 'Official allocation commits upon Level 4 final acceptance'}
                    </p>
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

                {/* Special Level 2 Partial Acceptance Callout */}
                {d.status === 'PARTIALLY_ALLOCATED' && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800 text-xs text-amber-200 font-sans space-y-1">
                    <div className="flex items-center space-x-1.5 font-bold font-mono">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Partial Acceptance Hold (Level 2)</span>
                    </div>
                    <p className="text-[11px] text-amber-300">
                      Currently, available factory supply is smaller than requested quantity. Your demand is <strong>partially accepted</strong> and retained at Level 2. Once the next week cycle arrives and inventory increases, it will be fully advanced to Level 3.
                    </p>
                  </div>
                )}

                {/* REJECTION AUDIT BOX: Shows at what stage rejected + reason + comment, AND all stages passed */}
                {isRejected && (
                  <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 space-y-3 font-sans">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-rose-300 font-bold text-xs font-mono">
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>REJECTED AT LEVEL {rejectedAction?.level ?? d.level}</span>
                      </div>
                      <span className="text-[10px] text-rose-400/80 font-mono">
                        {rejectedAction?.created_at ? new Date(rejectedAction.created_at).toLocaleString() : ''}
                      </span>
                    </div>

                    {/* Rejection Reason & Comment */}
                    <div className="p-3 rounded-lg bg-slate-950/90 border border-rose-900/60 text-xs space-y-1.5">
                      <p className="text-rose-200 font-semibold">
                        Rejection Reason: <span className="font-normal text-white">{rejectedAction?.reason || d.reason || 'Criteria check failed'}</span>
                      </p>
                      {rejectedAction?.comment && (
                        <div className="flex items-start space-x-1.5 text-rose-300 text-[11px] font-mono pt-1 border-t border-rose-950">
                          <CornerDownRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>Validator Comment: "{rejectedAction.comment}"</span>
                        </div>
                      )}
                      {rejectedAction?.approved_by && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          Decision logged by: {rejectedAction.user_name || rejectedAction.user_role || 'Micron Reviewer'}
                        </p>
                      )}
                    </div>

                    {/* Stages Passed Prior to Rejection */}
                    <div className="space-y-1.5 pt-1 border-t border-rose-900/40">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Verification History (Stages Passed Before Rejection):
                      </p>
                      {passedActions.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">No prior verification stages were completed.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {passedActions.map((act, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] flex items-start space-x-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between font-mono">
                                  <strong className="text-emerald-300">Level {act.level} ({act.action_type}):</strong>
                                  <span className="text-[10px] text-slate-500">
                                    {act.user_name || act.user_role} &bull; {new Date(act.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                {act.reason && <p className="text-slate-300 text-[11px] mt-0.5">{act.reason}</p>}
                                {act.comment && (
                                  <p className="text-cyan-300 font-mono text-[10px] mt-1 bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                                    Comment: "{act.comment}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STAGES PASSED FOR PROCESSING / APPROVED DEMANDS */}
                {!isRejected && passedActions.length > 0 && (
                  <div className="space-y-2 pt-1 font-sans">
                    <button
                      type="button"
                      onClick={() => toggleComments(d.demand_id)}
                      className="flex items-center justify-between w-full text-[11px] font-mono text-slate-400 hover:text-white p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 transition-colors"
                    >
                      <span className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Stages Passed & Verification Comments ({passedActions.length})</span>
                      </span>
                      {expandedComments[d.demand_id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {expandedComments[d.demand_id] && (
                      <div className="space-y-1.5 pl-2 border-l-2 border-slate-800">
                        {passedActions.map((act, i) => (
                          <div key={i} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] flex items-start space-x-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between font-mono">
                                <strong className="text-emerald-300">Level {act.level} ({act.action_type})</strong>
                                <span className="text-[10px] text-slate-500">
                                  {act.user_name || act.user_role} &bull; {new Date(act.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {act.reason && <p className="text-slate-300 text-[11px] mt-0.5">{act.reason}</p>}
                              {act.comment && (
                                <p className="text-cyan-300 font-mono text-[10px] mt-1 bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                                  Comment: "{act.comment}"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Controls */}
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

      {/* Customer AI Chatbot - floating widget, receives demands list */}
      <CustomerChatbot demands={demands} />
    </div>
  );
}
