import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function SalesForm({ products, onSuccess, setError }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(productId)),
    [products, productId]
  );

  const saleAmount =
    selectedProduct && quantity ? (Number(quantity) * Number(selectedProduct.unit_price)).toFixed(2) : '0.00';

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
    if (selectedProduct && Number(quantity) > selectedProduct.current_quantity) {
      setError(`Insufficient stock. Only ${selectedProduct.current_quantity} available.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/sales`, {
        product_id: Number(productId),
        quantity_sold: Number(quantity),
        notes
      });
      setResult({ ...res.data, product_name: selectedProduct?.name, sku: selectedProduct?.sku, sale_amount: saleAmount });
      setQuantity('');
      setNotes('');
      onSuccess('Sale recorded successfully — inventory updated');
    } catch (err) {
      const data = err.response?.data;
      if (data?.error === 'Insufficient stock') {
        setError(`Insufficient stock. Available: ${data.available_quantity}, Requested: ${data.requested_quantity}`);
      } else {
        setError('Failed to record sale: ' + (data?.error || err.message));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="two-col">
      <div className="card">
        <h2>💰 Record a Sale</h2>
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
            <label>Quantity Sold *</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>

          {selectedProduct && quantity && (
            <div className="product-detail-box">
              <div className="pd-row">
                <span className="pd-label">Sale Amount</span>
                <span className="pd-value">${saleAmount}</span>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Processing...' : 'Record Sale'}
          </button>
        </form>
      </div>

      <div className={`result-box ${result ? 'success' : ''}`}>
        <h2>Sale Result</h2>
        {!result ? (
          <div className="result-empty">Submit a sale to see the result here.</div>
        ) : (
          <div>
            <div className="result-row"><span>Sale ID</span><strong>#{result.sale_id}</strong></div>
            <div className="result-row"><span>Product</span><strong>{result.product_name}</strong></div>
            <div className="result-row"><span>SKU</span><strong>{result.sku}</strong></div>
            <div className="result-row"><span>Quantity Sold</span><strong>{result.quantity_sold}</strong></div>
            <div className="result-row"><span>Sale Amount</span><strong>₱{result.sale_amount}</strong></div>
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

export default SalesForm;
