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
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        storeId: user.store_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.use('/api', requireAuth);

// ---------- Helpers ----------

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

async function getAccessibleStoreIds(user) {
  if (user.role === 'host') {
    const r = await pool.query('SELECT id FROM stores');
    return r.rows.map((s) => s.id);
  }
  if (user.role === 'admin') {
    const r = await pool.query('SELECT id FROM stores WHERE admin_id = $1', [user.id]);
    return r.rows.map((s) => s.id);
  }
  return user.storeId ? [user.storeId] : [];
}

// ---------- Stores ----------

app.get('/api/stores', async (req, res) => {
  try {
    const ids = await getAccessibleStoreIds(req.user);
    if (ids.length === 0) return res.json([]);
    const result = await pool.query(
      `SELECT s.*, u.display_name AS admin_name FROM stores s JOIN users u ON u.id = s.admin_id WHERE s.id = ANY($1) ORDER BY s.name`,
      [ids]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stores', requireRole('host'), async (req, res) => {
  const { name, adminId } = req.body;
  if (!name || !adminId) return res.status(400).json({ error: 'name and adminId are required' });
  try {
    const result = await pool.query(
      'INSERT INTO stores (name, admin_id) VALUES ($1, $2) RETURNING *',
      [name, adminId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Categories ----------

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', requireRole('host'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0] || { name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', requireRole('host'), async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Staff Names (quick pills) ----------

app.get('/api/staff-names', async (req, res) => {
  try {
    const ids = await getAccessibleStoreIds(req.user);
    if (ids.length === 0) return res.json([]);
    const result = await pool.query('SELECT * FROM staff_names WHERE store_id = ANY($1) ORDER BY name', [ids]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff-names', async (req, res) => {
  const { storeId, name } = req.body;
  if (!storeId || !name) return res.status(400).json({ error: 'storeId and name are required' });
  try {
    const result = await pool.query(
      'INSERT INTO staff_names (store_id, name) VALUES ($1, $2) RETURNING *',
      [storeId, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/staff-names/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM staff_names WHERE id = $1', [req.params.id]);
    res.json({ message: 'Staff name removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Products ----------

app.get('/api/products', async (req, res) => {
  try {
    const ids = await getAccessibleStoreIds(req.user);
    if (ids.length === 0) return res.json([]);
    const { storeId, category, search } = req.query;
    let sql = `SELECT p.*, s.name AS store_name FROM products p JOIN stores s ON s.id = p.store_id WHERE p.store_id = ANY($1)`;
    const params = [ids];
    if (storeId) {
      params.push(storeId);
      sql += ` AND p.store_id = $${params.length}`;
    }
    if (category && category !== 'All') {
      params.push(category);
      sql += ` AND p.category = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND p.name ILIKE $${params.length}`;
    }
    sql += ' ORDER BY p.name';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', requireRole('host', 'admin', 'store'), async (req, res) => {
  const { name, category, storeId, unit_price, cost, current_quantity, min_stock_level, description } = req.body;
  if (!name || !storeId) return res.status(400).json({ error: 'name and storeId are required' });
  try {
    const ids = await getAccessibleStoreIds(req.user);
    if (!ids.includes(Number(storeId))) return res.status(403).json({ error: 'No access to this store' });

    const result = await pool.query(
      `INSERT INTO products (name, category, store_id, description, current_quantity, min_stock_level, unit_price, cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, category || 'Others', storeId, description || '', current_quantity || 0, min_stock_level || 0, unit_price || 0, cost || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', requireRole('host', 'admin', 'store'), async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    const p = existing.rows[0];
    if (!p) return res.status(404).json({ error: 'Product not found' });
    const ids = await getAccessibleStoreIds(req.user);
    if (!ids.includes(p.store_id)) return res.status(403).json({ error: 'No access to this store' });

    const { name, category, unit_price, cost, current_quantity, min_stock_level, description, storeId } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, category=$2, unit_price=$3, cost=$4, current_quantity=$5, min_stock_level=$6, description=$7, store_id=$8 WHERE id=$9 RETURNING *`,
      [
        name ?? p.name,
        category ?? p.category,
        unit_price ?? p.unit_price,
        cost ?? p.cost,
        current_quantity ?? p.current_quantity,
        min_stock_level ?? p.min_stock_level,
        description ?? p.description,
        storeId ?? p.store_id,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', requireRole('host', 'admin', 'store'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted successfully', id: Number(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock-in / Stock-out / Adjust
app.post('/api/products/:id/stock', requireRole('host', 'admin', 'store'), async (req, res) => {
  const { id } = req.params;
  const { type, qty } = req.body;
  const n = Number(qty);
  if (!['in', 'out', 'adjust'].includes(type) || isNaN(n)) {
    return res.status(400).json({ error: 'type must be in/out/adjust and qty must be a number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]);
    const product = productResult.rows[0];
    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const previous_quantity = product.current_quantity;
    let new_quantity;
    let txType;
    let change;
    if (type === 'in') {
      new_quantity = previous_quantity + n;
      txType = 'DELIVERY';
      change = n;
    } else if (type === 'out') {
      new_quantity = Math.max(0, previous_quantity - n);
      txType = 'STOCK_OUT';
      change = -(previous_quantity - new_quantity);
    } else {
      new_quantity = n;
      txType = 'ADJUST';
      change = n - previous_quantity;
    }

    await client.query('UPDATE products SET current_quantity = $1 WHERE id = $2', [new_quantity, id]);
    await client.query(
      `INSERT INTO inventory_audit (product_id, transaction_type, quantity_change, previous_quantity, new_quantity)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, txType, change, previous_quantity, new_quantity]
    );
    await client.query('COMMIT');
    res.json({ id: Number(id), previous_quantity, new_quantity, message: 'Stock updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---------- Sales ----------

app.post('/api/sales', async (req, res) => {
  const {
    storeId, productId, qty, discountType, discountValue,
    paymentMethod, cashAmount, cardAmount, cardType, last4, ref, staffName, remarks
  } = req.body;

  const quantity = Number(qty);
  if (!storeId || !productId || isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'storeId, productId and a positive qty are required' });
  }

  const ids = await getAccessibleStoreIds(req.user);
  if (!ids.includes(Number(storeId))) return res.status(403).json({ error: 'No access to this store' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
    const product = productResult.rows[0];
    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    if (product.current_quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock', available_quantity: product.current_quantity });
    }

    const subtotal = Number(product.unit_price) * quantity;
    let discountAmount = 0;
    if (discountType === 'Percent') discountAmount = Math.round((subtotal * Number(discountValue || 0)) / 100);
    else if (discountType === 'Fixed') discountAmount = Math.min(Number(discountValue || 0), subtotal);
    const total = subtotal - discountAmount;

    if (paymentMethod === 'Split' && Number(cashAmount || 0) + Number(cardAmount || 0) !== total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Split cash + card must equal total' });
    }

    const previous_quantity = product.current_quantity;
    const new_quantity = previous_quantity - quantity;
    await client.query('UPDATE products SET current_quantity = $1 WHERE id = $2', [new_quantity, productId]);

    const cash_amount = paymentMethod === 'Cash' ? total : paymentMethod === 'Split' ? Number(cashAmount || 0) : 0;
    const card_amount = paymentMethod === 'Card' ? total : paymentMethod === 'Split' ? Number(cardAmount || 0) : 0;

    const saleResult = await client.query(
      `INSERT INTO sales
        (store_id, product_id, quantity_sold, unit_price, subtotal, discount_type, discount_value, discount_amount, total,
         payment_method, cash_amount, card_amount, card_type, last4, ref, staff_name, remarks, cashier)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [
        storeId, productId, quantity, product.unit_price, subtotal, discountType || 'None', discountValue || 0,
        discountAmount, total, paymentMethod || 'Cash', cash_amount, card_amount, cardType || null, last4 || null,
        ref || null, staffName || req.user.username, remarks || '', req.user.username
      ]
    );
    const sale_id = saleResult.rows[0].id;

    await client.query(
      `INSERT INTO inventory_audit (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_id)
       VALUES ($1,'SALE',$2,$3,$4,$5)`,
      [productId, -quantity, previous_quantity, new_quantity, sale_id]
    );

    await client.query('COMMIT');
    res.status(201).json({
      sale_id, previous_quantity, new_quantity, total,
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
    const ids = await getAccessibleStoreIds(req.user);
    if (ids.length === 0) return res.json([]);
    const { storeId } = req.query;
    let sql = `
      SELECT sa.*, p.name AS product_name, s.name AS store_name
      FROM sales sa
      JOIN products p ON p.id = sa.product_id
      JOIN stores s ON s.id = sa.store_id
      WHERE sa.store_id = ANY($1)
    `;
    const params = [ids];
    if (storeId && storeId !== 'All') {
      params.push(storeId);
      sql += ` AND sa.store_id = $${params.length}`;
    }
    sql += ' ORDER BY sa.sale_date DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Audit Trail ----------

app.get('/api/audit', async (req, res) => {
  try {
    const ids = await getAccessibleStoreIds(req.user);
    if (ids.length === 0) return res.json([]);
    const result = await pool.query(
      `SELECT a.*, p.name AS product_name FROM inventory_audit a
       JOIN products p ON p.id = a.product_id WHERE p.store_id = ANY($1)
       ORDER BY a.transaction_date DESC`,
      [ids]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Dashboard ----------

app.get('/api/dashboard', async (req, res) => {
  try {
    const ids = await getAccessibleStoreIds(req.user);
    if (ids.length === 0) {
      return res.json({
        total_stores: 0, total_products: 0,
        dailyCash: 0, dailyCard: 0, dailySalesCount: 0, dailyDiscount: 0,
        monthlyCash: 0, monthlyCard: 0, monthlySalesCount: 0, monthlyDiscount: 0,
        low_stock_products: []
      });
    }

    const totalStores = await pool.query('SELECT COUNT(*) FROM stores WHERE id = ANY($1)', [ids]);
    const totalProducts = await pool.query('SELECT COUNT(*) FROM products WHERE store_id = ANY($1)', [ids]);

    const daily = await pool.query(
      `SELECT COALESCE(SUM(cash_amount),0) c, COALESCE(SUM(card_amount),0) cd, COUNT(*) cnt, COALESCE(SUM(discount_amount),0) disc
       FROM sales WHERE store_id = ANY($1) AND sale_date::date = CURRENT_DATE`,
      [ids]
    );
    const monthly = await pool.query(
      `SELECT COALESCE(SUM(cash_amount),0) c, COALESCE(SUM(card_amount),0) cd, COUNT(*) cnt, COALESCE(SUM(discount_amount),0) disc
       FROM sales WHERE store_id = ANY($1) AND date_trunc('month', sale_date) = date_trunc('month', CURRENT_DATE)`,
      [ids]
    );
    const lowStock = await pool.query(
      `SELECT * FROM products WHERE store_id = ANY($1) AND current_quantity <= min_stock_level ORDER BY current_quantity ASC`,
      [ids]
    );

    res.json({
      total_stores: Number(totalStores.rows[0].count),
      total_products: Number(totalProducts.rows[0].count),
      dailyCash: Number(daily.rows[0].c),
      dailyCard: Number(daily.rows[0].cd),
      dailySalesCount: Number(daily.rows[0].cnt),
      dailyDiscount: Number(daily.rows[0].disc),
      monthlyCash: Number(monthly.rows[0].c),
      monthlyCard: Number(monthly.rows[0].cd),
      monthlySalesCount: Number(monthly.rows[0].cnt),
      monthlyDiscount: Number(monthly.rows[0].disc),
      low_stock_products: lowStock.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Team (host only) ----------

app.get('/api/team/users', requireRole('host'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, display_name, role, store_id FROM users ORDER BY role, username');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/team/admins', requireRole('host'), async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password || !displayName) return res.status(400).json({ error: 'username, password, displayName are required' });
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role) VALUES ($1,$2,$3,'admin') RETURNING id, username, display_name, role`,
      [username, password_hash, displayName]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/team/staff', requireRole('host'), async (req, res) => {
  const { username, password, displayName, storeId } = req.body;
  if (!username || !password || !displayName || !storeId) {
    return res.status(400).json({ error: 'username, password, displayName, storeId are required' });
  }
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role, store_id) VALUES ($1,$2,$3,'staff',$4) RETURNING id, username, display_name, role, store_id`,
      [username, password_hash, displayName, storeId]
    );
    await pool.query('INSERT INTO staff_names (store_id, name) VALUES ($1, $2)', [storeId, displayName]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
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
