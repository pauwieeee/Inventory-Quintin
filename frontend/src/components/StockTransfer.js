import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function StockTransfer({ stores, setError, setSuccessMsg, refresh, refreshTick }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceStoreId, setSourceStoreId] = useState('');
  const [productId, setProductId] = useState('');
  const [destinationStoreId, setDestinationStoreId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE}/products`)
      .then((response) => setProducts(response.data))
      .catch((err) => setError('Failed to load products: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  }, [refreshTick, setError]);

  const sourceStores = useMemo(() => stores.filter((store) =>
    products.some((product) => Number(product.store_id) === Number(store.id))
  ), [stores, products]);
  const selectedProduct = products.find((product) => Number(product.id) === Number(productId));
  const sourceProducts = products.filter((product) =>
    Number(product.store_id) === Number(sourceStoreId) &&
    (!search.trim() || `${product.name} ${product.sku || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  );
  const destinationStores = stores.filter((store) => Number(store.id) !== Number(sourceStoreId));

  useEffect(() => {
    if (!sourceStores.some((store) => String(store.id) === String(sourceStoreId))) {
      setSourceStoreId(String(sourceStores[0]?.id || ''));
    }
  }, [sourceStores, sourceStoreId]);

  useEffect(() => {
    if (!sourceProducts.some((product) => String(product.id) === String(productId))) {
      setProductId(String(sourceProducts[0]?.id || ''));
    }
  }, [sourceProducts, productId]);

  useEffect(() => {
    if (!destinationStores.some((store) => String(store.id) === String(destinationStoreId))) {
      setDestinationStoreId(String(destinationStores[0]?.id || ''));
    }
  }, [destinationStores, destinationStoreId]);

  const submitTransfer = async (event) => {
    event.preventDefault();
    const qty = Number(quantity);
    if (!selectedProduct || !destinationStoreId || !Number.isInteger(qty) || qty < 1 || qty > Number(selectedProduct.current_quantity)) {
      setError('Choose a source product, destination store, and a whole-number quantity within available stock.');
      return;
    }
    setTransferring(true);
    try {
      await axios.post(`${API_BASE}/products/${selectedProduct.id}/transfer`, {
        destinationStoreId: Number(destinationStoreId), quantity: qty
      });
      setSuccessMsg(`Transferred ${qty} units of ${selectedProduct.name}`);
      setQuantity(1);
      refresh();
    } catch (err) {
      setError('Failed to transfer stock: ' + (err.response?.data?.error || err.message));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div className="page-title">Stock Transfer</div>
      </div>
      <div className="panel stock-transfer-panel">
        <div className="panel-title">Move stock between stores</div>
        <p className="stock-transfer-help">Choose the product and quantity to move. Matching products at the destination receive the stock; otherwise, the product is added there.</p>
        {loading ? (
          <div className="spinner-container"><div className="spinner" /></div>
        ) : sourceStores.length === 0 ? (
          <div className="empty-state">No products are available to transfer.</div>
        ) : destinationStores.length === 0 ? (
          <div className="empty-state">A second store is needed to transfer stock. Contact the host to set up another store under your account.</div>
        ) : (
          <form onSubmit={submitTransfer}>
            <div className="form-grid-2 stock-transfer-grid">
              <div className="form-group">
                <label>From store</label>
                <select value={sourceStoreId} onChange={(event) => { setSourceStoreId(event.target.value); setProductId(''); }}>
                  {sourceStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>To store</label>
                <select value={destinationStoreId} onChange={(event) => setDestinationStoreId(event.target.value)}>
                  {destinationStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Find product</label>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product name or SKU" />
            </div>
            <div className="form-group">
              <label>Product</label>
              <select value={productId} onChange={(event) => setProductId(event.target.value)} disabled={!sourceProducts.length}>
                {sourceProducts.length ? sourceProducts.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}{product.sku ? ` - ${product.sku}` : ''} - Stock: {product.current_quantity}</option>
                )) : <option value="">No matching products</option>}
              </select>
            </div>
            {selectedProduct && (
              <div className="summary-box stock-transfer-available">
                <div className="summary-row"><span>Available to transfer</span><b>{selectedProduct.current_quantity}</b></div>
              </div>
            )}
            <div className="form-group stock-transfer-quantity">
              <label>Quantity</label>
              <input type="number" min="1" max={selectedProduct?.current_quantity || 1} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={!selectedProduct} />
            </div>
            <button className="btn btn-black stock-transfer-submit" type="submit" disabled={transferring || !selectedProduct || !destinationStoreId}>
              {transferring ? 'Transferring…' : 'Transfer Stock'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default StockTransfer;
