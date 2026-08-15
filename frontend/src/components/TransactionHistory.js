import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') || dateStr.includes('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return dateStr;
  const options = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
  return d.toLocaleString('en-US', options).replace(',', ',');
}

function TransactionHistory({ setError }) {
  const [subTab, setSubTab] = useState('sales');
  const [sales, setSales] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, deliveriesRes, auditRes] = await Promise.all([
        axios.get(`${API_BASE}/sales`),
        axios.get(`${API_BASE}/deliveries`),
        axios.get(`${API_BASE}/audit`)
      ]);
      setSales(salesRes.data);
      setDeliveries(deliveriesRes.data);
      setAudit(auditRes.data);
    } catch (err) {
      setError('Failed to load transaction history: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="card">
      <div className="subtab-nav">
        <button className={`subtab-btn ${subTab === 'sales' ? 'active' : ''}`} onClick={() => setSubTab('sales')}>
          Sales ({sales.length})
        </button>
        <button className={`subtab-btn ${subTab === 'deliveries' ? 'active' : ''}`} onClick={() => setSubTab('deliveries')}>
          Deliveries ({deliveries.length})
        </button>
        <button className={`subtab-btn ${subTab === 'audit' ? 'active' : ''}`} onClick={() => setSubTab('audit')}>
          Audit Trail ({audit.length})
        </button>
      </div>

      {loading ? (
        <div className="spinner-container">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {subTab === 'sales' && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Sale ID</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity Sold</th>
                    <th>Sale Amount</th>
                    <th>Date</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state">No sales recorded yet.</td></tr>
                  ) : (
                    sales.map((s) => (
                      <tr key={s.id}>
                        <td>#{s.id}</td>
                        <td>{s.product_name}</td>
                        <td>{s.sku}</td>
                        <td className="text-negative">-{s.quantity_sold}</td>
                        <td>₱{Number(s.sale_amount).toFixed(2)}</td>
                        <td>{formatDate(s.sale_date)}</td>
                        <td>{s.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {subTab === 'deliveries' && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Delivery ID</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity Received</th>
                    <th>Supplier</th>
                    <th>Date</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state">No deliveries recorded yet.</td></tr>
                  ) : (
                    deliveries.map((d) => (
                      <tr key={d.id}>
                        <td>#{d.id}</td>
                        <td>{d.product_name}</td>
                        <td>{d.sku}</td>
                        <td className="text-positive">+{d.quantity_received}</td>
                        <td>{d.supplier}</td>
                        <td>{formatDate(d.delivery_date)}</td>
                        <td>{d.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {subTab === 'audit' && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Audit ID</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Quantity Change</th>
                    <th>Previous Stock</th>
                    <th>New Stock</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state">No audit records yet.</td></tr>
                  ) : (
                    audit.map((a) => (
                      <tr key={a.id}>
                        <td>#{a.id}</td>
                        <td>{a.product_name}</td>
                        <td>
                          <span className={`badge ${a.transaction_type === 'SALE' ? 'badge-sale' : 'badge-delivery'}`}>
                            {a.transaction_type}
                          </span>
                        </td>
                        <td className={a.quantity_change < 0 ? 'text-negative' : 'text-positive'}>
                          {a.quantity_change > 0 ? '+' : ''}{a.quantity_change}
                        </td>
                        <td>{a.previous_quantity}</td>
                        <td>{a.new_quantity}</td>
                        <td>{formatDate(a.transaction_date)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TransactionHistory;
