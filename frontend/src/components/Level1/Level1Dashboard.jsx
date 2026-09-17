import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import DemandCard from '../Common/DemandCard';
import RuleViolationAlert from '../Common/RuleViolationAlert';
import RulesChecklist from '../Common/RulesChecklist';
import Modal from '../Common/Modal';
import DemandTimeline from '../Customer/DemandTimeline';
import { CheckSquare, RefreshCw, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function Level1Dashboard() {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Reject Modal State
  const [rejectDemand, setRejectDemand] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Approve Modal State
  const [approveDemand, setApproveDemand] = useState(null);
  const [approveComment, setApproveComment] = useState('');
  const [approving, setApproving] = useState(false);

  // Timeline Modal State
  const [viewTimelineId, setViewTimelineId] = useState(null);

  const fetchDemands = async () => {
    setLoading(true);
    try {
      const res = await api.getLevel1Demands();
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
      alert('Please enter an approval justification comment stating why this demand is accepted.');
      return;
    }
    setApproving(true);
    try {
      await api.approveLevel1(approveDemand.demand_id, approveComment);
      setMessage(`Demand #${approveDemand.demand_id} validated and forwarded to Level 2.`);
      setApproveDemand(null);
      setApproveComment('');
      fetchDemands();
    } catch (err) {
      alert(err.message);
    } finally {
      setApproving(false);
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
      await api.rejectLevel1(rejectDemand.demand_id, rejectReason, rejectComment);
      setMessage(`Demand #${rejectDemand.demand_id} has been rejected.`);
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
          <h2 className="text-xl font-extrabold text-white tracking-tight">Level 1: Demand & Credit Validator</h2>
          <p className="text-xs text-slate-400">
            Enforce customer creditworthiness, active product catalog lines, 90-day order horizons, and tier eligibility.
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

      {/* Demands Queue */}
      {loading ? (
        <p className="text-slate-500 text-xs font-mono py-12 text-center">Loading validation queue...</p>
      ) : demands.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-2">
          <CheckSquare className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Level 1 Queue Clear</p>
          <p className="text-xs text-slate-500">No new incoming customer demands requiring initial validation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {demands.map(d => (
            <div key={d.demand_id} className="space-y-2">
              <DemandCard
                demand={d}
                canApprove={true}
                actionButtonLabel="Accept & Send to L2"
                onApprove={() => {
                  setApproveDemand(d);
                  setApproveComment('Customer profile verified, credit limit buffer confirmed, active catalog line validated.');
                }}
                onReject={() => {
                  setRejectDemand(d);
                  setRejectReason('');
                  setRejectComment('');
                }}
                onViewTimeline={(id) => setViewTimelineId(id)}
              />

              {/* Live Rules Verification Checklist for Level 1 */}
              <RulesChecklist level={1} demand={d} />

              {/* Rule Validation Breakdown Banner */}
              <RuleViolationAlert 
                violations={d.validation?.errors || []}
                warnings={d.validation?.warnings || []}
              />
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={Boolean(approveDemand)}
        onClose={() => setApproveDemand(null)}
        title={`Accept Demand #${approveDemand?.demand_id} (Level 1)`}
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
              {approving ? 'Advancing...' : 'Confirm Acceptance & Forward to Level 2'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-300">
            Confirm customer creditworthiness and active product availability for <strong className="text-white">{approveDemand?.customer_name}</strong>.
          </p>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Acceptance Reason / Validator Comment *</label>
            <textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              rows={3}
              placeholder="State the reasons for accepting this demand..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={Boolean(rejectDemand)}
        onClose={() => setRejectDemand(null)}
        title={`Reject Demand #${rejectDemand?.demand_id} (Level 1)`}
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
              <option value="">-- Select Rule Failure Reason --</option>
              <option value="Customer credit limit exceeded">Customer credit limit exceeded (Rule 1.2)</option>
              <option value="Product discontinued or inactive">Product discontinued or inactive (Rule 1.3)</option>
              <option value="Invalid requested quantity">Invalid requested quantity (Rule 1.4)</option>
              <option value="Required date outside 90-day window">Required date outside 90-day window (Rule 1.5)</option>
              <option value="Customer tier ineligible for premium category">Customer tier ineligible for premium category (Rule 1.6)</option>
              <option value="Duplicate demand order already active">Duplicate demand order already active (Rule 1.7)</option>
              <option value="Administrative rejection">Administrative rejection</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Additional Explanatory Note</label>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              placeholder="Provide specific details regarding the rejection..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
