import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, Sparkles, AlertCircle, CheckCircle2, DollarSign, Calendar } from 'lucide-react';
import RuleViolationAlert from '../Common/RuleViolationAlert';

export default function DemandSubmit({ onSuccess, onCancel }) {
  const { customer } = useAuth();
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(500);
  const [requiredDate, setRequiredDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);

  // Set default required date to 20 days in the future
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 20);
    setRequiredDate(d.toISOString().split('T')[0]);

    async function loadProducts() {
      try {
        const res = await api.getCustomerProducts();
        setProducts(res.data);
        if (res.data.length > 0) {
          setSelectedProductId(res.data[0].product_id);
        }
      } catch (err) {}
    }
    loadProducts();
  }, []);

  const selectedProduct = products.find(p => Number(p.product_id) === Number(selectedProductId));
  const estimatedOrderValue = selectedProduct ? Number(quantity) * Number(selectedProduct.unit_price) : 0;
  const creditLimit = Number(customer?.credit_limit || 10000000);
  const isCreditExceeded = estimatedOrderValue > creditLimit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    setSuccessMessage(null);

    try {
      const res = await api.submitDemand({
        product_id: Number(selectedProductId),
        requested_quantity: Number(quantity),
        required_date: requiredDate
      });
      setSuccessMessage(`Demand #${res.data.demand_id} successfully created and entered into Level 1 validation queue!`);
      if (onSuccess) {
        setTimeout(() => onSuccess(res.data.demand_id), 1200);
      }
    } catch (err) {
      if (err.errors && err.errors.length > 0) {
        setErrors(err.errors);
      } else {
        setErrors([{ rule: 'L1', message: err.message }]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Submit Procurement Demand</h2>
          <p className="text-xs text-slate-400">Request semiconductor wafer or module allocation through Micron multi-tier approval workflow</p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 transition-colors"
          >
            <span>Cancel</span>
          </button>
        )}
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errors.length > 0 && (
        <RuleViolationAlert violations={errors} />
      )}

      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5 text-xs">
        {/* Product Selection */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Semiconductor Product</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono focus:border-cyan-500 focus:outline-none text-xs"
          >
            {products.map(p => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name} — ${Number(p.unit_price).toFixed(2)} / unit [{p.category}] {p.status !== 'ACTIVE' ? '(DISCONTINUED)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Quantity & Required Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Requested Quantity (Units)</label>
            <input
              type="number"
              min="1"
              max="999999"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. 1000"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Required Delivery Date</label>
            <input
              type="date"
              required
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Live Pre-Validation Telemetry Box */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span>Estimated Order Value:</span>
            <strong className="text-white text-sm">${estimatedOrderValue.toLocaleString()}</strong>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Available Credit Limit:</span>
            <span className={isCreditExceeded ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              ${creditLimit.toLocaleString()}
            </span>
          </div>

          {isCreditExceeded && (
            <p className="text-[11px] text-rose-400 flex items-center space-x-1 font-sans">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Warning: Order value exceeds authorized customer credit limit. Will fail Rule 1.2.</span>
            </p>
          )}

          {selectedProduct?.status === 'DISCONTINUED' && (
            <p className="text-[11px] text-rose-400 flex items-center space-x-1 font-sans">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Warning: Selected product line is discontinued. Will fail Rule 1.3.</span>
            </p>
          )}
        </div>

        {/* AI Estimation Note */}
        <div className="flex items-start space-x-2 text-[11px] text-cyan-300/80 bg-cyan-950/30 border border-cyan-800/40 p-3 rounded-xl font-sans">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            Upon submission, Micron's AI Allocation Engine will analyze seasonal factory run rates, historical yield, and customer tier priority to generate a fulfillment confidence score.
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all font-mono"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{submitting ? 'Submitting & Validating...' : 'Submit Demand Request'}</span>
        </button>
      </form>
    </div>
  );
}
