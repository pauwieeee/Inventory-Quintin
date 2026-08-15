const { Pool } = require('pg');

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
}

module.exports = { pool, initSchema };
