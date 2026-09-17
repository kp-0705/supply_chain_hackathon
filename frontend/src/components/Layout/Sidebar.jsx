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
  History 
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab }) {
  const { role } = useAuth();

  // Exactly 2 primary actions/modules per role
  const getNavItems = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { id: 'admin-supply', label: 'Supply Management', icon: Boxes },
          { id: 'admin-dashboard', label: 'Overview & Catalog', icon: BarChart3 }
        ];
      case 'CUSTOMER':
        return [
          { id: 'customer-submit', label: 'Submit Demand', icon: PlusCircle },
          { id: 'customer-dashboard', label: 'My Demands', icon: Layers }
        ];
      case 'LEVEL1':
        return [
          { id: 'level1-dashboard', label: 'Demand Queue', icon: CheckSquare },
          { id: 'level1-history', label: 'Validation History', icon: History }
        ];
      case 'LEVEL2':
        return [
          { id: 'level2-dashboard', label: 'Supply Validation', icon: Boxes },
          { id: 'level2-supply', label: 'Supply Overview', icon: Layers }
        ];
      case 'LEVEL3':
        return [
          { id: 'level3-dashboard', label: 'Matching Planner', icon: Sliders },
          { id: 'level3-supply', label: 'Supply Availability', icon: Boxes }
        ];
      case 'LEVEL4':
        return [
          { id: 'level4-dashboard', label: 'Executive Approvals', icon: Award },
          { id: 'level4-history', label: 'Approved Orders', icon: CheckSquare }
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="w-64 bg-slate-900/60 border-r border-slate-800/80 flex flex-col justify-between p-4 min-h-[calc(100vh-4rem)]">
      <div className="space-y-4">
        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-3">
          Operations
        </span>
        <nav className="space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
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

      <div className="border-t border-slate-800/80 pt-4 text-[10px] text-slate-500 text-center font-mono">
        Micron Enterprise OS &bull; Logged in as {role}
      </div>
    </aside>
  );
}
