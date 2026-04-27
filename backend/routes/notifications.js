const express = require('express');
const router = express.Router();
const { eq, and, isNull, or, desc } = require('drizzle-orm');
const { getConnection } = require('../db/index');
const schema = require('../db/schema');
const { authenticate } = require('../middleware/auth');

router.get('/notifications', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    // Get global notifications + notifications targeted at this user
    const notifications = await db
      .select()
      .from(schema.notifications)
      .where(
        or(
          isNull(schema.notifications.targetUserId),
          eq(schema.notifications.targetUserId, req.user.id)
        )
      )
      .orderBy(desc(schema.notifications.createdAt));

    const reads = await db
      .select()
      .from(schema.notificationReads)
      .where(eq(schema.notificationReads.userId, req.user.id));
    const readSet = new Set(reads.map((r) => r.notificationId));

    res.json(notifications.map((n) => ({ ...n, read: readSet.has(n.id) })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    await db
      .insert(schema.notificationReads)
      .values({ notificationId: req.params.id, userId: req.user.id })
      .onConflictDoNothing();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/notifications/unread-count', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const notifications = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        or(
          isNull(schema.notifications.targetUserId),
          eq(schema.notifications.targetUserId, req.user.id)
        )
      );
    const reads = await db
      .select()
      .from(schema.notificationReads)
      .where(eq(schema.notificationReads.userId, req.user.id));
    const readSet = new Set(reads.map((r) => r.notificationId));
    const unread = notifications.filter((n) => !readSet.has(n.id)).length;
    res.json({ count: unread });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/events', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const events = await db.select().from(schema.events).orderBy(schema.events.date);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/menu', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const [menuRow] = await db.select().from(schema.menu);
    res.json(menuRow || { breakfast: '', lunch: '', dinner: '' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/amenities', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const list = await db
      .select()
      .from(schema.amenities)
      .where(eq(schema.amenities.isActive, true))
      .orderBy(schema.amenities.sortOrder);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
