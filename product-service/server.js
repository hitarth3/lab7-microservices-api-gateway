require('dotenv').config();
const { app, seedDefaultProducts } = require('./src/app');
const { connectDatabase } = require('./src/db');

const PORT = process.env.PORT || 3002;

async function start() {
  await connectDatabase();
  await seedDefaultProducts();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🛒 [Product Service] running on http://0.0.0.0:${PORT}`);
    console.log(`📦 Responsibility: Product & Catalog Management`);
    console.log(`📁 Database: Product-owned (campus_products)`);
    console.log(`=======================================================`);
  });
}

start().catch((err) => {
  console.error('[Product Service Fatal]', err);
  process.exit(1);
});
