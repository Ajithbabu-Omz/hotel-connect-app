const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { eq, ne, or, and, isNull } = require('drizzle-orm');
const { getConnection } = require('../db/index');
const schema = require('../db/schema');
const { authenticate, requireAdmin, requireAdminOrStaff } = require('../middleware/auth');

// All admin/staff routes require authentication
router.use(authenticate);

// ── User management (admin only for creating staff; staff with canCreateUsers for guests) ──

router.post('/create-user', async (req, res) => {
  const { role: callerRole, canCreateUsers } = req.user;
  const { username, password, name, roomNumber, expiryDate, role: newRole, makeStaff } = req.body;

  // Determine what role the new user will have
  const targetRole = makeStaff ? 'staff' : (newRole || 'guest');

  // Only admin can create staff
  if (targetRole === 'staff' && callerRole !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create staff users' });
  }
  // Staff needs canCreateUsers to create guests
  if (targetRole === 'guest' && callerRole === 'staff' && !canCreateUsers) {
    return res.status(403).json({ error: 'No permission to create users' });
  }
  // Guests cannot create users
  if (callerRole === 'guest') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  if (targetRole === 'guest' && !roomNumber) {
    return res.status(400).json({ error: 'roomNumber required for guests' });
  }

  try {
    const { db } = getConnection();
    const existing = await db.select().from(schema.users).where(eq(schema.users.username, username));
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const [user] = await db
      .insert(schema.users)
      .values({
        username,
        password: bcrypt.hashSync(password, 10),
        displayName: name || username,
        role: targetRole,
        room: roomNumber || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: true,
        canCreateUsers: false,
      })
      .returning();

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        room: user.room,
        expiryDate: user.expiryDate,
        isActive: user.isActive,
        canCreateUsers: user.canCreateUsers,
      },
    });
  } catch (err) {
    console.error('Create user error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', requireAdminOrStaff, async (req, res) => {
  try {
    const { db } = getConnection();
    const rows = await db
      .select()
      .from(schema.users)
      .where(ne(schema.users.role, 'admin'))
      .orderBy(schema.users.createdAt);
    const list = rows.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      room: u.room,
      expiryDate: u.expiryDate,
      isActive: u.isActive,
      canCreateUsers: u.canCreateUsers,
      createdAt: u.createdAt,
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/users/:id', requireAdminOrStaff, async (req, res) => {
  const { name, roomNumber, expiryDate, password, isActive, canCreateUsers } = req.body;
  try {
    const { db } = getConnection();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Staff cannot edit other staff or admin accounts
    if (req.user.role === 'staff' && (user.role === 'admin' || user.role === 'staff')) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    // Only admin can toggle canCreateUsers
    if (canCreateUsers !== undefined && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can manage permissions' });
    }

    const updates = {};
    if (name) updates.displayName = name;
    if (roomNumber !== undefined) updates.room = roomNumber || null;
    if (expiryDate !== undefined) updates.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (password) updates.password = bcrypt.hashSync(password, 10);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (canCreateUsers !== undefined) updates.canCreateUsers = Boolean(canCreateUsers);

    const [updated] = await db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, req.params.id))
      .returning();

    // Close all open service requests if user is deactivated
    if (isActive === false || isActive === 'false') {
      await db
        .update(schema.serviceRequests)
        .set({ status: 'closed', closedAt: new Date(), closedById: req.user.id })
        .where(
          and(
            eq(schema.serviceRequests.userId, req.params.id),
            eq(schema.serviceRequests.status, 'open')
          )
        );
    }

    res.json({ success: true, user: { id: updated.id, username: updated.username, displayName: updated.displayName, role: updated.role, room: updated.room, expiryDate: updated.expiryDate, isActive: updated.isActive, canCreateUsers: updated.canCreateUsers } });
  } catch (err) {
    console.error('Update user error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { db } = getConnection();
    // Soft-delete: deactivate instead of remove
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, req.params.id));
    // Close their open service requests
    await db
      .update(schema.serviceRequests)
      .set({ status: 'closed', closedAt: new Date(), closedById: req.user.id })
      .where(
        and(
          eq(schema.serviceRequests.userId, req.params.id),
          eq(schema.serviceRequests.status, 'open')
        )
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Menu ──

router.post('/menu', requireAdminOrStaff, async (req, res) => {
  const { breakfast, lunch, dinner } = req.body;
  try {
    const { db } = getConnection();
    const [existing] = await db.select().from(schema.menu);
    if (existing) {
      const updates = {};
      if (breakfast !== undefined) updates.breakfast = breakfast;
      if (lunch !== undefined) updates.lunch = lunch;
      if (dinner !== undefined) updates.dinner = dinner;
      updates.updatedAt = new Date();
      await db.update(schema.menu).set(updates).where(eq(schema.menu.id, existing.id));
    } else {
      await db.insert(schema.menu).values({ breakfast: breakfast || '', lunch: lunch || '', dinner: dinner || '' });
    }
    // Create notification for menu update
    await db.insert(schema.notifications).values({
      message: 'Today\'s menu has been updated',
      type: 'menu_update',
    });
    const [updated] = await db.select().from(schema.menu);
    res.json({ success: true, menu: updated });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Broadcast ──

router.post('/broadcast', requireAdminOrStaff, async (req, res) => {
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

router.post('/events', requireAdminOrStaff, async (req, res) => {
  const { title, description, date, location } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title and date required' });
  try {
    const { db } = getConnection();
    const [event] = await db
      .insert(schema.events)
      .values({ title, description: description || '', date: new Date(date), location: location || '' })
      .returning();
    // Notify all users about new event
    await db.insert(schema.notifications).values({
      message: `New event: ${title}`,
      type: 'event',
      relatedId: event.id,
      relatedType: 'event',
    });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/events/:id', requireAdminOrStaff, async (req, res) => {
  const { title, description, date, location } = req.body;
  try {
    const { db } = getConnection();
    const updates = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (date) updates.date = new Date(date);
    if (location !== undefined) updates.location = location;
    const [event] = await db
      .update(schema.events)
      .set(updates)
      .where(eq(schema.events.id, req.params.id))
      .returning();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/events/:id', requireAdminOrStaff, async (req, res) => {
  try {
    const { db } = getConnection();
    await db.delete(schema.events).where(eq(schema.events.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Service Requests (admin/staff view) ──

router.get('/service-requests', requireAdminOrStaff, async (req, res) => {
  try {
    const { db } = getConnection();
    const requests = await db
      .select({
        id: schema.serviceRequests.id,
        userId: schema.serviceRequests.userId,
        type: schema.serviceRequests.type,
        status: schema.serviceRequests.status,
        createdAt: schema.serviceRequests.createdAt,
        closedAt: schema.serviceRequests.closedAt,
        userDisplayName: schema.users.displayName,
        userRoom: schema.users.room,
        userIsActive: schema.users.isActive,
      })
      .from(schema.serviceRequests)
      .innerJoin(schema.users, eq(schema.serviceRequests.userId, schema.users.id))
      .orderBy(schema.serviceRequests.createdAt);

    // Attach last message for each request
    const enriched = await Promise.all(
      requests.map(async (r) => {
        const messages = await db
          .select({
            id: schema.serviceRequestMessages.id,
            userId: schema.serviceRequestMessages.userId,
            message: schema.serviceRequestMessages.message,
            createdAt: schema.serviceRequestMessages.createdAt,
            senderRole: schema.users.role,
            senderDisplayName: schema.users.displayName,
          })
          .from(schema.serviceRequestMessages)
          .innerJoin(schema.users, eq(schema.serviceRequestMessages.userId, schema.users.id))
          .where(eq(schema.serviceRequestMessages.requestId, r.id))
          .orderBy(schema.serviceRequestMessages.createdAt);
        const lastMsg = messages[messages.length - 1] || null;
        return { ...r, lastMessage: lastMsg, messageCount: messages.length };
      })
    );
    res.json(enriched.reverse());
  } catch (err) {
    console.error('Get service requests error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Amenities management (admin only) ──

router.get('/amenities', requireAdmin, async (req, res) => {
  try {
    const { db } = getConnection();
    const list = await db.select().from(schema.amenities).orderBy(schema.amenities.sortOrder);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/amenities', requireAdmin, async (req, res) => {
  const { name, icon, description, sortOrder } = req.body;
  if (!name || !icon) return res.status(400).json({ error: 'name and icon required' });
  try {
    const { db } = getConnection();
    const [amenity] = await db
      .insert(schema.amenities)
      .values({ name, icon, description: description || '', sortOrder: sortOrder || 0 })
      .returning();
    res.json({ success: true, amenity });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/amenities/:id', requireAdmin, async (req, res) => {
  const { name, icon, description, sortOrder, isActive } = req.body;
  try {
    const { db } = getConnection();
    const updates = {};
    if (name) updates.name = name;
    if (icon) updates.icon = icon;
    if (description !== undefined) updates.description = description;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    const [amenity] = await db
      .update(schema.amenities)
      .set(updates)
      .where(eq(schema.amenities.id, req.params.id))
      .returning();
    res.json({ success: true, amenity });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/amenities/:id', requireAdmin, async (req, res) => {
  try {
    const { db } = getConnection();
    await db.delete(schema.amenities).where(eq(schema.amenities.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Settings (admin only) ──

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const { db } = getConnection();
    const rows = await db.select().from(schema.settings);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/service-requests/:id', (req, res) => {
  const request = store.serviceRequests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (req.body.status) request.status = req.body.status;
  res.json({ success: true, request });
});

// ── Community moderation (admin/staff) ──

router.delete('/posts/:id', requireAdminOrStaff, async (req, res) => {
  try {
    const { db } = getConnection();
    await db.delete(schema.comments).where(eq(schema.comments.postId, req.params.id));
    await db.delete(schema.postLikes).where(eq(schema.postLikes.postId, req.params.id));
    await db.delete(schema.posts).where(eq(schema.posts.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/comments/:id', requireAdminOrStaff, async (req, res) => {
  try {
    const { db } = getConnection();
    await db.delete(schema.commentLikes).where(eq(schema.commentLikes.commentId, req.params.id));
    await db.delete(schema.comments).where(eq(schema.comments.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
