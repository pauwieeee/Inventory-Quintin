import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

const EMPTY_FORM = { name: '', sku: '', category: '', storeId: '', price: 0, cost: 0, stock: 0 };

function Inventory({ authUser, stores, categories, setError, setSuccessMsg, refresh, refreshTick }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [stockModal, setStockModal] = useState(null); // {type, product, qty}
  const [newCategory, setNewCategory] = useState('');

  const canEdit = ['host', 'admin', 'store'].includes(authUser.role);
  const isHost = authUser.role === 'host';

  const load = () => {
    setLoading(true);
    const params = {};
    if (storeFilter !== 'All') params.storeId = storeFilter;
    if (categoryFilter !== 'All') params.category = categoryFilter;
    if (search) params.search = search;
    axios.get(`${API_BASE}/products`, { params })
      .then((r) => setProducts(r.data))
      .catch((err) => setError('Failed to load products: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [storeFilter, categoryFilter, search, refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultStoreId = useMemo(() => stores[0]?.id || '', [stores]);

  const totals = useMemo(() => {
    return products.reduce(
      (acc, p) => {
        const qty = Number(p.current_quantity) || 0;
        acc.totalQty += qty;
        acc.totalPrice += Number(p.unit_price) * qty;
        acc.totalCost += Number(p.cost) * qty;
        return acc;
      },
      { totalQty: 0, totalPrice: 0, totalCost: 0 }
    );
  }, [products]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: categories[0]?.name || '', storeId: authUser.storeId || defaultStoreId });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku || '', category: p.category, storeId: p.store_id, price: p.unit_price, cost: p.cost, stock: p.current_quantity });
    setShowForm(true);
  };

  const saveProduct = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await axios.put(`${API_BASE}/products/${editing.id}`, {
          name: form.name, sku: form.sku, category: form.category, unit_price: Number(form.price), cost: Number(form.cost),
          current_quantity: Number(form.stock), storeId: form.storeId
        });
        setSuccessMsg('Product updated');
      } else {
        await axios.post(`${API_BASE}/products`, {
          name: form.name, sku: form.sku, category: form.category, storeId: form.storeId,
          unit_price: Number(form.price), cost: Number(form.cost), current_quantity: Number(form.stock), min_stock_level: Math.round(Number(form.stock) * 0.2)
        });
        setSuccessMsg('Product added');
      }
      setShowForm(false);
      refresh();
      load();
    } catch (err) {
      setError('Failed to save product: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/products/${p.id}`);
      setSuccessMsg('Product deleted');
      load();
    } catch (err) {
      setError('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  };

  const confirmStock = async () => {
    if (!stockModal) return;
    try {
      await axios.post(`${API_BASE}/products/${stockModal.product.id}/stock`, {
        type: stockModal.type, qty: Number(stockModal.qty)
      });
      setSuccessMsg('Stock updated');
      setStockModal(null);
      load();
    } catch (err) {
      setError('Failed to update stock: ' + (err.response?.data?.error || err.message));
    }
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await axios.post(`${API_BASE}/categories`, { name: newCategory.trim() });
      setNewCategory('');
      refresh();
    } catch (err) {
      setError('Failed to add category: ' + (err.response?.data?.error || err.message));
    }
  };

  const removeCategory = async (cat) => {
    try {
      await axios.delete(`${API_BASE}/categories/${cat.id}`);
      refresh();
    } catch (err) {
      setError('Failed to remove category: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <div className="page-head">
        <div className="page-title">
          Inventory {authUser.role === 'staff' && <span className="view-only-badge" style={{ marginLeft: 8 }}>View Only</span>}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-black" onClick={openAdd}>+ Add Product</button>
          </div>
        )}
      </div>

      <div className="filter-row">
        <div className="search-box">
          <span>🔍</span>
          <input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="pill-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="All">{isHost ? 'All Stores' : 'Own Stores'}</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="pill-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <div
        className="inventory-totals-box"
        style={{
          border: '2px solid #000',
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          display: 'flex',
          gap: 32,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ opacity: 0.6, fontSize: 12 }}>Total Quantity</span>
          <b style={{ fontSize: 20 }}>{totals.totalQty.toLocaleString()}</b>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ opacity: 0.6, fontSize: 12 }}>Total Price (Price × Qty)</span>
          <b style={{ fontSize: 20 }}>₱{totals.totalPrice.toLocaleString()}</b>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ opacity: 0.6, fontSize: 12 }}>Total Cost (Cost × Qty)</span>
          <b style={{ fontSize: 20 }}>₱{totals.totalCost.toLocaleString()}</b>
        </div>
      </div>

      {isHost && (
        <div className="panel">
          <div className="panel-title">Category Management • Host Only</div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {categories.map((c) => (
              <span key={c.id} className="chip-remove">
                {c.name}
                <button className="chip-x" onClick={() => removeCategory(c)}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="pill-select"
              style={{ flex: 1 }}
              placeholder="New category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button className="btn btn-black" onClick={addCategory}>Add Category</button>
          </div>
        </div>
      )}

      <div className="panel">
        {loading ? (
          <div className="spinner-container"><div className="spinner"></div></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Store</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Stock</th>
                  {canEdit && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={canEdit ? 8 : 7} className="empty-state">No products found.</td></tr>
                ) : (
                  products.map((p) => {
                    const low = p.current_quantity <= p.min_stock_level;
                    return (
                      <tr key={p.id}>
                        <td>{p.name} {low && <span className="badge badge-low" style={{ marginLeft: 6 }}>Low</span>}</td>
                        <td>{p.sku || '-'}</td>
                        <td>{p.category}</td>
                        <td>{p.store_name}</td>
                        <td className="text-right">₱{Number(p.unit_price).toLocaleString()}</td>
                        <td className="text-right">₱{Number(p.cost).toLocaleString()}</td>
                        <td className="text-right"><b>{p.current_quantity}</b></td>
                        {canEdit && (
                          <td className="text-right">
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                              <button className="btn btn-green btn-sm" onClick={() => setStockModal({ type: 'in', product: p, qty: 1 })}>Stock-in</button>
                              <button className="btn btn-orange btn-sm" onClick={() => setStockModal({ type: 'out', product: p, qty: 1 })}>Stock-out</button>
                              <button className="btn btn-black btn-sm" onClick={() => setStockModal({ type: 'adjust', product: p, qty: p.current_quantity })}>Adjust</button>
                              <button className="btn btn-outline btn-sm" onClick={() => deleteProduct(p)}>🗑</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{editing ? 'Edit Product' : 'Add Product'}</div>
              <button className="icon-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-group">
              <label>Product Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. PC-IP15P-CLR" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Price ₱</label>
                <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Cost ₱</label>
                <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Stock</label>
                <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Store {authUser.role === 'store' && '(fixed to your store)'}</label>
              <select
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                disabled={authUser.role === 'store'}
              >
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button className="btn btn-black" style={{ width: '100%', justifyContent: 'center' }} onClick={saveProduct}>
              Save Product
            </button>
          </div>
        </div>
      )}

      {stockModal && (
        <div className="modal-overlay" onClick={() => setStockModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ marginBottom: 12 }}>
              {stockModal.type === 'in' ? 'Stock-in' : stockModal.type === 'out' ? 'Stock-out' : 'Adjust Stock'} • {stockModal.product.name}
            </div>
            <div className="summary-box" style={{ marginBottom: 12 }}>
              <div className="summary-row"><span>Current Stock</span><span>{stockModal.product.current_quantity}</span></div>
            </div>
            <div className="form-group">
              <label>{stockModal.type === 'adjust' ? 'New Stock Quantity' : 'Quantity'}</label>
              <input
                type="number"
                value={stockModal.qty}
                onChange={(e) => setStockModal({ ...stockModal, qty: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStockModal(null)}>Cancel</button>
              <button
                className={`btn ${stockModal.type === 'in' ? 'btn-green' : stockModal.type === 'out' ? 'btn-orange' : 'btn-black'}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={confirmStock}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;
