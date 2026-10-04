const express = require('express');
const cors = require('cors');
const User = require('./models/User');
const Counter = require('./models/Counter');

const app = express();
app.use(cors());
app.use(express.json());

async function getNextUserId() {
  const counter = await Counter.findByIdAndUpdate(
    'userId',
    { $inc: { sequence: 1 } },
    { returnDocument: 'after', new: true, upsert: true }
  );
  return counter.sequence;
}

// Seed default users if empty
async function seedDefaultUsers() {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      await Counter.findByIdAndUpdate(
        'userId',
        { sequence: 102 },
        { upsert: true }
      );
      await User.create([
        {
          id: 101,
          name: 'Alice Johnson',
          email: 'alice@campus.edu',
          department: 'Computer Science',
          role: 'student'
        },
        {
          id: 102,
          name: 'Bob Smith',
          email: 'bob@campus.edu',
          department: 'Information Technology',
          role: 'student'
        }
      ]);
      console.log('[User Service] Seeded default users (101: Alice Johnson, 102: Bob Smith).');
    }
  } catch (err) {
    console.error('[User Service] Seed error:', err.message);
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'user-service',
    timestamp: new Date().toISOString()
  });
});

// GET /users - list all users
app.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().sort({ id: 1 });
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
});

// GET /users/:id - get user by ID
app.get('/users/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'User ID must be a numeric integer.'
    });
  }

  try {
    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: `No user exists with id ${id}.`
      });
    }
    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

// POST /users - create a new user
app.post('/users', async (req, res, next) => {
  const { name, email, department, role, id } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'User name is required.' });
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid email is required.' });
  }

  try {
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'User with this email already exists.' });
    }

    const assignedId = id && Number.isInteger(Number(id)) ? Number(id) : await getNextUserId();

    const user = await User.create({
      id: assignedId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department ? department.trim() : 'Computer Science',
      role: role ? role.trim() : 'student'
    });

    return res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Conflict', message: 'Duplicate ID or email.' });
    }
    next(error);
  }
});

// PUT /users/:id - update existing user
app.put('/users/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'User ID must be a numeric integer.' });
  }

  const { name, email, department, role } = req.body;

  try {
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (department) updateData.department = department.trim();
    if (role) updateData.role = role.trim();

    const updated = await User.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'User Not Found', message: `No user exists with id ${id}.` });
    }

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Conflict', message: 'Email already in use.' });
    }
    next(error);
  }
});

// DELETE /users/:id - delete user
app.delete('/users/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'User ID must be a numeric integer.' });
  }

  try {
    const deleted = await User.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: 'User Not Found', message: `No user exists with id ${id}.` });
    }
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[User Service Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.'
  });
});

module.exports = { app, seedDefaultUsers };
