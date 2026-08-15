const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.warn('Warning: DATABASE_URL is not set. Set it to your Supabase Postgres connection string.');
}

// Parsed manually (instead of passing connectionString straight to pg) because
// Supabase pooler usernames contain a dot (postgres.<project-ref>), which pg's
// built-in connection-string parser mishandles and silently truncates.
function buildPoolConfig() {
  if (!process.env.DATABASE_URL) return { ssl: { rejectUnauthorized: false } };

  const url = new URL(process.env.DATABASE_URL);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    ssl: { rejectUnauthorized: false }
  };
}

const pool = new Pool(buildPoolConfig());

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      description TEXT,
      current_quantity INTEGER NOT NULL DEFAULT 0,
      min_stock_level INTEGER NOT NULL DEFAULT 0,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_sold INTEGER NOT NULL,
      sale_date TIMESTAMP NOT NULL DEFAULT NOW(),
      notes TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_received INTEGER NOT NULL,
      delivery_date TIMESTAMP NOT NULL DEFAULT NOW(),
      supplier TEXT,
      notes TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_audit (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      transaction_type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      reference_id INTEGER,
      transaction_date TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (existing.rows.length === 0) {
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const password_hash = await bcrypt.hash(defaultPassword, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
      ['admin', password_hash, 'admin']
    );
    console.log(`Seeded default admin user (username: admin, password: ${defaultPassword}) — change this after first login.`);
  }
}

module.exports = { pool, initSchema };
