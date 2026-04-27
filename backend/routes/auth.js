const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { eq, and, isNull, or } = require('drizzle-orm');
const { getConnection } = require('../db/index');
const schema = require('../db/schema');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const { db } = getConnection();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account deactivated' });
    }
    if (user.role === 'guest' && user.expiryDate && new Date() > new Date(user.expiryDate)) {
      return res.status(401).json({ error: 'Account expired' });
    }
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        room: user.room,
        canCreateUsers: user.canCreateUsers,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        room: user.room,
        expiryDate: user.expiryDate,
        canCreateUsers: user.canCreateUsers,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isActive) return res.status(401).json({ error: 'Account deactivated' });
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      room: user.room,
      expiryDate: user.expiryDate,
      canCreateUsers: user.canCreateUsers,
      isActive: user.isActive,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update own display name (guests only; admin/staff use admin panel)
router.put('/me/display-name', authenticate, async (req, res) => {
  const { displayName } = req.body;
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: 'Display name required' });
  }
  try {
    const { db } = getConnection();
    await db
      .update(schema.users)
      .set({ displayName: displayName.trim() })
      .where(eq(schema.users.id, req.user.id));
    res.json({ success: true, displayName: displayName.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit a new service request (guests only)
router.post('/service-request', authenticate, async (req, res) => {
  const { type, description } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'description required' });
  }
  if (req.user.role !== 'guest') {
    return res.status(403).json({ error: 'Only guests can submit service requests' });
  }
  try {
    const { db } = getConnection();
    const [request] = await db
      .insert(schema.serviceRequests)
      .values({ userId: req.user.id, type })
      .returning();
    await db.insert(schema.serviceRequestMessages).values({
      requestId: request.id,
      userId: req.user.id,
      message: description.trim(),
    });
    res.json({ success: true, request });
  } catch (err) {
    console.error('Service request error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user's service requests
router.get('/my-requests', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const requests = await db
      .select()
      .from(schema.serviceRequests)
      .where(eq(schema.serviceRequests.userId, req.user.id))
      .orderBy(schema.serviceRequests.createdAt);
    // Attach last message and message count
    const enriched = await Promise.all(
      requests.map(async (r) => {
        const messages = await db
          .select()
          .from(schema.serviceRequestMessages)
          .where(eq(schema.serviceRequestMessages.requestId, r.id))
          .orderBy(schema.serviceRequestMessages.createdAt);
        return { ...r, messages, messageCount: messages.length };
      })
    );
    res.json(enriched.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a service request
router.get('/service-request/:id/messages', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const [request] = await db
      .select()
      .from(schema.serviceRequests)
      .where(eq(schema.serviceRequests.id, req.params.id));
    if (!request) return res.status(404).json({ error: 'Request not found' });
    // Guests can only see their own requests
    if (req.user.role === 'guest' && request.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const messages = await db
      .select({
        id: schema.serviceRequestMessages.id,
        requestId: schema.serviceRequestMessages.requestId,
        userId: schema.serviceRequestMessages.userId,
        message: schema.serviceRequestMessages.message,
        createdAt: schema.serviceRequestMessages.createdAt,
        senderDisplayName: schema.users.displayName,
        senderRole: schema.users.role,
        senderIsActive: schema.users.isActive,
      })
      .from(schema.serviceRequestMessages)
      .innerJoin(schema.users, eq(schema.serviceRequestMessages.userId, schema.users.id))
      .where(eq(schema.serviceRequestMessages.requestId, req.params.id))
      .orderBy(schema.serviceRequestMessages.createdAt);
    res.json({ request, messages });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reply to a service request
router.post('/service-request/:id/reply', authenticate, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
  try {
    const { db } = getConnection();
    const [request] = await db
      .select()
      .from(schema.serviceRequests)
      .where(eq(schema.serviceRequests.id, req.params.id));
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status === 'closed') return res.status(400).json({ error: 'Request is closed' });
    // Guests can only reply to their own requests
    if (req.user.role === 'guest' && request.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const [msg] = await db
      .insert(schema.serviceRequestMessages)
      .values({ requestId: request.id, userId: req.user.id, message: message.trim() })
      .returning();
    // Notify guest when admin/staff replies
    if ((req.user.role === 'admin' || req.user.role === 'staff') && request.userId !== req.user.id) {
      await db.insert(schema.notifications).values({
        message: `Your service request (${request.type}) has a new reply`,
        type: 'service_reply',
        targetUserId: request.userId,
        relatedId: request.id,
        relatedType: 'service_request',
      });
    }
    res.json({ success: true, message: msg });
  } catch (err) {
    console.error('Reply error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Close a service request (user or admin, NOT staff)
router.post('/service-request/:id/close', authenticate, async (req, res) => {
  if (req.user.role === 'staff') {
    return res.status(403).json({ error: 'Staff cannot close service requests' });
  }
  try {
    const { db } = getConnection();
    const [request] = await db
      .select()
      .from(schema.serviceRequests)
      .where(eq(schema.serviceRequests.id, req.params.id));
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status === 'closed') return res.status(400).json({ error: 'Already closed' });
    if (req.user.role === 'guest' && request.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await db
      .update(schema.serviceRequests)
      .set({ status: 'closed', closedAt: new Date(), closedById: req.user.id })
      .where(eq(schema.serviceRequests.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
