import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function peso(n) {
  return `₱${Number(n || 0).toLocaleString()}`;
}

function History({ setError, refreshTick }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    axios.get(`${API_BASE}/sales`, { params })
      .then((r) => setSales(r.data))
      .catch((err) => setError('Failed to load history: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  }, [refreshTick, from, to, setError]);

  return (
    <div>
      <div className="page-head">
        <div className="page-title">History • Sales Log</div>
      </div>

      <div className="date-filter-row">
        <label>From</label>
        <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <label>To</label>
        <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        {(from || to) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</button>
        )}
      </div>

      <div className="panel">
        {loading ? (
          <div className="spinner-container"><div className="spinner"></div></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Store</th>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total</th>
                  <th>Cashier</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">No history for this range.</td></tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.sale_date).toLocaleString()}</td>
                      <td>{s.store_name}</td>
                      <td>{s.product_name}</td>
                      <td className="text-right">{s.quantity_sold}</td>
                      <td className="text-right"><b>{peso(s.total)}</b></td>
                      <td>{s.cashier}</td>
                      <td style={{ fontSize: 11, opacity: 0.7 }}>{s.remarks || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default History;
