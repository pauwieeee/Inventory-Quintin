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

const DEFAULT_CATEGORIES = [
  'Cases', 'Chargers', 'Cables', 'Screen Protectors', 'Power Banks', 'Earphones',
  'Headsets', 'Speakers', 'Holders & Stands', 'Gaming Accessories', 'Batteries',
  'Adapters', 'Others'
];

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'staff',
      store_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      admin_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_names (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      name TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      category TEXT NOT NULL DEFAULT 'Others',
      store_id INTEGER NOT NULL REFERENCES stores(id),
      description TEXT,
      current_quantity INTEGER NOT NULL DEFAULT 0,
      min_stock_level INTEGER NOT NULL DEFAULT 0,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      cost NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_sold INTEGER NOT NULL,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      subtotal NUMERIC NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'None',
      discount_value NUMERIC NOT NULL DEFAULT 0,
      discount_amount NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      cash_amount NUMERIC NOT NULL DEFAULT 0,
      card_amount NUMERIC NOT NULL DEFAULT 0,
      card_type TEXT,
      last4 TEXT,
      ref TEXT,
      staff_name TEXT,
      cashier TEXT,
      remarks TEXT,
      sale_date TIMESTAMP NOT NULL DEFAULT NOW()
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

  for (const name of DEFAULT_CATEGORIES) {
    await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }

  const userCount = await pool.query('SELECT COUNT(*) FROM users');
  if (Number(userCount.rows[0].count) === 0) {
    await seedDemoData();
  }
}

async function hash(pw) {
  return bcrypt.hash(pw, 10);
}

async function seedDemoData() {
  const host = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, 'host') RETURNING id`,
    ['host', await hash('host123'), 'Host Superuser']
  );
  const hostId = host.rows[0].id;

  const admin1 = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, 'admin') RETURNING id`,
    ['cellcare', await hash('cellcare123'), 'Cellcare']
  );
  const admin1Id = admin1.rows[0].id;

  const admin2 = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, 'admin') RETURNING id`,
    ['gaminggrounds', await hash('gaminggrounds123'), 'Gaming Grounds']
  );
  const admin2Id = admin2.rows[0].id;

  const store1 = await pool.query(
    `INSERT INTO stores (name, admin_id) VALUES ($1, $2) RETURNING id`,
    ['Cellcare', admin1Id]
  );
  const store1Id = store1.rows[0].id;

  const store2 = await pool.query(
    `INSERT INTO stores (name, admin_id) VALUES ($1, $2) RETURNING id`,
    ['Gaming Grounds', admin2Id]
  );
  const store2Id = store2.rows[0].id;

  const store3 = await pool.query(
    `INSERT INTO stores (name, admin_id) VALUES ($1, $2) RETURNING id`,
    ['Gamens and Gadgets', admin2Id]
  );
  const store3Id = store3.rows[0].id;

  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role, store_id) VALUES ($1, $2, $3, 'store', $4)`,
    ['store', await hash('store123'), 'Cellcare Store', store1Id]
  );
  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role, store_id) VALUES ($1, $2, $3, 'store', $4)`,
    ['store2', await hash('store2123'), 'Gaming Grounds Store', store2Id]
  );
  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role, store_id) VALUES ($1, $2, $3, 'store', $4)`,
    ['store3', await hash('store3123'), 'Gamens and Gadgets Store', store3Id]
  );
  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role, store_id) VALUES ($1, $2, $3, 'staff', $4)`,
    ['cc-cindy', await hash('cc-cindy'), 'Cindy', store1Id]
  );
  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role, store_id) VALUES ($1, $2, $3, 'staff', $4)`,
    ['gg-jc', await hash('gg-jc'), 'JC', store2Id]
  );

  await pool.query(`INSERT INTO staff_names (store_id, name) VALUES ($1,'Cindy'),($1,'Alex'),($1,'Sam')`, [store1Id]);
  await pool.query(`INSERT INTO staff_names (store_id, name) VALUES ($1,'JC'),($1,'Mika')`, [store2Id]);
  await pool.query(`INSERT INTO staff_names (store_id, name) VALUES ($1,'Alex'),($1,'Rey')`, [store3Id]);

  const products = [
    { name: 'iPhone 15 Pro Max Premium Case', category: 'Cases', price: 1200, cost: 600, stock: 45, storeId: store1Id },
    { name: '65W Fast Charger GaN', category: 'Chargers', price: 850, cost: 400, stock: 30, storeId: store2Id },
    { name: 'Braided USB-C Cable 1.5m', category: 'Cables', price: 350, cost: 120, stock: 120, storeId: store1Id },
    { name: 'Tempered Glass Screen Protector', category: 'Screen Protectors', price: 250, cost: 80, stock: 200, storeId: store2Id },
    { name: 'Gaming Headset RGB 7.1', category: 'Headsets', price: 1500, cost: 900, stock: 18, storeId: store3Id },
    { name: '20000mAh Power Bank PD', category: 'Power Banks', price: 1800, cost: 1100, stock: 22, storeId: store3Id }
  ];

  const productIds = {};
  for (const p of products) {
    const res = await pool.query(
      `INSERT INTO products (name, category, store_id, current_quantity, min_stock_level, unit_price, cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [p.name, p.category, p.storeId, p.stock, Math.round(p.stock * 0.2), p.price, p.cost]
    );
    productIds[p.name] = res.rows[0].id;
  }

  await pool.query(
    `INSERT INTO sales (store_id, product_id, quantity_sold, unit_price, subtotal, discount_type, discount_value, discount_amount, total, payment_method, cash_amount, card_amount, staff_name, remarks, cashier)
     VALUES ($1,$2,2,1200,2400,'None',0,0,2400,'Cash',2400,0,'Cindy','Regular customer','store')`,
    [store1Id, productIds['iPhone 15 Pro Max Premium Case']]
  );
  await pool.query(
    `INSERT INTO sales (store_id, product_id, quantity_sold, unit_price, subtotal, discount_type, discount_value, discount_amount, total, payment_method, cash_amount, card_amount, card_type, last4, ref, staff_name, remarks, cashier)
     VALUES ($1,$2,1,850,850,'Percent',10,85,765,'Card',0,765,'Visa','1234','REF001','JC','','store2')`,
    [store2Id, productIds['65W Fast Charger GaN']]
  );
  await pool.query(
    `INSERT INTO sales (store_id, product_id, quantity_sold, unit_price, subtotal, discount_type, discount_value, discount_amount, total, payment_method, cash_amount, card_amount, card_type, last4, ref, staff_name, remarks, cashier)
     VALUES ($1,$2,1,1500,1500,'Fixed',200,200,1300,'Split',800,500,'Mastercard','5678','REF002','Alex','Split payment','store3')`,
    [store3Id, productIds['Gaming Headset RGB 7.1']]
  );

  console.log('Seeded demo data: host/host123, cellcare/cellcare123, gaminggrounds/gaminggrounds123, store/store123, store2/store2123, store3/store3123, cc-cindy/cc-cindy, gg-jc/gg-jc');
}

module.exports = { pool, initSchema };
