import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import DemandCard from '../Common/DemandCard';
import Modal from '../Common/Modal';
import MatchingPlanner from './MatchingPlanner';
import DemandTimeline from '../Customer/DemandTimeline';
import RulesChecklist from '../Common/RulesChecklist';
import { Sliders, RefreshCw, CheckCircle2, Layers, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';

export default function Level3Dashboard() {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Selected demand for allocation cockpit
  const [allocatingDemand, setAllocatingDemand] = useState(null);
  const [viewTimelineId, setViewTimelineId] = useState(null);

  // Reject state
  const [rejectingDemand, setRejectingDemand] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [rejectError, setRejectError] = useState(null);
  const [submittingReject, setSubmittingReject] = useState(false);

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

  const handleAllocationSuccess = (result) => {
    setAllocatingDemand(null);
    setMessage(
      result.isFullyAllocated
        ? `Demand #${result.demandId} fully allocated (${result.allocatedQty} units) and forwarded to Level 4.`
        : `Demand #${result.demandId} partially allocated (${result.allocatedQty}/${result.requestedQty} units). Retained at Level 3 awaiting supply replenishment.`
    );
    fetchDemands();
  };

  const handleConfirmReject = async () => {
    if (!rejectReason) {
      setRejectError('Please select a rejection reason');
      return;
    }
    if (!rejectComment.trim()) {
      setRejectError('A planner comment explaining the rejection rationale is required');
      return;
    }

    setSubmittingReject(true);
    setRejectError(null);
    try {
      await api.rejectLevel3(rejectingDemand.demand_id, rejectReason, rejectComment);
      setMessage(`Demand #${rejectingDemand.demand_id} has been rejected at Level 3.`);
      setRejectingDemand(null);
      setRejectReason('');
      setRejectComment('');
      fetchDemands();
    } catch (err) {
      setRejectError(err.message || 'Failed to reject demand');
    } finally {
      setSubmittingReject(false);
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
          <h2 className="text-xl font-extrabold text-white tracking-tight">Level 3: Matching & Allocation Planner</h2>
          <p className="text-xs text-slate-400">
            Allocate available factory supply FIFO across weeks 1–4, calculate live order margins, and flag high-value orders for executive review.
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
            <div key={d.demand_id} className="space-y-3">
              <DemandCard
                demand={d}
                showAllocateButton={true}
                onAllocate={() => setAllocatingDemand(d)}
                onReject={() => {
                  setRejectingDemand(d);
                  setRejectReason('');
                  setRejectComment('');
                  setRejectError(null);
                }}
                onViewTimeline={(id) => setViewTimelineId(id)}
              />

              {/* Live Level 3 Rules Checklist */}
              <RulesChecklist level={3} demand={d} />

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

      {/* Allocation Cockpit Modal */}
      <Modal
        isOpen={Boolean(allocatingDemand)}
        onClose={() => setAllocatingDemand(null)}
        title="Supply Matching & Inventory Allocation Cockpit"
      >
        {allocatingDemand && (
          <MatchingPlanner
            demand={allocatingDemand}
            onClose={() => setAllocatingDemand(null)}
            onAllocationComplete={handleAllocationSuccess}
          />
        )}
      </Modal>

      {/* Rejection Modal */}
      <Modal
        isOpen={Boolean(rejectingDemand)}
        onClose={() => setRejectingDemand(null)}
        title={`Reject Demand #${rejectingDemand?.demand_id}`}
      >
        {rejectingDemand && (
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/60 text-rose-300 space-y-1">
              <p className="font-bold flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Level 3 Matching Planner Rejection</span>
              </p>
              <p className="text-[11px] text-slate-300">
                Provide the operational reason and comments explaining why this demand cannot be allocated.
              </p>
            </div>

            {rejectError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-700 text-rose-200 text-xs flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{rejectError}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-bold mb-1">Select Rejection Reason *</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-rose-500 focus:outline-none"
              >
                <option value="">-- Select Rule Failure / Reason --</option>
                <option value="Rule 3.5: Profit margin below 8% threshold">Rule 3.5: Profit margin below 8% threshold</option>
                <option value="Rule 3.7: Inability to resolve weekly supply conflicts">Rule 3.7: Inability to resolve weekly supply conflicts</option>
                <option value="Production line reallocation">Production line reallocation</option>
                <option value="Capacity constraint cannot meet delivery window">Capacity constraint cannot meet delivery window</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Planner Audit Comment *</label>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={3}
                placeholder="Explain the specific scheduling conflict or margin calculation..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingDemand(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReject}
                onClick={handleConfirmReject}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-600/20"
              >
                <XCircle className="w-4 h-4" />
                <span>{submittingReject ? 'Rejecting...' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
