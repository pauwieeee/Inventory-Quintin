import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function peso(n) {
  return `₱${Number(n || 0).toLocaleString()}`;
}

function Dashboard({ authUser, setError, refreshTick }) {
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API_BASE}/dashboard`),
      axios.get(`${API_BASE}/sales`)
    ])
      .then(([d, s]) => {
        setStats(d.data);
        setRecentSales(s.data.slice(0, 5));
      })
      .catch((err) => setError('Failed to load dashboard: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  }, [refreshTick, setError]);

  if (loading || !stats) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const isHost = authUser.role === 'host';
  const isAdmin = authUser.role === 'admin';

  const cards = [
    { label: 'Daily Cash', value: peso(stats.dailyCash), sub: 'Today cash' },
    { label: 'Daily Card', value: peso(stats.dailyCard), sub: 'Today card' },
    { label: 'Daily Sales', value: stats.dailySalesCount, sub: 'Orders today' },
    ...(isHost || isAdmin ? [{ label: 'Daily Discount', value: peso(stats.dailyDiscount), sub: 'Discount given', gray: true }] : []),
    { label: 'Monthly Cash', value: peso(stats.monthlyCash), sub: 'Month cash', dark: !(isHost || isAdmin) ? false : true },
    { label: 'Monthly Card', value: peso(stats.monthlyCard), sub: 'Month card', dark: true },
    { label: 'Monthly Sales', value: stats.monthlySalesCount, sub: 'Orders month', dark: true },
    ...(isHost || isAdmin ? [{ label: 'Monthly Discount', value: peso(stats.monthlyDiscount), sub: 'Discount month', gray: true }] : [])
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">
            {isHost ? 'Host Dashboard' : isAdmin ? 'Admin Dashboard' : 'Store Dashboard'} • {authUser.displayName}
          </div>
        </div>
        <div className="badge badge-black">
          {isHost ? `${stats.total_stores} stores` : isAdmin ? `${stats.total_stores} stores` : `${stats.total_products} products`}
        </div>
      </div>

      <div className={`stats-grid ${cards.length > 6 ? 'cols-4' : 'cols-3'}`}>
        {cards.map((c, i) => (
          <div key={i} className={`stat-card ${c.gray ? 'gray' : c.dark ? 'dark' : ''}`}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {stats.low_stock_products && stats.low_stock_products.length > 0 && (
        <div className="panel">
          <div className="panel-title">⚠️ Low Stock Alerts</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Min Level</th>
                </tr>
              </thead>
              <tbody>
                {stats.low_stock_products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="text-right">{p.current_quantity}</td>
                    <td className="text-right">{p.min_stock_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Recent Sales</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Store</th>
                <th>Product</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length === 0 ? (
                <tr><td colSpan="4" className="empty-state">No sales yet.</td></tr>
              ) : (
                recentSales.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.sale_date).toLocaleDateString()}</td>
                    <td>{s.store_name}</td>
                    <td>{s.product_name} x{s.quantity_sold}</td>
                    <td className="text-right">{peso(s.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
