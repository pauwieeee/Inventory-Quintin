import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function peso(n) {
  return `₱${Number(n || 0).toLocaleString()}`;
}

function Report({ stores, setError, refreshTick }) {
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API_BASE}/dashboard`),
      axios.get(`${API_BASE}/sales`)
    ])
      .then(([d, s]) => { setStats(d.data); setSales(s.data); })
      .catch((err) => setError('Failed to load report: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  }, [refreshTick, setError]);

  if (loading || !stats) {
    return <div className="spinner-container"><div className="spinner"></div></div>;
  }

  const breakdown = stores.map((store) => {
    const storeSales = sales.filter((s) => s.store_id === store.id);
    const total = storeSales.reduce((sum, s) => sum + Number(s.total), 0);
    return { store, count: storeSales.length, total };
  });

  return (
    <div>
      <div className="page-head">
        <div className="page-title">Sales Report</div>
      </div>

      <div className="stats-grid cols-4">
        <div className="panel" style={{ margin: 0 }}>
          <div className="stat-label">TODAY TOTAL</div>
          <div className="stat-value">{peso(stats.dailyCash + stats.dailyCard)}</div>
          <div className="stat-sub">{stats.dailySalesCount} sales</div>
        </div>
        <div className="stat-card dark">
          <div className="stat-label">MONTH TOTAL</div>
          <div className="stat-value">{peso(stats.monthlyCash + stats.monthlyCard)}</div>
          <div className="stat-sub">{stats.monthlySalesCount} sales</div>
        </div>
        <div className="panel" style={{ margin: 0 }}>
          <div className="stat-label">CASH RATIO</div>
          <div className="stat-value" style={{ fontSize: 14 }}>{peso(stats.dailyCash)} cash / {peso(stats.dailyCard)} card</div>
          <div className="stat-sub">Today breakdown</div>
        </div>
        <div className="panel" style={{ margin: 0 }}>
          <div className="stat-label">DISCOUNT</div>
          <div className="stat-value" style={{ fontSize: 14 }}>{peso(stats.dailyDiscount)} today</div>
          <div className="stat-sub">{peso(stats.monthlyDiscount)} month</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Breakdown by Store</div>
        {breakdown.map((b) => (
          <div
            key={b.store.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)', background: '#fafafa', marginBottom: 8
            }}
          >
            <div style={{ fontWeight: 500, fontSize: 12 }}>{b.store.name}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 11, opacity: 0.6 }}>{b.count} sales</span>
              <b style={{ fontSize: 12 }}>{peso(b.total)}</b>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Report;
