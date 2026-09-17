import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import DemandCard from '../Common/DemandCard';
import Modal from '../Common/Modal';
import ExecutiveApprover from './ExecutiveApprover';
import DemandTimeline from '../Customer/DemandTimeline';
import RulesChecklist from '../Common/RulesChecklist';
import { Award, RefreshCw, CheckCircle2, ShieldAlert, CheckCheck } from 'lucide-react';

export default function Level4Dashboard() {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const [approvingDemand, setApprovingDemand] = useState(null);
  const [viewTimelineId, setViewTimelineId] = useState(null);

  const fetchDemands = async () => {
    setLoading(true);
    try {
      const res = await api.getLevel4Demands();
      setDemands(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemands();
  }, []);

  const handleComplete = (result) => {
    setApprovingDemand(null);
    setMessage(result.message);
    fetchDemands();
  };

  if (viewTimelineId) {
    return <DemandTimeline demandId={viewTimelineId} onBack={() => setViewTimelineId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Level 4: Executive Approver & Governance Hub</h2>
          <p className="text-xs text-slate-400">
            Final executive sign-off authority, exception resolution, customer credit recalculation, and production commit.
          </p>
        </div>
        <button
          onClick={fetchDemands}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Hub</span>
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Demand Orders Queue */}
      {loading ? (
        <p className="text-slate-500 text-xs font-mono py-12 text-center">Loading executive authorization queue...</p>
      ) : demands.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-2">
          <Award className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Executive Queue Clear</p>
          <p className="text-xs text-slate-500">All allocated demands have received final executive decision.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {demands.map(d => (
            <div key={d.demand_id} className="space-y-3">
              <DemandCard
                demand={d}
                actionButtonLabel={d.is_final_approved ? 'Order Committed' : 'Executive Review & Sign-Off'}
                canApprove={!d.is_final_approved}
                onApprove={() => setApprovingDemand(d)}
                onViewTimeline={(id) => setViewTimelineId(id)}
              />

              {/* Live Level 4 Rules Checklist */}
              <RulesChecklist level={4} demand={d} />

              {/* Status Badge Indicator */}
              {d.is_final_approved ? (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between font-mono">
                  <div className="flex items-center space-x-2">
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    <span>FINAL EXECUTIVE APPROVAL GRANTED &bull; FULFILLMENT COMMITTED</span>
                  </div>
                  <span>Total Value: ${Number(d.total_value || 0).toLocaleString()}</span>
                </div>
              ) : d.exceptions && d.exceptions.length > 0 ? (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800 text-amber-300 text-xs flex items-center justify-between font-mono">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>{d.exceptions.length} EXCEPTION(S) FLAGGED &bull; MANDATORY AUDIT COMMENT REQUIRED</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{d.exceptions.map(e => e.code).join(', ')}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Executive Decision Modal */}
      <Modal
        isOpen={Boolean(approvingDemand)}
        onClose={() => setApprovingDemand(null)}
        title="Executive Sign-Off & Fulfillment Authorization"
      >
        {approvingDemand && (
          <ExecutiveApprover
            demand={approvingDemand}
            onClose={() => setApprovingDemand(null)}
            onComplete={handleComplete}
          />
        )}
      </Modal>
    </div>
  );
}
