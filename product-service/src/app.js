const express = require('express');
const cors = require('cors');
const Product = require('./models/Product');
const Counter = require('./models/Counter');

const app = express();
app.use(cors());
app.use(express.json());

async function getNextProductId() {
  const counter = await Counter.findByIdAndUpdate(
    'productId',
    { $inc: { sequence: 1 } },
    { returnDocument: 'after', new: true, upsert: true }
  );
  return counter.sequence;
}

// Seed default products if empty
async function seedDefaultProducts() {
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      await Counter.findByIdAndUpdate(
        'productId',
        { sequence: 502 },
        { upsert: true }
      );
      await Product.create([
        {
          id: 501,
          name: 'Introduction to Algorithms (4th Edition)',
          description: 'Comprehensive core algorithms textbook for Computer Science courses.',
          price: 89.99,
          stock: 45,
          category: 'Textbooks'
        },
        {
          id: 502,
          name: 'CampusConnect Official Lanyard & Card Holder',
          description: 'Durable university badge lanyard with RFID protection.',
          price: 9.99,
          stock: 150,
          category: 'Merchandise'
        }
      ]);
      console.log('[Product Service] Seeded default products (501: Algorithms Textbook, 502: Official Lanyard).');
    }
  } catch (err) {
    console.error('[Product Service] Seed error:', err.message);
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'product-service',
    timestamp: new Date().toISOString()
  });
});

// GET /products - list all products
app.get('/products', async (_req, res, next) => {
  try {
    const products = await Product.find().sort({ id: 1 });
    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
});

// GET /products/:id - get product by ID
app.get('/products/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Product ID must be a numeric integer.'
    });
  }

  try {
    const product = await Product.findOne({ id });
    if (!product) {
      return res.status(404).json({
        error: 'Product Not Found',
        message: `No product exists with id ${id}.`
      });
    }
    return res.status(200).json(product);
  } catch (error) {
    next(error);
  }
});

// POST /products - create a new product
app.post('/products', async (req, res, next) => {
  const { name, description, price, stock, category, id } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Product name is required.' });
  }
  if (price === undefined || typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid positive price is required.' });
  }

  try {
    const assignedId = id && Number.isInteger(Number(id)) ? Number(id) : await getNextProductId();

    const product = await Product.create({
      id: assignedId,
      name: name.trim(),
      description: description ? description.trim() : '',
      price: Number(price.toFixed(2)),
      stock: stock !== undefined ? Number(stock) : 100,
      category: category ? category.trim() : 'General'
    });

    return res.status(201).json(product);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Conflict', message: 'Product ID already exists.' });
    }
    next(error);
  }
});

// PUT /products/:id - update existing product
app.put('/products/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Product ID must be a numeric integer.' });
  }

  const { name, description, price, stock, category } = req.body;

  try {
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) {
      if (typeof price !== 'number' || price < 0) {
        return res.status(400).json({ error: 'Bad Request', message: 'Price must be a positive number.' });
      }
      updateData.price = Number(price.toFixed(2));
    }
    if (stock !== undefined) updateData.stock = Number(stock);
    if (category) updateData.category = category.trim();

    const updated = await Product.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Product Not Found', message: `No product exists with id ${id}.` });
    }

    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /products/:id - delete product
app.delete('/products/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Product ID must be a numeric integer.' });
  }

  try {
    const deleted = await Product.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: 'Product Not Found', message: `No product exists with id ${id}.` });
    }
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Product Service Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.'
  });
});

module.exports = { app, seedDefaultProducts };
