import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Boxes, Calendar, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function SupplyManagement() {
  const [supplyList, setSupplyList] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(9); // Default Sept
  const [week, setWeek] = useState(1);
  const [quantity, setQuantity] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supRes, prodRes] = await Promise.all([
        api.listSupply(),
        api.listProducts()
      ]);
      setSupplyList(supRes.data);
      setProducts(prodRes.data);
      if (prodRes.data.length > 0 && !selectedProduct) {
        setSelectedProduct(prodRes.data[0].product_id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSupply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await api.addSupply({
        product_id: Number(selectedProduct),
        month: Number(selectedMonth),
        week: Number(week),
        available_quantity: Number(quantity)
      });
      setMessage({
        type: 'success',
        text: res.message + (res.data?.autoCompletedDemands?.length > 0 ? ` (Auto-completed ${res.data.autoCompletedDemands.length} partial demands!)` : '')
      });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Group supply by product & month
  const groupedSupply = {};
  supplyList.forEach(s => {
    const key = `${s.product_name} (Month ${s.month})`;
    if (!groupedSupply[key]) {
      groupedSupply[key] = { product_name: s.product_name, month: s.month, weeks: {} };
    }
    groupedSupply[key].weeks[s.week] = s;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Weekly Supply Planning & Capacity</h2>
          <p className="text-xs text-slate-400">Configure weekly factory allocation capacity for Month 1–12 (4 weeks per month)</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Add Supply Form Box */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
          <Boxes className="w-4 h-4" />
          <span>Add / Update Weekly Supply Capacity</span>
        </h3>

        {message && (
          <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
            message.type === 'success' 
              ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300' 
              : 'bg-rose-950/40 border border-rose-800 text-rose-300'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleAddSupply} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Target Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
            >
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} (${Number(p.unit_price).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Target Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
            >
              <option value="9">Month 9 (September 2026)</option>
              <option value="10">Month 10 (October 2026)</option>
              <option value="11">Month 11 (November 2026)</option>
              <option value="12">Month 12 (December 2026)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Production Week</label>
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
            >
              <option value="1">Week 1 (Days 1–7)</option>
              <option value="2">Week 2 (Days 8–14)</option>
              <option value="3">Week 3 (Days 15–21)</option>
              <option value="4">Week 4 (Days 22–30)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Capacity (Units)</label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. 1000"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold tracking-wide shadow-md shadow-cyan-600/20 flex items-center justify-center space-x-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Updating...' : 'Publish Supply'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Supply Matrix by Product & Week */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Monthly Supply Grid</h3>

        {loading ? (
          <p className="text-slate-500 text-xs font-mono py-8 text-center">Loading supply plans...</p>
        ) : Object.keys(groupedSupply).length === 0 ? (
          <p className="text-slate-500 text-xs font-mono py-8 text-center">No supply plans configured.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(groupedSupply).map(([key, group]) => {
              const totalMonthAvail = [1, 2, 3, 4].reduce((sum, w) => sum + Number(group.weeks[w]?.available_quantity || 0), 0);
              const totalMonthAlloc = [1, 2, 3, 4].reduce((sum, w) => sum + Number(group.weeks[w]?.allocated_quantity || 0), 0);
              const remaining = totalMonthAvail - totalMonthAlloc;

              return (
                <div key={key} className="glass-card rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{group.product_name}</h4>
                      <p className="text-[11px] text-cyan-400 font-mono">Month {group.month} Planning Cycle</p>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <span className="text-slate-400">Month Total: </span>
                      <strong className="text-white">{totalMonthAlloc.toLocaleString()}</strong>
                      <span className="text-slate-500"> / {totalMonthAvail.toLocaleString()} units</span>
                      <span className="text-emerald-400 ml-2 font-bold">({remaining.toLocaleString()} left)</span>
                    </div>
                  </div>

                  {/* 4 Weeks Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(w => {
                      const data = group.weeks[w];
                      const avail = Number(data?.available_quantity || 0);
                      const alloc = Number(data?.allocated_quantity || 0);
                      const rem = avail - alloc;
                      const pct = avail > 0 ? ((alloc / avail) * 100).toFixed(0) : 0;

                      return (
                        <div key={w} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-300 font-mono">WEEK {w}</span>
                            <span className="text-[10px] font-mono text-slate-500">{pct}% alloc</span>
                          </div>

                          <div className="space-y-1 font-mono text-xs">
                            <div className="flex justify-between text-slate-400 text-[11px]">
                              <span>Cap:</span>
                              <span className="text-slate-200">{avail.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-400 text-[11px]">
                              <span>Alloc:</span>
                              <span className="text-cyan-400 font-semibold">{alloc.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-emerald-400 font-bold text-[11px] pt-1 border-t border-slate-800/60">
                              <span>Avail:</span>
                              <span>{rem.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${Number(pct) >= 100 ? 'bg-rose-500' : Number(pct) > 70 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
