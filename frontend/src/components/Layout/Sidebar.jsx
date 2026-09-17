import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  BarChart3, 
  Package, 
  Layers, 
  CheckSquare, 
  Boxes, 
  Sliders, 
  Award, 
  PlusCircle, 
  History, 
  Users, 
  Sparkles 
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab }) {
  const { role, switchRole, demoAccounts } = useAuth();

  // Role Navigation Links
  const getNavItems = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { id: 'admin-dashboard', label: 'Executive Overview', icon: BarChart3 },
          { id: 'admin-supply', label: 'Supply Management', icon: Boxes },
          { id: 'admin-products', label: 'Product Catalog', icon: Package },
          { id: 'admin-customers', label: 'Customer Directory', icon: Users }
        ];
      case 'CUSTOMER':
        return [
          { id: 'customer-dashboard', label: 'My Demands', icon: Layers },
          { id: 'customer-submit', label: 'Submit Demand', icon: PlusCircle }
        ];
      case 'LEVEL1':
        return [
          { id: 'level1-dashboard', label: 'Demand Queue (L1)', icon: CheckSquare }
        ];
      case 'LEVEL2':
        return [
          { id: 'level2-dashboard', label: 'Supply Validation (L2)', icon: Boxes }
        ];
      case 'LEVEL3':
        return [
          { id: 'level3-dashboard', label: 'Matching Planner (L3)', icon: Sliders }
        ];
      case 'LEVEL4':
        return [
          { id: 'level4-dashboard', label: 'Executive Approver (L4)', icon: Award }
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="w-64 bg-slate-900/60 border-r border-slate-800/80 flex flex-col justify-between p-4 min-h-[calc(100vh-4rem)]">
      {/* Primary Navigation */}
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-3">
            Module Navigation
          </span>
          <nav className="mt-2 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Workflow Progression Map */}
        <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-2">
          <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>4-Stage Approval Flow</span>
          </div>
          <div className="space-y-1.5 text-slate-400 font-mono text-[10px]">
            <div className={`p-1.5 rounded ${role === 'LEVEL1' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'bg-slate-900'}`}>
              L1: Demand & Credit Check
            </div>
            <div className={`p-1.5 rounded ${role === 'LEVEL2' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'bg-slate-900'}`}>
              L2: Supply Plan Feasibility
            </div>
            <div className={`p-1.5 rounded ${role === 'LEVEL3' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'bg-slate-900'}`}>
              L3: Supply Matching & Margin
            </div>
            <div className={`p-1.5 rounded ${role === 'LEVEL4' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'bg-slate-900'}`}>
              L4: Executive Final Sign-Off
            </div>
          </div>
        </div>
      </div>

      {/* Quick Role Switcher (One-Click Testing) */}
      <div className="border-t border-slate-800 pt-4 mt-4">
        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-1 block mb-2">
          Demo Role Switcher
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {demoAccounts.map(account => {
            const isCurrent = role === account.role;
            return (
              <button
                key={account.role}
                onClick={() => switchRole(account.role)}
                title={account.desc}
                className={`px-2 py-1.5 text-[10px] font-semibold rounded-lg border transition-all text-left truncate ${
                  isCurrent
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {account.role}
              </button>
            );
          })}
        </div>
        <p className="text-[9px] text-slate-500 mt-2 text-center">
          Switch roles instantly to test approval queues
        </p>
      </div>
    </aside>
  );
}
