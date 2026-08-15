// Seeds sample phone case inventory data via the running API.
// Local: run backend first with `npm start`, then in another terminal: node seed.js
// Remote: SEED_BASE=https://your-app.vercel.app/api node seed.js

const BASE = process.env.SEED_BASE || 'http://localhost:5000/api';

const products = [
  { name: 'iPhone 15 Pro Clear Case', sku: 'PC-IP15P-CLR', description: 'Shockproof clear TPU case for iPhone 15 Pro', current_quantity: 50, min_stock_level: 15, unit_price: 12.99 },
  { name: 'iPhone 15 Silicone Case - Black', sku: 'PC-IP15-BLK', description: 'Soft-touch silicone case, black', current_quantity: 40, min_stock_level: 15, unit_price: 14.99 },
  { name: 'Samsung Galaxy S24 Rugged Case', sku: 'PC-GS24-RUG', description: 'Heavy-duty rugged case with kickstand', current_quantity: 30, min_stock_level: 10, unit_price: 18.99 },
  { name: 'iPhone 14 Leather Case - Brown', sku: 'PC-IP14-LTH', description: 'Genuine leather case, brown', current_quantity: 8, min_stock_level: 10, unit_price: 24.99 },
  { name: 'Samsung Galaxy S23 Wallet Case', sku: 'PC-GS23-WAL', description: 'Card-holder wallet case, flip cover', current_quantity: 20, min_stock_level: 8, unit_price: 21.99 },
  { name: 'iPhone 15 Pro Max MagSafe Case', sku: 'PC-IP15PM-MAG', description: 'MagSafe compatible case', current_quantity: 5, min_stock_level: 12, unit_price: 19.99 },
  { name: 'Google Pixel 8 Slim Case', sku: 'PC-GP8-SLM', description: 'Ultra-slim matte case', current_quantity: 25, min_stock_level: 10, unit_price: 11.99 },
  { name: 'Universal Phone Case Bulk Pack (Assorted)', sku: 'PC-UNI-BULK', description: 'Assorted sizes bulk pack for resale', current_quantity: 100, min_stock_level: 30, unit_price: 6.99 }
];

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log('Seeding phone case products...');
  const created = [];
  for (const p of products) {
    try {
      const product = await post('/products', p);
      created.push(product);
      console.log(`  + ${product.name} (id=${product.id})`);
    } catch (err) {
      console.error(`  ! Skipped "${p.name}": ${err.message}`);
    }
  }

  if (created.length === 0) {
    console.log('No products created (they may already exist). Done.');
    return;
  }

  const byName = (name) => created.find((p) => p.name === name);

  console.log('\nRecording sample sales...');
  const sales = [
    { product: 'iPhone 15 Pro Clear Case', qty: 12, notes: 'Online order batch #1042' },
    { product: 'iPhone 15 Silicone Case - Black', qty: 8, notes: 'Retail store sale' },
    { product: 'Samsung Galaxy S24 Rugged Case', qty: 5, notes: 'Wholesale order - TechMart' },
    { product: 'iPhone 14 Leather Case - Brown', qty: 3, notes: 'Online order batch #1043' },
    { product: 'iPhone 15 Pro Max MagSafe Case', qty: 4, notes: 'Retail store sale' },
    { product: 'Universal Phone Case Bulk Pack (Assorted)', qty: 20, notes: 'Bulk reseller order' }
  ];
  for (const s of sales) {
    const p = byName(s.product);
    if (!p) continue;
    try {
      const result = await post('/sales', { product_id: p.id, quantity_sold: s.qty, notes: s.notes });
      console.log(`  - Sold ${s.qty} x ${s.product} (stock ${result.previous_quantity} -> ${result.new_quantity})`);
    } catch (err) {
      console.error(`  ! Sale failed for ${s.product}: ${err.message}`);
    }
  }

  console.log('\nRecording sample deliveries...');
  const deliveries = [
    { product: 'iPhone 15 Pro Clear Case', qty: 30, supplier: 'GuardTech Accessories', notes: 'Restock shipment' },
    { product: 'Samsung Galaxy S23 Wallet Case', qty: 15, supplier: 'CaseWorks Supply Co.', notes: 'Monthly restock' },
    { product: 'Google Pixel 8 Slim Case', qty: 20, supplier: 'GuardTech Accessories', notes: 'Restock shipment' },
    { product: 'iPhone 14 Leather Case - Brown', qty: 10, supplier: 'Premium Leather Goods Ltd.', notes: 'New stock arrival' }
  ];
  for (const d of deliveries) {
    const p = byName(d.product);
    if (!p) continue;
    try {
      const result = await post('/deliveries', {
        product_id: p.id,
        quantity_received: d.qty,
        supplier: d.supplier,
        notes: d.notes
      });
      console.log(`  + Received ${d.qty} x ${d.product} (stock ${result.previous_quantity} -> ${result.new_quantity})`);
    } catch (err) {
      console.error(`  ! Delivery failed for ${d.product}: ${err.message}`);
    }
  }

  console.log('\nSeeding complete.');
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
