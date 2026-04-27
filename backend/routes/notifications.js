const express = require('express');
const router = express.Router();
const store = require('../store');
const { authenticate } = require('../middleware/auth');

// Get notifications for the current user:
//   - Broadcast/general/maintenance/emergency (no targetUserId) → all users
//   - Social notifications (like/comment/service_reply) → only if targetUserId matches
router.get('/notifications', authenticate, (req, res) => {
  const notifications = store.notifications
    .filter(n => {
      if (!n.targetUserId) return true; // broadcast-style, visible to all
      return n.targetUserId === req.user.id;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(n => ({ ...n, read: n.readBy.includes(req.user.id) }));
  res.json(notifications);
});

// Mark a single notification as read
router.post('/notifications/:id/read', authenticate, (req, res) => {
  const n = store.notifications.find(n => n.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Not found' });
  if (!n.readBy.includes(req.user.id)) n.readBy.push(req.user.id);
  res.json({ success: true });
});

// Mark ALL notifications as read for the current user
router.put('/notifications/read-all', authenticate, (req, res) => {
  const userId = req.user.id;
  store.notifications
    .filter(n => !n.targetUserId || n.targetUserId === userId)
    .forEach(n => {
      if (!n.readBy.includes(userId)) n.readBy.push(userId);
    });
  res.json({ success: true });
});

router.get('/events', authenticate, (req, res) => {
  res.json(store.events.sort((a, b) => new Date(a.date) - new Date(b.date)));
});

router.get('/menu', authenticate, (req, res) => {
  res.json(store.menu);
});

module.exports = router;
