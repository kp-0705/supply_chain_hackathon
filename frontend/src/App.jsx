import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/Auth/LoginPage';
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';

// Dashboards
import AdminDashboard from './components/Admin/AdminDashboard';
import SupplyManagement from './components/Admin/SupplyManagement';
import CustomerDashboard from './components/Customer/CustomerDashboard';
import DemandSubmit from './components/Customer/DemandSubmit';
import Level1Dashboard from './components/Level1/Level1Dashboard';
import Level2Dashboard from './components/Level2/Level2Dashboard';
import Level3Dashboard from './components/Level3/Level3Dashboard';
import Level4Dashboard from './components/Level4/Level4Dashboard';

function MainLayout() {
  const { user, role, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Sync activeTab default whenever role changes
  useEffect(() => {
    if (role === 'ADMIN') setActiveTab('admin-dashboard');
    else if (role === 'CUSTOMER') setActiveTab('customer-dashboard');
    else if (role === 'LEVEL1') setActiveTab('level1-dashboard');
    else if (role === 'LEVEL2') setActiveTab('level2-dashboard');
    else if (role === 'LEVEL3') setActiveTab('level3-dashboard');
    else if (role === 'LEVEL4') setActiveTab('level4-dashboard');
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-xs">
        Initializing Micron Supply Chain Engine...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      // Admin Tabs
      case 'admin-dashboard':
      case 'admin-products':
      case 'admin-customers':
        return <AdminDashboard />;
      case 'admin-supply':
        return <SupplyManagement />;

      // Customer Tabs
      case 'customer-dashboard':
        return <CustomerDashboard onNavigateSubmit={() => setActiveTab('customer-submit')} />;
      case 'customer-submit':
        return <DemandSubmit onSuccess={() => setActiveTab('customer-dashboard')} onCancel={() => setActiveTab('customer-dashboard')} />;

      // Approval Level Tabs
      case 'level1-dashboard':
        return <Level1Dashboard />;
      case 'level2-dashboard':
        return <Level2Dashboard />;
      case 'level3-dashboard':
        return <Level3Dashboard />;
      case 'level4-dashboard':
        return <Level4Dashboard />;

      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
