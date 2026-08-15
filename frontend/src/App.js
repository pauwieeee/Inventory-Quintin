import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import SalesForm from './components/SalesForm';
import DeliveryForm from './components/DeliveryForm';
import TransactionHistory from './components/TransactionHistory';

export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Products' },
  { key: 'sales', label: 'Sales' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'history', label: 'History' }
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/products`);
      setProducts(res.data);
    } catch (err) {
      setError('Failed to load products: ' + (err.response?.data?.error || err.message));
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/dashboard`);
      setDashboard(res.data);
    } catch (err) {
      setError('Failed to load dashboard: ' + (err.response?.data?.error || err.message));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProducts(), fetchDashboard()]);
    setLoading(false);
  }, [fetchProducts, fetchDashboard]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => {
      fetchProducts();
      fetchDashboard();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshAll, fetchProducts, fetchDashboard]);

  // Some browsers treat Backspace as "navigate back" when focus isn't
  // inside an editable field, which would blow away the whole app mid-form.
  useEffect(() => {
    const blockBackspaceNavigation = (e) => {
      if (e.key !== 'Backspace') return;
      const el = e.target;
      const isEditable =
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable;
      if (!isEditable) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', blockBackspaceNavigation);
    return () => document.removeEventListener('keydown', blockBackspaceNavigation);
  }, []);

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

  const handleTransactionSuccess = (message) => {
    setSuccessMsg(message);
    fetchProducts();
    fetchDashboard();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📦 Inventory Management System</h1>
        <p>Real-time stock tracking with automatic sync</p>
      </header>

      <nav className="tab-nav">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {error && <div className="banner banner-error">{error}</div>}
        {successMsg && <div className="banner banner-success">{successMsg}</div>}

        {loading && !dashboard ? (
          <div className="spinner-container">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                dashboard={dashboard}
                products={products}
                onRefresh={refreshAll}
                setError={setError}
              />
            )}
            {activeTab === 'products' && (
              <ProductList
                products={products}
                onChange={refreshAll}
                setError={setError}
                setSuccessMsg={setSuccessMsg}
              />
            )}
            {activeTab === 'sales' && (
              <SalesForm
                products={products}
                onSuccess={handleTransactionSuccess}
                setError={setError}
              />
            )}
            {activeTab === 'delivery' && (
              <DeliveryForm
                products={products}
                onSuccess={handleTransactionSuccess}
                setError={setError}
              />
            )}
            {activeTab === 'history' && <TransactionHistory setError={setError} />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
