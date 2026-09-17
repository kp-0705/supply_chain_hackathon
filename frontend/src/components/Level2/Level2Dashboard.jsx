import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import DemandCard from '../Common/DemandCard';
import RuleViolationAlert from '../Common/RuleViolationAlert';
import Modal from '../Common/Modal';
import MatchingPlanner from '../Level3/MatchingPlanner';
import DemandTimeline from '../Customer/DemandTimeline';
import { Boxes, RefreshCw, CheckCircle2, Factory } from 'lucide-react';

export default function Level2Dashboard() {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Modals
  const [approveDemand, setApproveDemand] = useState(null);
  const [approveComment, setApproveComment] = useState('');
  const [approving, setApproving] = useState(false);

  const [rejectDemand, setRejectDemand] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [viewTimelineId, setViewTimelineId] = useState(null);

  const fetchDemands = async () => {
    setLoading(true);
    try {
      const res = await api.getLevel2Demands();
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


  const handleReject = async () => {
    if (!rejectDemand) return;
    if (!rejectReason.trim()) {
      alert('Please specify a rejection reason');
      return;
    }
    setRejecting(true);
    try {
      await api.rejectLevel2(rejectDemand.demand_id, rejectReason, rejectComment);
      setMessage(`Demand #${rejectDemand.demand_id} rejected at Level 2.`);
      setRejectDemand(null);
      setRejectReason('');
      setRejectComment('');
      fetchDemands();
    } catch (err) {
      alert(err.message);
    } finally {
      setRejecting(false);
    }
  };

  if (viewTimelineId) {
    return <DemandTimeline demandId={viewTimelineId} onBack={() => setViewTimelineId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Level 2: Supply Plan Validator</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
              STAGE 2 OF 4
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Confirm factory production yields exist, evaluate 30% and 50% supply coverage thresholds, and enforce regional export controls.
          </p>
        </div>
        <button
          onClick={fetchDemands}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Rules Governance Guide */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
          <strong className="text-slate-200 block">Rule 2.1 & 2.2</strong>
          Supply Plan Exists & Realistic
        </div>
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
          <strong className="text-slate-200 block">Rule 2.3</strong>
          Minimum 30% Supply Threshold
        </div>
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
          <strong className="text-slate-200 block">Rule 2.4</strong>
          EU Region Export Sanctions
        </div>
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
          <strong className="text-slate-200 block">Rule 2.5 & 2.6</strong>
          Shortfall & Data Consistency
        </div>
      </div>

      {/* Queue List */}
      {loading ? (
        <p className="text-slate-500 text-xs font-mono py-12 text-center">Loading supply validation queue...</p>
      ) : demands.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-2">
          <Factory className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Level 2 Queue Clear</p>
          <p className="text-xs text-slate-500">All validated customer demands have confirmed supply plans.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {demands.map(d => {
            const supplyRows = d.validation?.supplyRows || [];
            const totalAvail = supplyRows.reduce((sum, s) => sum + (Number(s.available_quantity) - Number(s.allocated_quantity)), 0);

            return (
              <div key={d.demand_id} className="space-y-3">
                <DemandCard
                  demand={d}
                  canApprove={d.validation?.canApprove}
                  actionButtonLabel="Confirm Supply & Send to L3"
                  onApprove={() => setApproveDemand(d)}
                  onReject={() => setRejectDemand(d)}
                  onViewTimeline={(id) => setViewTimelineId(id)}
                />

                {/* Factory Weeks Availability Breakdown */}
                {supplyRows.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <span>Monthly Available Supply Pool: <strong className="text-emerald-400">{totalAvail.toLocaleString()} units</strong></span>
                      <span>Demand: <strong className="text-white">{Number(d.requested_quantity).toLocaleString()} units</strong></span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                      {supplyRows.map(s => (
                        <div key={s.supply_id} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-slate-500 block">W{s.week}</span>
                          <span className="text-cyan-400 font-bold">{(Number(s.available_quantity) - Number(s.allocated_quantity)).toLocaleString()}</span>
                          <span className="text-slate-600 block">/ {Number(s.available_quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation Alerts */}
                <RuleViolationAlert
                  violations={d.validation?.errors || []}
                  warnings={d.validation?.warnings || []}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Allocation Cockpit Modal (Approve) */}
      <Modal
        isOpen={Boolean(approveDemand)}
        onClose={() => setApproveDemand(null)}
        title="Supply Matching & Inventory Allocation Cockpit"
      >
        {approveDemand && (
          <MatchingPlanner
            demand={approveDemand}
            onClose={() => setApproveDemand(null)}
            onAllocationComplete={(result) => {
              setMessage(
                result.isFullyAllocated
                  ? `Demand #${result.demandId} fully allocated and forwarded to Level 3.`
                  : `Demand #${result.demandId} partially allocated. Retained at Level 2.`
              );
              setApproveDemand(null);
              fetchDemands();
            }}
          />
        )}
      </Modal>


      {/* Reject Modal */}
      <Modal
        isOpen={Boolean(rejectDemand)}
        onClose={() => setRejectDemand(null)}
        title={`Reject Demand #${rejectDemand?.demand_id} (Level 2)`}
        footer={
          <>
            <button
              onClick={() => setRejectDemand(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={rejecting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white font-mono shadow"
            >
              {rejecting ? 'Rejecting...' : 'Reject Demand'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Reason for Rejection *</label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-rose-500 focus:outline-none"
            >
              <option value="">-- Select Supply Failure Reason --</option>
              <option value="No supply plan created for target month">No supply plan created for target month (Rule 2.1)</option>
              <option value="Zero available inventory across all weeks">Zero available inventory across all weeks (Rule 2.2)</option>
              <option value="Supply availability below 30% threshold">Supply availability below 30% threshold (Rule 2.3)</option>
              <option value="Export control restriction (EU region destination)">Export control restriction (EU region destination) (Rule 2.4)</option>
              <option value="Supply shortfall exceeds 50% threshold">Supply shortfall exceeds 50% threshold (Rule 2.5)</option>
              <option value="Production capacity overcommitted">Production capacity overcommitted</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Additional Explanatory Note</label>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              placeholder="Provide manufacturing / supply explanation..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
