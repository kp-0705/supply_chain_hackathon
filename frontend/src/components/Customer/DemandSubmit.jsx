import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, AlertCircle, CheckCircle2, DollarSign, Calendar, Package } from 'lucide-react';
import RuleViolationAlert from '../Common/RuleViolationAlert';

export default function DemandSubmit({ onSuccess }) {
  const { customer } = useAuth();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
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
      setLoadingProducts(true);
      try {
        const res = await api.listProducts();
        const prodList = res.data || [];
        setProducts(prodList);
        if (prodList.length > 0) {
          setSelectedProductId(prodList[0].product_id);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        setErrors([{ rule: 'SYSTEM', message: 'Failed to load product catalog: ' + err.message }]);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, []);

  const selectedProduct = products.find(p => Number(p.product_id) === Number(selectedProductId));
  const estimatedOrderValue = selectedProduct ? Number(quantity) * Number(selectedProduct.unit_price) : 0;
  const creditLimit = Number(customer?.credit_limit || 10000000);
  const isCreditExceeded = estimatedOrderValue > creditLimit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      setErrors([{ rule: 'INPUT', message: 'Please select a semiconductor product from the list.' }]);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    setSuccessMessage(null);

    try {
      const res = await api.submitDemand({
        product_id: Number(selectedProductId),
        requested_quantity: Number(quantity),
        required_date: requiredDate
      });
      setSuccessMessage(`Demand #${res.data.demand_id} successfully created and submitted!`);
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
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Submit Procurement Demand</h2>
        <p className="text-xs text-slate-400">Request semiconductor wafer or memory module allocation</p>
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
          <label className="block text-slate-400 font-semibold mb-1">Select Semiconductor Product</label>
          {loadingProducts ? (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-mono">
              Loading available products...
            </div>
          ) : products.length === 0 ? (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800 text-rose-300 text-xs font-mono">
              No products available in catalog.
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono focus:border-cyan-500 focus:outline-none text-xs cursor-pointer"
              >
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id} className="bg-slate-900 text-white">
                    {p.product_name} — ${Number(p.unit_price).toFixed(2)} [{p.category}] {p.status !== 'ACTIVE' ? '(DISCONTINUED)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
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

        {/* Live Calculation Preview Box */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span>Estimated Order Value:</span>
            <strong className="text-white text-sm">${estimatedOrderValue.toLocaleString()}</strong>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Customer Credit Limit:</span>
            <span className={isCreditExceeded ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              ${creditLimit.toLocaleString()}
            </span>
          </div>

          {isCreditExceeded && (
            <p className="text-[11px] text-rose-400 flex items-center space-x-1 font-sans">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Warning: Order value exceeds customer credit limit.</span>
            </p>
          )}

          {selectedProduct?.status === 'DISCONTINUED' && (
            <p className="text-[11px] text-rose-400 flex items-center space-x-1 font-sans">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Warning: Selected product line is discontinued.</span>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || loadingProducts || products.length === 0}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all font-mono disabled:opacity-50"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{submitting ? 'Submitting Demand...' : 'Submit Demand Request'}</span>
        </button>
      </form>
    </div>
  );
}
