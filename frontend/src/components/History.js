import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function peso(n) {
  return `₱${Number(n || 0).toLocaleString()}`;
}

const TX_LABELS = {
  DELIVERY: 'Stock-in',
  STOCK_OUT: 'Stock-out',
  ADJUST: 'Adjust',
  SALE: 'Sale',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  SALE_EDITED: 'Sale Edited',
  SALE_DELETED: 'Sale Deleted'
};

function History({ authUser, stores = [], setError, refreshTick }) {
  const isHost = authUser?.role === 'host';
  const canFilterStore = ['host', 'admin'].includes(authUser?.role) && stores.length > 1;
  const [tab, setTab] = useState('sales'); // 'sales' | 'inventory'

  const [sales, setSales] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('All');

  const effectiveTab = tab === 'inventory' && !isHost ? 'sales' : tab;

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (canFilterStore && storeFilter !== 'All') params.storeId = storeFilter;
    if (productSearch.trim()) params.product = productSearch.trim();
    const url = effectiveTab === 'sales' ? `${API_BASE}/sales` : `${API_BASE}/audit`;
    axios.get(url, { params })
      .then((r) => (effectiveTab === 'sales' ? setSales(r.data) : setAudit(r.data)))
      .catch((err) => setError('Failed to load history: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  }, [refreshTick, from, to, effectiveTab, productSearch, canFilterStore, storeFilter, setError]);

  const filteredSales = sales;
  const filteredTotalQty = filteredSales.reduce((sum, sale) => sum + Number(sale.quantity_sold), 0);
  const filteredTotalAmount = filteredSales.reduce((sum, sale) => sum + Number(sale.total), 0);

  return (
    <div>
      <div className="page-head">
        <div className="page-title">History • {effectiveTab === 'sales' ? 'Sales Log' : 'Inventory Log'}</div>
      </div>

      {isHost && (
        <div className="filter-row" style={{ marginBottom: 8 }}>
          <button
            className={`btn btn-sm ${effectiveTab === 'sales' ? 'btn-black' : 'btn-outline'}`}
            onClick={() => setTab('sales')}
          >
            Sales Log
          </button>
          <button
            className={`btn btn-sm ${effectiveTab === 'inventory' ? 'btn-black' : 'btn-outline'}`}
            onClick={() => setTab('inventory')}
          >
            Inventory Log
          </button>
        </div>
      )}

      <div className="date-filter-row">
        <label>From</label>
        <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <label>To</label>
        <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        {(from || to) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</button>
        )}
      </div>

      {canFilterStore && (
        <div className="filter-row">
          <select className="pill-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} aria-label="Filter history by store">
            <option value="All">All Stores</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </div>
      )}

      <div className="filter-row">
          <div className="search-box">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder={`Search product in ${effectiveTab === 'sales' ? 'sales' : 'inventory'} log...`}
              aria-label={`Search ${effectiveTab} log by product`}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
          {productSearch && <button className="btn btn-outline btn-sm" onClick={() => setProductSearch('')}>Clear search</button>}
      </div>

      {effectiveTab === 'sales' && !loading && filteredSales.length > 0 && (
        <div className="stats-grid cols-3" style={{ marginBottom: 16 }}>
          <div className="stat-card dark">
            <div className="stat-label">Transactions</div>
            <div className="stat-value">{filteredSales.length}</div>
          </div>
          <div className="stat-card dark">
            <div className="stat-label">Total Quantity Sold</div>
            <div className="stat-value">{filteredTotalQty}</div>
          </div>
          <div className="stat-card dark">
            <div className="stat-label">Total Sales Amount</div>
            <div className="stat-value">{peso(filteredTotalAmount)}</div>
          </div>
        </div>
      )}

      <div className={`panel history-panel history-${effectiveTab}`}>
        {loading ? (
          <div className="spinner-container"><div className="spinner"></div></div>
        ) : effectiveTab === 'sales' ? (
          <div className="table-wrapper">
            <table className="history-table">
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
                {filteredSales.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">{sales.length === 0 ? 'No history for this range.' : 'No products match your search.'}</td></tr>
                ) : (
                  filteredSales.map((s) => (
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
              {filteredSales.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#fafafa', fontWeight: 700 }}>
                    <td colSpan="3">Total</td>
                    <td className="text-right">{filteredTotalQty}</td>
                    <td className="text-right">{peso(filteredTotalAmount)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Store</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Before</th>
                  <th className="text-right">After</th>
                </tr>
              </thead>
              <tbody>
                {audit.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">{productSearch.trim() ? 'No inventory activity matches this product.' : 'No inventory activity for this range.'}</td></tr>
                ) : (
                  audit.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.transaction_date).toLocaleString()}</td>
                      <td>{a.store_name}</td>
                      <td>{a.product_name}</td>
                      <td>
                        <span className={`badge ${a.quantity_change < 0 ? 'badge-low' : ''}`}>
                          {TX_LABELS[a.transaction_type] || a.transaction_type}
                        </span>
                      </td>
                      <td className="text-right">
                        <b style={{ color: a.quantity_change < 0 ? '#c0392b' : '#1e8e3e' }}>
                          {a.quantity_change > 0 ? `+${a.quantity_change}` : a.quantity_change}
                        </b>
                      </td>
                      <td className="text-right">{a.previous_quantity}</td>
                      <td className="text-right">{a.new_quantity}</td>
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
