require('dotenv').config();
const { app, seedDefaultUsers } = require('./src/app');
const { connectDatabase } = require('./src/db');

const PORT = process.env.PORT || 3001;

async function start() {
  await connectDatabase();
  await seedDefaultUsers();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 [User Service] running on http://0.0.0.0:${PORT}`);
    console.log(`📦 Responsibility: User Management (Auth, Profiles)`);
    console.log(`📁 Database: User-owned (campus_users)`);
    console.log(`=======================================================`);
  });
}

start().catch((err) => {
  console.error('[User Service Fatal]', err);
  process.exit(1);
});
