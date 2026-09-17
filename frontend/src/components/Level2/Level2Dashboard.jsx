import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import DemandCard from '../Common/DemandCard';
import RuleViolationAlert from '../Common/RuleViolationAlert';
import RulesChecklist from '../Common/RulesChecklist';
import Modal from '../Common/Modal';
import DemandTimeline from '../Customer/DemandTimeline';
import { Boxes, RefreshCw, CheckCircle2, Factory, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function Level2Dashboard() {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Full Approval Modal State
  const [approveDemand, setApproveDemand] = useState(null);
  const [approveComment, setApproveComment] = useState('');
  const [approving, setApproving] = useState(false);

  // Partial Acceptance Modal State
  const [partialDemand, setPartialDemand] = useState(null);
  const [partialComment, setPartialComment] = useState('');
  const [partiallyAccepting, setPartiallyAccepting] = useState(false);

  // Reject Modal State
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

  const handleApprove = async () => {
    if (!approveDemand) return;
    if (!approveComment.trim()) {
      alert('Please enter an approval validation comment.');
      return;
    }
    setApproving(true);
    try {
      await api.approveLevel2(approveDemand.demand_id, approveComment);
      setMessage(`Demand #${approveDemand.demand_id} fully confirmed and forwarded to Level 3 Matching Planner.`);
      setApproveDemand(null);
      setApproveComment('');
      fetchDemands();
    } catch (err) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  };

  const handlePartialAccept = async () => {
    if (!partialDemand) return;
    if (!partialComment.trim()) {
      alert('Please enter a comment for partially accepting this demand.');
      return;
    }
    setPartiallyAccepting(true);
    try {
      await api.partialAcceptLevel2(partialDemand.demand_id, partialComment);
      setMessage(`Demand #${partialDemand.demand_id} partially accepted. Retained in Level 2 awaiting next week supply.`);
      setPartialDemand(null);
      setPartialComment('');
      fetchDemands();
    } catch (err) {
      alert(err.message);
    } finally {
      setPartiallyAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDemand) return;
    if (!rejectReason.trim()) {
      alert('Please specify a rejection reason');
      return;
    }
    if (!rejectComment.trim()) {
      alert('Please write comments stating the detailed reason for rejection.');
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
          <h2 className="text-xl font-extrabold text-white tracking-tight">Level 2: Supply Plan Validator</h2>
          <p className="text-xs text-slate-400">
            Confirm factory production yields exist, evaluate supply coverage, and handle partial acceptance until next week supply increases.
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
            const totalAvail = d.totalAvailable !== undefined 
              ? Number(d.totalAvailable) 
              : supplyRows.reduce((sum, s) => sum + Math.max(0, Number(s.available_quantity) - Number(s.allocated_quantity)), 0);
            const requested = Number(d.requested_quantity);
            const isSupplyShorter = totalAvail < requested;
            const isPartiallyAccepted = d.status === 'PARTIALLY_ALLOCATED';

            return (
              <div key={d.demand_id} className="space-y-3">
                {/* Supply Shortfall Banner */}
                {isSupplyShorter && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start space-x-2 font-mono">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <span className="font-bold block">
                        Supply Shortfall: Available ({totalAvail.toLocaleString()} units) &lt; Requested ({requested.toLocaleString()} units)
                      </span>
                      <span className="text-[11px] text-amber-400/90 font-sans">
                        {isPartiallyAccepted 
                          ? 'This demand is currently Partially Accepted in Level 2. Waiting for next week supply replenishment before it can move to Level 3.'
                          : 'This demand will be Partially Accepted and held in Level 2 until next week supply replenishment.'}
                      </span>
                    </div>
                  </div>
                )}

                <DemandCard
                  demand={d}
                  canApprove={true}
                  actionButtonLabel={isSupplyShorter ? 'Partially Accept (Hold in L2)' : 'Confirm Supply & Send to L3'}
                  onApprove={() => {
                    if (isSupplyShorter) {
                      setPartialDemand(d);
                      setPartialComment(`Available supply (${totalAvail} units) is less than requested (${requested} units). Partially accepted; holding in Level 2 until next week.`);
                    } else {
                      setApproveDemand(d);
                      setApproveComment(`Factory supply confirmed (${totalAvail} units available). Full coverage verified.`);
                    }
                  }}
                  onReject={() => {
                    setRejectDemand(d);
                    setRejectReason('');
                    setRejectComment('');
                  }}
                  onViewTimeline={(id) => setViewTimelineId(id)}
                />

                {/* Level 2 Live Verification Rules Checklist */}
                <RulesChecklist level={2} demand={d} />

                {/* Factory Weeks Availability Breakdown */}
                {supplyRows.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <span>Monthly Available Supply Pool: <strong className="text-emerald-400">{totalAvail.toLocaleString()} units</strong></span>
                      <span>Demand: <strong className="text-white">{requested.toLocaleString()} units</strong></span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                      {supplyRows.map(s => (
                        <div key={s.supply_id} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-slate-500 block">W{s.week}</span>
                          <span className="text-cyan-400 font-bold">{Math.max(0, Number(s.available_quantity) - Number(s.allocated_quantity)).toLocaleString()}</span>
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

      {/* Partial Acceptance Modal (stays in Level 2) */}
      <Modal
        isOpen={Boolean(partialDemand)}
        onClose={() => setPartialDemand(null)}
        title={`Partially Accept Demand #${partialDemand?.demand_id} (Level 2)`}
        footer={
          <>
            <button
              onClick={() => setPartialDemand(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handlePartialAccept}
              disabled={partiallyAccepting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white font-mono shadow"
            >
              {partiallyAccepting ? 'Saving...' : 'Confirm Partial Acceptance (Hold in Level 2)'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-amber-300">
            Available supply is less than requested. Partially accepting will mark this order as <strong>Partially Accepted</strong> and keep it in Level 2 until additional supply is added.
          </p>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Validator Partial Acceptance Note *</label>
            <textarea
              value={partialComment}
              onChange={(e) => setPartialComment(e.target.value)}
              rows={3}
              placeholder="State reasons for partial acceptance and pending next week yield..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Full Approve Modal */}
      <Modal
        isOpen={Boolean(approveDemand)}
        onClose={() => setApproveDemand(null)}
        title={`Approve & Pass Demand #${approveDemand?.demand_id} to Level 3`}
        footer={
          <>
            <button
              onClick={() => setApproveDemand(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white font-mono shadow"
            >
              {approving ? 'Confirming...' : 'Approve & Advance to Level 3'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-300">
            Confirm full factory supply coverage for product <strong className="text-white">{approveDemand?.product_name}</strong>.
          </p>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Audit Comment *</label>
            <textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              rows={3}
              placeholder="State validation findings..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
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
          <p className="text-rose-400 font-semibold">
            Rejection will permanently stop this demand order and notify the customer.
          </p>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Reason for Rejection *</label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-rose-500 focus:outline-none"
            >
              <option value="">-- Select Supply Failure Reason --</option>
              <option value="No available supply plan for product">No available supply plan for product (Rule 2.1)</option>
              <option value="Zero factory production capacity exists">Zero factory production capacity exists (Rule 2.2)</option>
              <option value="Available supply below 30% minimum threshold">Available supply below 30% minimum threshold (Rule 2.3)</option>
              <option value="Export restriction violation (EU region)">Export restriction violation (EU region) (Rule 2.4)</option>
              <option value="Supply shortfall exceeds 50% threshold">Supply shortfall exceeds 50% threshold (Rule 2.5)</option>
              <option value="Factory capacity data inconsistency">Factory capacity data inconsistency (Rule 2.6)</option>
              <option value="General supply rejection">General supply rejection</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Detailed Rejection Comment *</label>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              placeholder="State the detailed reason for rejection..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
