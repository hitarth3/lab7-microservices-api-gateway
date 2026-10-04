const mongoose = require('mongoose');

let isConnecting = false;

async function connectDatabase(maxRetries = 15, delayMs = 2000) {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/campus_products';

  if (mongoose.connection.readyState === 1 || isConnecting) {
    return;
  }

  isConnecting = true;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnecting = false;
      const sanitizedUri = uri.replace(/\/\/.*@/, '//<credentials>@');
      console.log(`[Product Service] Connected to database: ${sanitizedUri}`);
      return;
    } catch (error) {
      if (attempt >= maxRetries) {
        isConnecting = false;
        console.error(`[Product Service] Database connection failed after ${attempt} attempts: ${error.message}`);
        break;
      }
      console.warn(`[Product Service] DB connection attempt ${attempt}/${maxRetries} failed (${error.message}). Retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  isConnecting = false;
}

module.exports = { connectDatabase };
