import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function DeliveryForm({ products, onSuccess, setError }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(productId)),
    [products, productId]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !quantity) {
      setError('Please select a product and enter a quantity');
      return;
    }
    if (Number(quantity) <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/deliveries`, {
        product_id: Number(productId),
        quantity_received: Number(quantity),
        supplier,
        notes
      });
      setResult({ ...res.data, product_name: selectedProduct?.name, sku: selectedProduct?.sku, supplier });
      setQuantity('');
      setSupplier('');
      setNotes('');
      onSuccess('Delivery recorded successfully — inventory updated');
    } catch (err) {
      setError('Failed to record delivery: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="two-col">
      <div className="card">
        <h2>🚚 Record a Delivery</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Product *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">-- Select a product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Stock: {p.current_quantity} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="product-detail-box">
              <div className="pd-row">
                <span className="pd-label">Current Stock</span>
                <span className="pd-value">{selectedProduct.current_quantity}</span>
              </div>
              <div className="pd-row">
                <span className="pd-label">Unit Price</span>
                <span className="pd-value">₱{Number(selectedProduct.unit_price).toFixed(2)}</span>
              </div>
              <div className="pd-row">
                <span className="pd-label">SKU</span>
                <span className="pd-value">{selectedProduct.sku}</span>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Quantity Received *</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Supplier</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name" />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Processing...' : 'Record Delivery'}
          </button>
        </form>
      </div>

      <div className={`result-box ${result ? 'success' : ''}`}>
        <h2>Delivery Result</h2>
        {!result ? (
          <div className="result-empty">Submit a delivery to see the result here.</div>
        ) : (
          <div>
            <div className="result-row"><span>Delivery ID</span><strong>#{result.delivery_id}</strong></div>
            <div className="result-row"><span>Product</span><strong>{result.product_name}</strong></div>
            <div className="result-row"><span>SKU</span><strong>{result.sku}</strong></div>
            <div className="result-row"><span>Quantity Received</span><strong>{result.quantity_received}</strong></div>
            <div className="result-row"><span>Supplier</span><strong>{result.supplier || '—'}</strong></div>
            <div className="stock-change">
              <span className="text-negative">{result.previous_quantity}</span>
              <span className="arrow">→</span>
              <span className="text-positive">{result.new_quantity}</span>
            </div>
            <p style={{ textAlign: 'center', color: '#1e8449', fontWeight: 600 }}>{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeliveryForm;
