import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function peso(n) {
  return `₱${Number(n || 0).toLocaleString()}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_SALE = {
  storeId: '', search: '', category: 'All', productId: '', qty: 1,
  discountType: 'None', discountValue: 0, staffName: '', remarks: '', saleDate: '',
  paymentMethod: 'Cash', cashAmount: 0, cardAmount: 0, cardType: 'Visa', last4: '', ref: ''
};

function SalesPage({ authUser, stores, categories, setError, setSuccessMsg, refresh, refreshTick }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sale, setSale] = useState(EMPTY_SALE);
  const [products, setProducts] = useState([]);
  const [staffNames, setStaffNames] = useState([]);

  const isScoped = authUser.role === 'store' || authUser.role === 'staff';
  const isHost = authUser.role === 'host';

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const loadSales = () => {
    setLoading(true);
    axios.get(`${API_BASE}/sales`)
      .then((r) => setSales(r.data))
      .catch((err) => setError('Failed to load sales: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  };

  useEffect(loadSales, [refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = () => {
    const storeId = isScoped ? authUser.storeId : (stores[0]?.id || '');
    setSale({ ...EMPTY_SALE, storeId, staffName: isScoped ? authUser.displayName : '', saleDate: today() });
    setShowModal(true);
  };

  useEffect(() => {
    if (!showModal || !sale.storeId) return;
    axios.get(`${API_BASE}/products`, { params: { storeId: sale.storeId } }).then((r) => setProducts(r.data));
    axios.get(`${API_BASE}/staff-names`).then((r) => setStaffNames(r.data.filter((s) => s.store_id === Number(sale.storeId))));
  }, [showModal, sale.storeId]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (sale.category !== 'All') list = list.filter((p) => p.category === sale.category);
    if (sale.search) {
      const q = sale.search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)));
    }
    return list;
  }, [products, sale.category, sale.search]);

  const selectedProduct = products.find((p) => p.id === Number(sale.productId));
  const subtotal = selectedProduct ? Number(selectedProduct.unit_price) * Number(sale.qty || 0) : 0;
  const discountAmount = sale.discountType === 'Percent'
    ? Math.round((subtotal * Number(sale.discountValue || 0)) / 100)
    : sale.discountType === 'Fixed'
      ? Math.min(Number(sale.discountValue || 0), subtotal)
      : 0;
  const total = subtotal - discountAmount;

  const validateSale = () => {
    if (!selectedProduct) {
      setError('Select a product');
      return false;
    }
    if (sale.qty <= 0 || sale.qty > selectedProduct.current_quantity) {
      setError('Invalid quantity');
      return false;
    }
    if (sale.paymentMethod === 'Split' && Number(sale.cashAmount) + Number(sale.cardAmount) !== total) {
      setError('Split cash + card must equal total');
      return false;
    }
    if ((sale.paymentMethod === 'Card' || sale.paymentMethod === 'Split') && (!sale.last4 || sale.last4.length !== 4)) {
      setError('Enter a 4-digit card Last4');
      return false;
    }
    return true;
  };

  const openConfirmSale = () => {
    if (!validateSale()) return;
    setConfirmPassword('');
    setConfirmError('');
    setConfirmOpen(true);
  };

  const submitSale = async () => {
    if (!confirmPassword) {
      setConfirmError('Enter your password');
      return;
    }
    setVerifying(true);
    setConfirmError('');
    try {
      await axios.post(`${API_BASE}/auth/verify-password`, { password: confirmPassword });
    } catch (err) {
      setConfirmError(err.response?.data?.error || 'Incorrect password');
      setVerifying(false);
      return;
    }

    try {
      await axios.post(`${API_BASE}/sales`, {
        storeId: sale.storeId, productId: selectedProduct.id, qty: Number(sale.qty),
        discountType: sale.discountType, discountValue: Number(sale.discountValue),
        paymentMethod: sale.paymentMethod, cashAmount: Number(sale.cashAmount), cardAmount: Number(sale.cardAmount),
        cardType: sale.cardType, last4: sale.last4, ref: sale.ref, staffName: sale.staffName, remarks: sale.remarks,
        saleDate: isHost ? (sale.saleDate || undefined) : undefined
      });
      setSuccessMsg('Sale recorded — inventory updated');
      setConfirmOpen(false);
      setShowModal(false);
      refresh();
      loadSales();
    } catch (err) {
      setError('Failed to record sale: ' + (err.response?.data?.error || err.message));
      setConfirmOpen(false);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div className="page-title">Sales</div>
        <button className="btn btn-black" onClick={openModal}>+ Add Sale</button>
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
                  <th>Payment</th>
                  <th>Staff</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">No sales recorded yet.</td></tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.sale_date).toLocaleString()}</td>
                      <td>{s.store_name}</td>
                      <td>{s.product_name}</td>
                      <td className="text-right">{s.quantity_sold}</td>
                      <td className="text-right"><b>{peso(s.total)}</b></td>
                      <td>
                        <span className="badge badge-black">{s.payment_method}</span>
                        {Number(s.discount_amount) > 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>-{s.discount_amount}</span>}
                      </td>
                      <td>{s.staff_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Add Sale • ₱</div>
              <button className="icon-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {isHost ? (
              <div className="form-group" style={{ maxWidth: 220 }}>
                <label>📅 Sale Date</label>
                <input
                  type="date"
                  value={sale.saleDate}
                  max={today()}
                  onChange={(e) => setSale({ ...sale, saleDate: e.target.value })}
                />
              </div>
            ) : (
              <div className="form-group" style={{ maxWidth: 320 }}>
                <label>📅 Sale Date</label>
                <div style={{ height: 40, display: 'flex', alignItems: 'center', paddingLeft: 14, borderRadius: 9999, background: '#f5f5f5', fontSize: 12 }}>
                  Today only — ask the Host to log a backdated sale
                </div>
              </div>
            )}

            <div className="two-col-modal">
              <div>
                {!isScoped && (
                  <div className="form-group">
                    <label>Store</label>
                    <select value={sale.storeId} onChange={(e) => setSale({ ...sale, storeId: e.target.value, productId: '' })}>
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Search Product</label>
                  <input value={sale.search} onChange={(e) => setSale({ ...sale, search: e.target.value })} placeholder="Search by name or SKU..." />
                </div>

                <div className="form-group">
                  <label>Categories</label>
                  <div className="chip-row">
                    {['All', ...categories.map((c) => c.name)].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`chip ${sale.category === c ? 'active' : ''}`}
                        onClick={() => setSale({ ...sale, category: c })}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="product-pick-list" style={{ marginBottom: 12 }}>
                  {filteredProducts.length === 0 ? (
                    <div style={{ padding: 16, fontSize: 12, opacity: 0.6 }}>No products</div>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`product-pick-item ${Number(sale.productId) === p.id ? 'selected' : ''}`}
                        onClick={() => setSale({ ...sale, productId: p.id })}
                      >
                        <span>
                          <div>{p.name}{p.sku ? ` (${p.sku})` : ''}</div>
                          <div style={{ fontSize: 10, opacity: 0.7 }}>{p.category} • Stock {p.current_quantity} • {peso(p.unit_price)}</div>
                        </span>
                        <b>{peso(p.unit_price)}</b>
                      </button>
                    ))
                  )}
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>QTY</label>
                    <input type="number" min="1" value={sale.qty} onChange={(e) => setSale({ ...sale, qty: Math.max(1, Number(e.target.value)) })} />
                  </div>
                  <div className="form-group">
                    <label>Discount</label>
                    <select value={sale.discountType} onChange={(e) => setSale({ ...sale, discountType: e.target.value })}>
                      <option value="None">None</option>
                      <option value="Percent">% Percent</option>
                      <option value="Fixed">Fixed ₱</option>
                    </select>
                  </div>
                </div>
                {sale.discountType !== 'None' && (
                  <div className="form-group">
                    <input
                      type="number"
                      value={sale.discountValue}
                      onChange={(e) => setSale({ ...sale, discountValue: e.target.value })}
                      placeholder={sale.discountType === 'Percent' ? '% value' : '₱ amount'}
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="form-group">
                  <label>Staff {isScoped ? '(you)' : ''}</label>
                  {isScoped ? (
                    <div style={{ height: 40, display: 'flex', alignItems: 'center', paddingLeft: 14, borderRadius: 9999, background: '#f5f5f5', fontSize: 13 }}>
                      {authUser.displayName}
                    </div>
                  ) : (
                    <>
                      <div className="chip-row" style={{ marginBottom: 8 }}>
                        {staffNames.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`chip ${sale.staffName === s.name ? 'active' : ''}`}
                            onClick={() => setSale({ ...sale, staffName: s.name })}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                      <input value={sale.staffName} onChange={(e) => setSale({ ...sale, staffName: e.target.value })} placeholder="Staff name" />
                    </>
                  )}
                </div>

                <div className="form-group">
                  <label>Remarks ({sale.remarks.length}/200)</label>
                  <textarea
                    value={sale.remarks}
                    onChange={(e) => setSale({ ...sale, remarks: e.target.value.slice(0, 200) })}
                    placeholder="Remarks..."
                  />
                </div>

                <div className="summary-box">
                  <div className="summary-row"><span>Subtotal</span><span>{peso(subtotal)}</span></div>
                  <div className="summary-row"><span>Discount</span><span>-{peso(discountAmount)}</span></div>
                  <div className="summary-row total"><span>Total</span><span>{peso(total)}</span></div>
                </div>

                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Payment Method</label>
                  <div className="form-grid-3">
                    {['Cash', 'Card', 'Split'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`chip ${sale.paymentMethod === m ? 'active' : ''}`}
                        style={{ textAlign: 'center' }}
                        onClick={() => setSale({ ...sale, paymentMethod: m })}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {(sale.paymentMethod === 'Card' || sale.paymentMethod === 'Split') && (
                  <div className="panel" style={{ padding: 12 }}>
                    <div className="form-grid-2">
                      <select value={sale.cardType} onChange={(e) => setSale({ ...sale, cardType: e.target.value })}>
                        <option>Visa</option><option>Mastercard</option><option>Amex</option><option>GCash</option><option>Maya</option>
                      </select>
                      <input value={sale.last4} maxLength={4} placeholder="Last4" onChange={(e) => setSale({ ...sale, last4: e.target.value })} />
                    </div>
                    <input value={sale.ref} placeholder="Ref #" onChange={(e) => setSale({ ...sale, ref: e.target.value })} style={{ marginTop: 8 }} />
                    {sale.paymentMethod === 'Split' && (
                      <div className="form-grid-2" style={{ marginTop: 8 }}>
                        <div>
                          <label style={{ fontSize: 10 }}>Cash Amount</label>
                          <input type="number" value={sale.cashAmount} onChange={(e) => setSale({ ...sale, cashAmount: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10 }}>Card Amount</label>
                          <input type="number" value={sale.cardAmount} onChange={(e) => setSale({ ...sale, cardAmount: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button className="btn btn-black" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={openConfirmSale}>
                  Confirm Sale • {peso(total)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="modal-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ marginBottom: 4 }}>🔒 Confirm Your Password</div>
            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
              Confirm sale of {selectedProduct?.name} x{sale.qty} • {peso(total)}
            </p>
            <div className="form-group">
              <input
                type="password"
                placeholder="Your password"
                value={confirmPassword}
                autoFocus
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSale()}
              />
            </div>
            {confirmError && <div className="login-error" style={{ marginBottom: 12 }}>{confirmError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn btn-black" style={{ flex: 1, justifyContent: 'center' }} onClick={submitSale} disabled={verifying}>
                {verifying ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesPage;
