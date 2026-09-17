import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Bell, LogOut, Cpu, CheckCircle, Shield, AlertTriangle } from 'lucide-react';

export default function Navbar() {
  const { user, customer, logout, role } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  const fetchNotes = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch (e) {
      // ignore in polling
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotes();
      const interval = setInterval(fetchNotes, 8000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const getRoleBadgeColor = (r) => {
    switch (r) {
      case 'ADMIN': return 'bg-purple-900/60 text-purple-300 border-purple-500/40';
      case 'CUSTOMER': return 'bg-blue-900/60 text-blue-300 border-blue-500/40';
      case 'LEVEL1': return 'bg-sky-900/60 text-sky-300 border-sky-500/40';
      case 'LEVEL2': return 'bg-cyan-900/60 text-cyan-300 border-cyan-500/40';
      case 'LEVEL3': return 'bg-amber-900/60 text-amber-300 border-amber-500/40';
      case 'LEVEL4': return 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand Logo & Title */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Cpu className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-lg tracking-tight text-white">MICRON</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 font-mono border border-cyan-800/50">
              SUPPLY CHAIN OS
            </span>
          </div>
          <p className="text-xs text-slate-400">Demand & Supply Orchestration Platform</p>
        </div>
      </div>

      {/* User Context & Controls */}
      <div className="flex items-center space-x-4">
        {/* Role Badge */}
        <span className={`text-xs px-3 py-1 font-semibold rounded-full border flex items-center space-x-1.5 ${getRoleBadgeColor(role)}`}>
          <Shield className="w-3.5 h-3.5" />
          <span>{role}</span>
        </span>

        {/* Customer Badge if logged in as customer */}
        {customer && (
          <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700 font-mono">
            {customer.company_name} ({customer.tier})
          </span>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 relative transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotes && (
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Alerts & Actions</span>
                <span className="text-xs text-cyan-400">{unreadCount} new</span>
              </div>
              <div className="divide-y divide-slate-800/50">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center">No notifications</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.notification_id}
                      onClick={() => handleMarkRead(n.notification_id)}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-800/50 transition-colors ${n.is_read ? 'opacity-60' : 'bg-cyan-950/20'}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-slate-200">{n.title}</span>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1"></span>}
                      </div>
                      <p className="text-slate-400 mt-1 leading-relaxed">{n.body}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white">{user?.name}</p>
            <p className="text-[10px] text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/40 text-rose-400 hover:bg-rose-900/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
