import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function peso(n) {
  return `₱${Number(n || 0).toLocaleString()}`;
}

function Report({ stores, setError, refreshTick }) {
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    Promise.all([
      axios.get(`${API_BASE}/dashboard`),
      axios.get(`${API_BASE}/sales`, { params })
    ])
      .then(([d, s]) => { setStats(d.data); setSales(s.data); })
      .catch((err) => setError('Failed to load report: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  }, [refreshTick, from, to, setError]);

  const rangeActive = Boolean(from || to);

  const rangeTotals = useMemo(() => {
    return sales.reduce(
      (acc, s) => {
        acc.cash += Number(s.cash_amount);
        acc.card += Number(s.card_amount);
        acc.discount += Number(s.discount_amount);
        acc.count += 1;
        return acc;
      },
      { cash: 0, card: 0, discount: 0, count: 0 }
    );
  }, [sales]);

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

      <div className="date-filter-row">
        <label>From</label>
        <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <label>To</label>
        <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        {rangeActive && (
          <button className="btn btn-outline btn-sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</button>
        )}
      </div>

      {rangeActive ? (
        <div className="stats-grid cols-4">
          <div className="panel" style={{ margin: 0 }}>
            <div className="stat-label">RANGE TOTAL</div>
            <div className="stat-value">{peso(rangeTotals.cash + rangeTotals.card)}</div>
            <div className="stat-sub">{rangeTotals.count} sales</div>
          </div>
          <div className="stat-card dark">
            <div className="stat-label">CASH</div>
            <div className="stat-value">{peso(rangeTotals.cash)}</div>
            <div className="stat-sub">Cash payments</div>
          </div>
          <div className="stat-card dark">
            <div className="stat-label">CARD</div>
            <div className="stat-value">{peso(rangeTotals.card)}</div>
            <div className="stat-sub">Card payments</div>
          </div>
          <div className="panel" style={{ margin: 0 }}>
            <div className="stat-label">DISCOUNT</div>
            <div className="stat-value">{peso(rangeTotals.discount)}</div>
            <div className="stat-sub">Given in range</div>
          </div>
        </div>
      ) : (
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
      )}

      <div className="panel">
        <div className="panel-title">Breakdown by Store {rangeActive ? '• Selected Range' : '• All Time'}</div>
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
