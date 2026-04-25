const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.post('/create-user', (req, res) => {
  const { username, password, name, roomNumber, expiryDate } = req.body;
  if (!username || !password || !roomNumber) {
    return res.status(400).json({ error: 'username, password, and roomNumber required' });
  }
  if (store.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  const user = {
    id: uuidv4(),
    username,
    password: bcrypt.hashSync(password, 10),
    role: 'guest',
    name: name || username,
    room: roomNumber,
    expiryDate: expiryDate || null,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, room: user.room, expiryDate: user.expiryDate, role: user.role } });
});

router.get('/users', (req, res) => {
  const users = store.users
    .filter(u => u.role !== 'admin')
    .map(u => ({ id: u.id, username: u.username, name: u.name, room: u.room, expiryDate: u.expiryDate, role: u.role, createdAt: u.createdAt }));
  res.json(users);
});

router.put('/users/:id', (req, res) => {
  const user = store.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { name, roomNumber, expiryDate, password } = req.body;
  if (name) user.name = name;
  if (roomNumber) user.room = roomNumber;
  if (expiryDate !== undefined) user.expiryDate = expiryDate;
  if (password) user.password = bcrypt.hashSync(password, 10);
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, room: user.room, expiryDate: user.expiryDate } });
});

router.delete('/users/:id', (req, res) => {
  const idx = store.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  store.users.splice(idx, 1);
  res.json({ success: true });
});

router.post('/menu', (req, res) => {
  const { breakfast, lunch, dinner } = req.body;
  if (breakfast) store.menu.breakfast = breakfast;
  if (lunch) store.menu.lunch = lunch;
  if (dinner) store.menu.dinner = dinner;
  res.json({ success: true, menu: store.menu });
});

router.post('/broadcast', (req, res) => {
  const { message, type } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  const notification = {
    id: uuidv4(),
    message,
    type: type || 'broadcast',
    createdAt: new Date().toISOString(),
    readBy: [],
  };
  store.notifications.push(notification);
  res.json({ success: true, notification });
});

router.post('/events', (req, res) => {
  const { title, description, date, location } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title and date required' });
  const event = {
    id: uuidv4(),
    title,
    description: description || '',
    date,
    location: location || '',
    createdAt: new Date().toISOString(),
  };
  store.events.push(event);
  res.json({ success: true, event });
});

router.put('/events/:id', (req, res) => {
  const event = store.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const { title, description, date, location } = req.body;
  if (title) event.title = title;
  if (description !== undefined) event.description = description;
  if (date) event.date = date;
  if (location !== undefined) event.location = location;
  res.json({ success: true, event });
});

router.delete('/events/:id', (req, res) => {
  const idx = store.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Event not found' });
  store.events.splice(idx, 1);
  res.json({ success: true });
});

router.get('/service-requests', (req, res) => {
  res.json(store.serviceRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

router.put('/service-requests/:id', (req, res) => {
  const request = store.serviceRequests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (req.body.status) request.status = req.body.status;
  res.json({ success: true, request });
});

router.delete('/posts/:id', (req, res) => {
  const idx = store.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  store.posts.splice(idx, 1);
  store.comments = store.comments.filter(c => c.postId !== req.params.id);
  res.json({ success: true });
});

router.delete('/comments/:id', (req, res) => {
  const idx = store.comments.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Comment not found' });
  store.comments.splice(idx, 1);
  res.json({ success: true });
});

module.exports = router;
