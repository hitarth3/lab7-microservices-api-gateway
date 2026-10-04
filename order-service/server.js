require('dotenv').config();
const { app } = require('./src/app');
const { connectDatabase } = require('./src/db');

const PORT = process.env.PORT || 3003;

async function start() {
  await connectDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`📝 [Order Service] running on http://0.0.0.0:${PORT}`);
    console.log(`📦 Responsibility: Order Processing & Orchestration`);
    console.log(`🔗 User Service URL: ${process.env.USER_SERVICE_URL || 'http://localhost:3001'}`);
    console.log(`🔗 Product Service URL: ${process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002'}`);
    console.log(`📁 Database: Order-owned (campus_orders)`);
    console.log(`=======================================================`);
  });
}

start().catch((err) => {
  console.error('[Order Service Fatal]', err);
  process.exit(1);
});
