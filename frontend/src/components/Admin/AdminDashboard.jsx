import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  BarChart3, 
  Boxes, 
  Layers, 
  AlertTriangle, 
  DollarSign, 
  Plus, 
  Package, 
  Users, 
  CheckCircle2 
} from 'lucide-react';
import Modal from '../Common/Modal';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    product_name: '',
    category: 'PREMIUM',
    unit_price: 350,
    standard_cost: 260,
    status: 'ACTIVE'
  });

  // New Customer Modal State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    customer_name: '',
    company_name: '',
    email: '',
    tier: 'STANDARD',
    priority: 'NORMAL',
    credit_limit: 1000000,
    region: 'US'
  });

  const [message, setMessage] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, prodRes, custRes] = await Promise.all([
        api.getStats(),
        api.listProducts(),
        api.listCustomers()
      ]);
      setStats(statsRes.data);
      setProducts(prodRes.data);
      setCustomers(custRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await api.createProduct(newProduct);
      setMessage('Product created successfully');
      setShowProductModal(false);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await api.createCustomer(newCustomer);
      setMessage('Customer registered successfully');
      setShowCustomerModal(false);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Executive Supply Chain Cockpit</h2>
          <p className="text-xs text-slate-400">Global semiconductor capacity allocation and demand fulfillment telemetry</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowProductModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/70 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/60 text-xs font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Product</span>
          </button>
          <button
            onClick={() => setShowCustomerModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-950/70 border border-blue-800 text-blue-300 hover:bg-blue-900/60 text-xs font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Supply Capacity */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Supply Capacity</span>
            <Boxes className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {Number(stats?.supply?.total_supply || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Allocated: <span className="text-cyan-400 font-bold">{Number(stats?.supply?.total_allocated || 0).toLocaleString()}</span> units
          </p>
        </div>

        {/* Active Demands */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Demand Orders</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {stats?.demands?.total_demands || 0}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Pending: <span className="text-amber-400 font-bold">{stats?.demands?.pending_demands || 0}</span> | Partial: <span className="text-purple-400 font-bold">{stats?.demands?.partial_demands || 0}</span>
          </p>
        </div>

        {/* Exceptions */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Open Exceptions</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 font-mono">
            {stats?.exceptions?.open_exceptions || 0}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Requires Level 4 review
          </p>
        </div>

        {/* Total Fulfilled Revenue */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Approved Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">
            ${Number(stats?.approvals?.total_revenue || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            {stats?.approvals?.approved_orders || 0} final approved orders
          </p>
        </div>
      </div>

      {/* Two Column Grid: Products & Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products List */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Package className="w-4 h-4 text-cyan-400" />
              <span>Semiconductor Catalog</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{products.length} products</span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
            {products.map(p => {
              const price = Number(p.unit_price);
              const cost = Number(p.standard_cost);
              const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) : 0;

              return (
                <div key={p.product_id} className="py-3 flex items-center justify-between text-xs font-mono">
                  <div>
                    <p className="font-semibold text-white">{p.product_name}</p>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">{p.category}</span>
                      <span className={p.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}>{p.status}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-200">${price.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500">Cost: ${cost.toFixed(2)} ({margin}% margin)</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customers Directory */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Customer Profiles & Credit Exposure</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{customers.length} partners</span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
            {customers.map(c => (
              <div key={c.customer_id} className="py-3 flex items-center justify-between text-xs font-mono">
                <div>
                  <p className="font-semibold text-white">{c.customer_name}</p>
                  <p className="text-[11px] text-slate-400">{c.company_name} ({c.region})</p>
                </div>
                <div className="text-right space-y-0.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                    c.tier === 'STRATEGIC' ? 'bg-purple-950 text-purple-300 border-purple-800' : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {c.tier}
                  </span>
                  <p className="text-[11px] text-slate-400">Limit: ${Number(c.credit_limit).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Product Modal */}
      <Modal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title="Add Semiconductor Product"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowProductModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="createProductForm"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white font-mono shadow"
            >
              Save Product
            </button>
          </>
        }
      >
        <form id="createProductForm" onSubmit={handleCreateProduct} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Product Name</label>
            <input
              type="text"
              required
              value={newProduct.product_name}
              onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. Micron DDR5 64GB Server DIMM"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Category</label>
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="PREMIUM">PREMIUM (High Margin)</option>
                <option value="STANDARD">STANDARD</option>
                <option value="RESTRICTED_EXPORT">RESTRICTED_EXPORT (No EU)</option>
                <option value="LEGACY">LEGACY</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Status</label>
              <select
                value={newProduct.status}
                onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISCONTINUED">DISCONTINUED</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Unit Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={newProduct.unit_price}
                onChange={(e) => setNewProduct({ ...newProduct, unit_price: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Standard Cost ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={newProduct.standard_cost}
                onChange={(e) => setNewProduct({ ...newProduct, standard_cost: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* New Customer Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title="Register Customer Enterprise"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCustomerModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="createCustomerForm"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white font-mono shadow"
            >
              Save Customer
            </button>
          </>
        }
      >
        <form id="createCustomerForm" onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Customer Enterprise Name</label>
            <input
              type="text"
              required
              value={newCustomer.customer_name}
              onChange={(e) => setNewCustomer({ ...newCustomer, customer_name: e.target.value, company_name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. Nvidia Corporation"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Business Email</label>
            <input
              type="email"
              required
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="procurement@nvidia.com"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Tier</label>
              <select
                value={newCustomer.tier}
                onChange={(e) => setNewCustomer({ ...newCustomer, tier: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="STRATEGIC">STRATEGIC</option>
                <option value="STANDARD">STANDARD</option>
                <option value="SPOT">SPOT</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Priority</label>
              <select
                value={newCustomer.priority}
                onChange={(e) => setNewCustomer({ ...newCustomer, priority: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="HIGH">HIGH</option>
                <option value="NORMAL">NORMAL</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Region</label>
              <select
                value={newCustomer.region}
                onChange={(e) => setNewCustomer({ ...newCustomer, region: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="US">US</option>
                <option value="EU">EU</option>
                <option value="APAC">APAC</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Credit Limit ($)</label>
            <input
              type="number"
              min="0"
              required
              value={newCustomer.credit_limit}
              onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
