const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = store.users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.role === 'guest' && user.expiryDate && new Date() > new Date(user.expiryDate)) {
    return res.status(401).json({ error: 'Account expired' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name, room: user.room },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name, room: user.room, expiryDate: user.expiryDate },
  });
});

router.get('/me', authenticate, (req, res) => {
  const user = store.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, role: user.role, name: user.name, room: user.room, expiryDate: user.expiryDate });
});

router.post('/service-request', authenticate, (req, res) => {
  const { type, description } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  const request = {
    id: uuidv4(),
    userId: req.user.id,
    username: req.user.name,
    room: req.user.room,
    type,
    description: description || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  store.serviceRequests.push(request);
  res.json({ success: true, request });
});

router.get('/my-requests', authenticate, (req, res) => {
  const requests = store.serviceRequests
    .filter(r => r.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(requests);
});

module.exports = router;
