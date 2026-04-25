const express = require('express');
const router = express.Router();
const store = require('../store');
const { authenticate } = require('../middleware/auth');

router.get('/notifications', authenticate, (req, res) => {
  const notifications = store.notifications
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(n => ({ ...n, read: n.readBy.includes(req.user.id) }));
  res.json(notifications);
});

router.post('/notifications/:id/read', authenticate, (req, res) => {
  const n = store.notifications.find(n => n.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Not found' });
  if (!n.readBy.includes(req.user.id)) n.readBy.push(req.user.id);
  res.json({ success: true });
});

router.get('/events', authenticate, (req, res) => {
  res.json(store.events.sort((a, b) => new Date(a.date) - new Date(b.date)));
});

router.get('/menu', authenticate, (req, res) => {
  res.json(store.menu);
});

module.exports = router;
