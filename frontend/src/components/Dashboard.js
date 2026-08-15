import React from 'react';

function toCSV(products) {
  const headers = ['ID', 'Name', 'SKU', 'Description', 'Current Quantity', 'Min Stock Level', 'Unit Price'];
  const rows = products.map((p) => [
    p.id,
    p.name,
    p.sku,
    (p.description || '').replace(/,/g, ';'),
    p.current_quantity,
    p.min_stock_level,
    p.unit_price
  ]);
  return [headers, ...rows].map((r) => r.join(',')).join('\n');
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function Dashboard({ dashboard, products, onRefresh }) {
  const handleExport = () => {
    const csv = toCSV(products);
    downloadCSV(csv, `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (!dashboard) {
    return <div className="empty-state">No dashboard data available.</div>;
  }

  return (
    <div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onRefresh}>🔄 Refresh</button>
        <button className="btn btn-secondary" onClick={handleExport}>⬇️ Export to CSV</button>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Total Products</div>
          <div className="stat-value">{dashboard.total_products}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Stock</div>
          <div className="stat-value">{dashboard.total_stock}</div>
        </div>
        <div className={`stat-box ${dashboard.low_stock_items > 0 ? 'warning' : ''}`}>
          <div className="stat-label">Low Stock Items</div>
          <div className="stat-value">{dashboard.low_stock_items}</div>
        </div>
      </div>

      {dashboard.low_stock_products && dashboard.low_stock_products.length > 0 && (
        <div className="card">
          <h2>⚠️ Low Stock Alerts</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Current Stock</th>
                  <th>Min Level</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.low_stock_products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td>{p.current_quantity}</td>
                    <td>{p.min_stock_level}</td>
                    <td><span className="badge badge-low">Reorder Needed</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2>📋 Full Inventory Overview</h2>
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
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">No products found.</td>
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

export default Dashboard;
