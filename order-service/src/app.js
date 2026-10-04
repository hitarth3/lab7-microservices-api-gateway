const express = require('express');
const cors = require('cors');
const Order = require('./models/Order');
const Counter = require('./models/Counter');

const app = express();
app.use(cors());
app.use(express.json());

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const CALL_TIMEOUT_MS = Number(process.env.CALL_TIMEOUT_MS) || 3000;

async function getNextOrderId() {
  const counter = await Counter.findByIdAndUpdate(
    'orderId',
    { $inc: { sequence: 1 } },
    { returnDocument: 'after', new: true, upsert: true }
  );
  return counter.sequence;
}

// Resilient inter-service HTTP client with timeout
async function safeFetchJson(url, serviceName) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

  try {
    console.log(`[Order Service] Calling ${serviceName}: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      return { status: 404, data: null };
    }

    if (!response.ok) {
      return {
        status: response.status >= 500 ? 503 : response.status,
        data: null,
        errorMessage: `${serviceName} returned status ${response.status}`
      };
    }

    const data = await response.json();
    return { status: 200, data };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[Order Service] Communication failure with ${serviceName} (${url}):`, error.message);
    return {
      status: 503,
      data: null,
      errorMessage: `${serviceName} is unavailable (${error.name === 'AbortError' ? 'Request timed out' : error.message})`
    };
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'order-service',
    dependencies: {
      userServiceUrl: USER_SERVICE_URL,
      productServiceUrl: PRODUCT_SERVICE_URL
    },
    timestamp: new Date().toISOString()
  });
});

// GET /orders - list all orders
app.get('/orders', async (_req, res, next) => {
  try {
    const orders = await Order.find().sort({ id: -1 });
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
});

// GET /orders/:id - get order by ID
app.get('/orders/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Order ID must be a numeric integer.'
    });
  }

  try {
    const order = await Order.findOne({ id });
    if (!order) {
      return res.status(404).json({
        error: 'Order Not Found',
        message: `No order exists with id ${id}.`
      });
    }
    return res.status(200).json(order);
  } catch (error) {
    next(error);
  }
});

// POST /orders - create order with inter-service validation
app.post('/orders', async (req, res, next) => {
  const { userId, productId, quantity } = req.body;

  if (userId === undefined || isNaN(Number(userId))) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid numeric userId is required.' });
  }
  if (productId === undefined || isNaN(Number(productId))) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid numeric productId is required.' });
  }

  const parsedUserId = Number(userId);
  const parsedProductId = Number(productId);
  const parsedQty = quantity !== undefined && !isNaN(Number(quantity)) && Number(quantity) > 0 ? Number(quantity) : 1;

  try {
    // 1. Inter-service call: Validate User via User Service
    const userCall = await safeFetchJson(`${USER_SERVICE_URL}/users/${parsedUserId}`, 'User Service');

    if (userCall.status === 503) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: `User Service is currently unavailable at ${USER_SERVICE_URL}. Order creation failed gracefully.`,
        dependency: 'User Service',
        endpoint: `${USER_SERVICE_URL}/users/${parsedUserId}`
      });
    }

    if (userCall.status === 404 || !userCall.data) {
      return res.status(404).json({
        error: 'User Not Found',
        message: `Cannot create order: User with id ${parsedUserId} does not exist.`
      });
    }

    const userData = userCall.data;

    // 2. Inter-service call: Validate Product via Product Service
    const productCall = await safeFetchJson(`${PRODUCT_SERVICE_URL}/products/${parsedProductId}`, 'Product Service');

    if (productCall.status === 503) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: `Product Service is currently unavailable at ${PRODUCT_SERVICE_URL}. Order creation failed gracefully.`,
        dependency: 'Product Service',
        endpoint: `${PRODUCT_SERVICE_URL}/products/${parsedProductId}`
      });
    }

    if (productCall.status === 404 || !productCall.data) {
      return res.status(404).json({
        error: 'Product Not Found',
        message: `Cannot create order: Product with id ${parsedProductId} does not exist.`
      });
    }

    const productData = productCall.data;

    // 3. Calculate order total amount
    const totalAmount = Number((productData.price * parsedQty).toFixed(2));
    const nextId = await getNextOrderId();

    // 4. Persist order in Order DB (Order-owned database)
    const newOrder = await Order.create({
      id: nextId,
      userId: parsedUserId,
      productId: parsedProductId,
      quantity: parsedQty,
      totalAmount,
      status: 'CONFIRMED',
      userDetails: {
        name: userData.name,
        email: userData.email,
        department: userData.department
      },
      productDetails: {
        name: productData.name,
        price: productData.price,
        category: productData.category
      }
    });

    console.log(`[Order Service] Order #${nextId} placed successfully for User ${parsedUserId} (${userData.name}) - Total: $${totalAmount}`);
    return res.status(201).json(newOrder);
  } catch (error) {
    next(error);
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Order Service Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.'
  });
});

module.exports = { app };
