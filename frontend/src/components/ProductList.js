import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

const EMPTY_FORM = {
  name: '',
  sku: '',
  description: '',
  current_quantity: '',
  min_stock_level: '',
  unit_price: ''
};

function ProductList({ products, onChange, setError, setSuccessMsg }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.sku || form.current_quantity === '' || form.min_stock_level === '' || form.unit_price === '') {
      setError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/products`, {
        name: form.name,
        sku: form.sku,
        description: form.description,
        current_quantity: Number(form.current_quantity),
        min_stock_level: Number(form.min_stock_level),
        unit_price: Number(form.unit_price)
      });
      setSuccessMsg(`Product "${form.name}" added successfully`);
      resetForm();
      setShowForm(false);
      onChange();
    } catch (err) {
      setError('Failed to add product: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete product "${product.name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_BASE}/products/${product.id}`);
      setSuccessMsg(`Product "${product.name}" deleted`);
      onChange();
    } catch (err) {
      setError('Failed to delete product: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? '✕ Cancel' : '+ Add New Product'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>Add New Product</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Product Name *</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Wireless Mouse" />
              </div>
              <div className="form-group">
                <label>SKU *</label>
                <input name="sku" value={form.sku} onChange={handleChange} placeholder="e.g. WM-001" />
              </div>
              <div className="form-group">
                <label>Current Quantity *</label>
                <input type="number" min="0" name="current_quantity" value={form.current_quantity} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Min Stock Level *</label>
                <input type="number" min="0" name="min_stock_level" value={form.min_stock_level} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Unit Price (₱) *</label>
                <input type="number" min="0" step="0.01" name="unit_price" value={form.unit_price} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Optional description" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Product'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Products ({products.length})</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Description</th>
                <th>Current Stock</th>
                <th>Min Level</th>
                <th>Unit Price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">No products yet. Add your first product above.</td>
                </tr>
              ) : (
                products.map((p) => {
                  const low = p.current_quantity <= p.min_stock_level;
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.sku}</td>
                      <td>{p.description}</td>
                      <td>{p.current_quantity}</td>
                      <td>{p.min_stock_level}</td>
                      <td>₱{Number(p.unit_price).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${low ? 'badge-low' : 'badge-ok'}`}>
                          {low ? 'Low Stock' : 'OK'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProductList;
