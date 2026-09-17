import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const DEMO_ACCOUNTS = [
  { role: 'ADMIN', name: 'System Admin', email: 'admin@micron.com', desc: 'Manage supply & products' },
  { role: 'CUSTOMER', name: 'Apple Procurement', email: 'apple_buyer@apple.com', desc: 'Submit & track demands' },
  { role: 'LEVEL1', name: 'David Chen (L1)', email: 'level1@micron.com', desc: 'Demand & Credit Validator' },
  { role: 'LEVEL2', name: 'Sarah Jenkins (L2)', email: 'level2@micron.com', desc: 'Supply Plan Validator' },
  { role: 'LEVEL3', name: 'Marcus Brody (L3)', email: 'level3@micron.com', desc: 'Matching & Allocation Planner' },
  { role: 'LEVEL4', name: 'Elena Rostova (L4)', email: 'level4@micron.com', desc: 'Executive Sign-off & Overrides' }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize from existing session
  useEffect(() => {
    async function checkSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        setUser(res.data.user);
        setCustomer(res.data.customer);
      } catch (err) {
        console.warn('Session expired or invalid token:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [token]);

  const login = async (email, password = 'password123') => {
    const res = await api.login(email, password);
    const { token: newToken, user: newUser, customer: newCust } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    setCustomer(newCust);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setCustomer(null);
  };

  const switchRole = async (targetRole) => {
    const demo = DEMO_ACCOUNTS.find(a => a.role === targetRole);
    if (demo) {
      await login(demo.email, 'password123');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customer,
        token,
        role: user?.role || null,
        loading,
        login,
        logout,
        switchRole,
        demoAccounts: DEMO_ACCOUNTS
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
