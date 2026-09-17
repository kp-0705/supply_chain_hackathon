import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import DemandCard from '../Common/DemandCard';
import Modal from '../Common/Modal';
import DemandTimeline from '../Customer/DemandTimeline';
import { Sliders, RefreshCw, CheckCircle2, Layers, AlertTriangle } from 'lucide-react';

export default function Level3Dashboard() {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Modals
  const [approvingDemand, setApprovingDemand] = useState(null);
  const [approveComment, setApproveComment] = useState('');
  const [approving, setApproving] = useState(false);

  const [rejectingDemand, setRejectingDemand] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);
  
  const [viewTimelineId, setViewTimelineId] = useState(null);

  const fetchDemands = async () => {
    setLoading(true);
    try {
      const res = await api.getLevel3Demands();
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
    if (!approvingDemand) return;
    setApproving(true);
    try {
      await api.approveLevel3(approvingDemand.demand_id, approveComment);
      setMessage(`Demand #${approvingDemand.demand_id} business rules verified and queued for Level 4 Executive Approval.`);
      setApprovingDemand(null);
      setApproveComment('');
      fetchDemands();
    } catch (err) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingDemand) return;
    if (!rejectReason.trim()) {
      alert('Please specify a rejection reason');
      return;
    }
    setRejecting(true);
    try {
      await api.rejectLevel3(rejectingDemand.demand_id, rejectReason, rejectComment);
      setMessage(`Demand #${rejectingDemand.demand_id} rejected at Level 3. Allocations released.`);
      setRejectingDemand(null);
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
          <h2 className="text-xl font-extrabold text-white tracking-tight">Level 3: Business & Priority Review</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-mono">
              STAGE 3 OF 4
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Review fully allocated demands for customer priority, financial margins (&gt;8%), and order value constraints ($1M).
          </p>
        </div>
        <button
          onClick={fetchDemands}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Cockpit</span>
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
          <strong className="text-slate-200 block">Rule 3.2 & 3.3</strong>
          Tier & Date Queue Priority
        </div>
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
          <strong className="text-slate-200 block">Rule 3.5 & 3.6</strong>
          Margin &gt;8% & $1M Limit
        </div>
      </div>

      {/* Demand Queue */}
      {loading ? (
        <p className="text-slate-500 text-xs font-mono py-12 text-center">Loading matching planner cockpit...</p>
      ) : demands.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-2">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Matching Queue Clear</p>
          <p className="text-xs text-slate-500">No demands are currently awaiting supply matching or replenishment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {demands.map(d => (
            <div key={d.demand_id} className="space-y-2">
              <DemandCard
                demand={d}
                canApprove={true}
                actionButtonLabel="Approve Business Case & Send to L4"
                onApprove={() => setApprovingDemand(d)}
                onReject={() => setRejectingDemand(d)}
                onViewTimeline={(id) => setViewTimelineId(id)}
              />

              {/* Weekly Supply Breakdown Preview */}
              {d.supplyWeeks && d.supplyWeeks.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono flex items-center justify-between">
                  <span className="text-slate-400">Available Factory Weeks:</span>
                  <div className="flex space-x-2">
                    {d.supplyWeeks.map(sw => (
                      <span key={sw.supply_id} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]">
                        W{sw.week}: <strong className="text-cyan-400">{Number(sw.remaining_quantity).toLocaleString()}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={Boolean(approvingDemand)}
        onClose={() => setApprovingDemand(null)}
        title={`Confirm Business Approval for Demand #${approvingDemand?.demand_id}`}
        footer={
          <>
            <button
              onClick={() => setApprovingDemand(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white font-mono shadow"
            >
              {approving ? 'Approving...' : 'Approve & Pass to Level 4'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-300">
            Confirm business strategy, tier priority, and margins for <strong className="text-white">{approvingDemand?.customer_name}</strong>.
          </p>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Audit Comment (Optional)</label>
            <textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              rows={3}
              placeholder="e.g. Margin checked, priority confirmed."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={Boolean(rejectingDemand)}
        onClose={() => setRejectingDemand(null)}
        title={`Reject Demand #${rejectingDemand?.demand_id} (Level 3)`}
        footer={
          <>
            <button
              onClick={() => setRejectingDemand(null)}
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
              <option value="">-- Select Business Rejection Reason --</option>
              <option value="Unacceptable profit margin">Unacceptable profit margin (Rule 3.5)</option>
              <option value="Customer tier does not justify supply cost">Customer tier does not justify supply cost</option>
              <option value="Strategic reallocation required">Strategic reallocation required</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Additional Explanatory Note</label>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              placeholder="Provide business explanation..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
