require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { pool, initSchema } = require('./db');
const { signToken, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

let schemaReady = initSchema().catch((err) => {
  console.error('Failed to initialize database schema:', err.message);
});

app.use(async (req, res, next) => {
  try {
    await schemaReady;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database not ready: ' + err.message });
  }
});

// ---------- Health ----------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() });
});

// ---------- Auth ----------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Everything below this line requires a valid token.
app.use('/api', requireAuth);

// ---------- Products ----------

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, sku, description, current_quantity, min_stock_level, unit_price } = req.body;

  if (
    name === undefined ||
    sku === undefined ||
    current_quantity === undefined ||
    min_stock_level === undefined ||
    unit_price === undefined
  ) {
    return res.status(400).json({
      error: 'Missing required fields: name, sku, current_quantity, min_stock_level, unit_price'
    });
  }

  if (isNaN(current_quantity) || isNaN(min_stock_level) || isNaN(unit_price)) {
    return res.status(400).json({ error: 'current_quantity, min_stock_level, and unit_price must be numbers' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (name, sku, description, current_quantity, min_stock_level, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, sku, description || '', current_quantity, min_stock_level, unit_price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, sku, description, current_quantity, min_stock_level, unit_price } = req.body;

  try {
    const existingResult = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const result = await pool.query(
      `UPDATE products SET
        name = $1,
        sku = $2,
        description = $3,
        current_quantity = $4,
        min_stock_level = $5,
        unit_price = $6
       WHERE id = $7
       RETURNING *`,
      [
        name ?? existing.name,
        sku ?? existing.sku,
        description ?? existing.description,
        current_quantity ?? existing.current_quantity,
        min_stock_level ?? existing.min_stock_level,
        unit_price ?? existing.unit_price,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existingResult = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted successfully', id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Sales (AUTO-DEDUCT) ----------

app.post('/api/sales', async (req, res) => {
  const { product_id, quantity_sold, notes } = req.body;

  if (!product_id || !quantity_sold) {
    return res.status(400).json({ error: 'product_id and quantity_sold are required' });
  }

  const qty = Number(quantity_sold);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity_sold must be a positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [product_id]);
    const product = productResult.rows[0];

    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.current_quantity < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient stock',
        available_quantity: product.current_quantity,
        requested_quantity: qty
      });
    }

    const previous_quantity = product.current_quantity;
    const new_quantity = previous_quantity - qty;

    await client.query('UPDATE products SET current_quantity = $1 WHERE id = $2', [new_quantity, product_id]);

    const saleResult = await client.query(
      `INSERT INTO sales (product_id, quantity_sold, notes) VALUES ($1, $2, $3) RETURNING id`,
      [product_id, qty, notes || '']
    );
    const sale_id = saleResult.rows[0].id;

    await client.query(
      `INSERT INTO inventory_audit
        (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_id)
       VALUES ($1, 'SALE', $2, $3, $4, $5)`,
      [product_id, -qty, previous_quantity, new_quantity, sale_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      sale_id,
      product_id: Number(product_id),
      previous_quantity,
      new_quantity,
      quantity_sold: qty,
      message: 'Sale recorded and inventory updated successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/sales', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.product_id, s.quantity_sold, s.sale_date, s.notes,
             p.name AS product_name, p.sku, p.unit_price,
             (s.quantity_sold * p.unit_price) AS sale_amount
      FROM sales s
      JOIN products p ON p.id = s.product_id
      ORDER BY s.sale_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Deliveries (AUTO-ADD) ----------

app.post('/api/deliveries', async (req, res) => {
  const { product_id, quantity_received, supplier, notes } = req.body;

  if (!product_id || !quantity_received) {
    return res.status(400).json({ error: 'product_id and quantity_received are required' });
  }

  const qty = Number(quantity_received);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity_received must be a positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [product_id]);
    const product = productResult.rows[0];

    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const previous_quantity = product.current_quantity;
    const new_quantity = previous_quantity + qty;

    await client.query('UPDATE products SET current_quantity = $1 WHERE id = $2', [new_quantity, product_id]);

    const deliveryResult = await client.query(
      `INSERT INTO deliveries (product_id, quantity_received, supplier, notes) VALUES ($1, $2, $3, $4) RETURNING id`,
      [product_id, qty, supplier || '', notes || '']
    );
    const delivery_id = deliveryResult.rows[0].id;

    await client.query(
      `INSERT INTO inventory_audit
        (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_id)
       VALUES ($1, 'DELIVERY', $2, $3, $4, $5)`,
      [product_id, qty, previous_quantity, new_quantity, delivery_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      delivery_id,
      product_id: Number(product_id),
      previous_quantity,
      new_quantity,
      quantity_received: qty,
      message: 'Delivery recorded and inventory updated successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/deliveries', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.product_id, d.quantity_received, d.delivery_date, d.supplier, d.notes,
             p.name AS product_name, p.sku, p.unit_price
      FROM deliveries d
      JOIN products p ON p.id = d.product_id
      ORDER BY d.delivery_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Audit Trail ----------

app.get('/api/audit', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, p.name AS product_name, p.sku
      FROM inventory_audit a
      JOIN products p ON p.id = a.product_id
      ORDER BY a.transaction_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit/:product_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.name AS product_name, p.sku
       FROM inventory_audit a
       JOIN products p ON p.id = a.product_id
       WHERE a.product_id = $1
       ORDER BY a.transaction_date DESC`,
      [req.params.product_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Dashboard ----------

app.get('/api/dashboard', async (req, res) => {
  try {
    const totalsResult = await pool.query(`
      SELECT COUNT(*) AS total_products, COALESCE(SUM(current_quantity), 0) AS total_stock
      FROM products
    `);
    const totals = totalsResult.rows[0];

    const lowStockResult = await pool.query(`
      SELECT * FROM products WHERE current_quantity <= min_stock_level ORDER BY current_quantity ASC
    `);

    res.json({
      total_products: Number(totals.total_products),
      total_stock: Number(totals.total_stock),
      low_stock_items: lowStockResult.rows.length,
      low_stock_products: lowStockResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Error handling ----------

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Inventory management server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
