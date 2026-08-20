import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import SalesPage from './components/SalesPage';
import History from './components/History';
import Report from './components/Report';
import Team from './components/Team';

export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'sales', label: 'Sales', icon: '🛍' },
  { key: 'inventory', label: 'Inventory', icon: '📦' },
  { key: 'history', label: 'History', icon: '🕘' },
  { key: 'report', label: 'Sales Report', icon: '📊' }
];

function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [authUser, setAuthUser] = useState(() => {
    const stored = localStorage.getItem('authUser');
    return stored ? JSON.parse(stored) : null;
  });

  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);

  // Set synchronously (not in a useEffect) so it's guaranteed to be in place
  // before any request fires — avoids a race where the first authenticated
  // fetch goes out without the header and gets bounced with a 401.
  if (authToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }

  const handleLogin = (token, user) => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
    setAuthToken(token);
    setAuthUser(user);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setAuthToken(null);
    setAuthUser(null);
  }, []);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const isPasswordCheck = err.config?.url?.includes('/auth/verify-password');
        if (err.response?.status === 401 && !isPasswordCheck) handleLogout();
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [handleLogout]);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    if (!authToken) return;
    axios.get(`${API_BASE}/stores`).then((r) => setStores(r.data)).catch(() => {});
    axios.get(`${API_BASE}/categories`).then((r) => setCategories(r.data)).catch(() => {});
  }, [authToken, refreshTick]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // Backspace-as-browser-back guard (some browsers do this outside editable fields)
  useEffect(() => {
    const guard = (e) => {
      if (e.key !== 'Backspace') return;
      const el = e.target;
      const editable =
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
      if (!editable) e.preventDefault();
    };
    document.addEventListener('keydown', guard);
    return () => document.removeEventListener('keydown', guard);
  }, []);

  if (!authToken || !authUser) {
    return <Login onLogin={handleLogin} />;
  }

  const isHost = authUser.role === 'host';
  const isStaff = authUser.role === 'staff';

  const navItems = isHost ? [...NAV_ITEMS, { key: 'team', label: 'Team', icon: '👥' }] : NAV_ITEMS;

  const sharedProps = {
    authUser, stores, categories,
    setError, setSuccessMsg, refresh, refreshTick
  };

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={() => setSidebarOpen((s) => !s)} aria-label="Open menu">☰</button>
        <div className="topbar-logo">AH</div>
        <div className="topbar-brand">AccessoryHub</div>
        <div className="topbar-user">
          <span>{authUser.displayName}</span>
          <span className="role-badge">{authUser.role.toUpperCase()}</span>
        </div>
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <div className="topbar-brand">Menu</div>
          <button className="icon-btn" onClick={() => setSidebarOpen(false)} aria-label="Close menu">✕</button>
        </div>
        <div className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-nav-btn ${page === item.key ? 'active' : ''}`}
              onClick={() => { setPage(item.key); setSidebarOpen(false); }}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user-name">{authUser.displayName}</div>
          <div className="sidebar-user-meta">
            {authUser.username} • {authUser.role}{authUser.storeId ? ` • store #${authUser.storeId}` : ''}
          </div>
          {isStaff && <span className="view-only-badge" style={{ marginBottom: 8, display: 'inline-block' }}>View Only</span>}
          <button className="logout-btn" onClick={handleLogout}>⎋ Log out</button>
        </div>
      </div>

      <div className="page-content">
        {error && <div className="banner banner-error">{error}</div>}
        {successMsg && <div className="banner banner-success">{successMsg}</div>}

        {page === 'dashboard' && <Dashboard {...sharedProps} />}
        {page === 'inventory' && <Inventory {...sharedProps} />}
        {page === 'sales' && <SalesPage {...sharedProps} />}
        {page === 'history' && <History {...sharedProps} />}
        {page === 'report' && <Report {...sharedProps} />}
        {page === 'team' && isHost && <Team {...sharedProps} onSelfUpdate={handleLogin} />}
      </div>
    </div>
  );
}

export default App;
