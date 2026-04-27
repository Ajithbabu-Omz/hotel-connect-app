const express = require('express');
const router = express.Router();
const { eq, and, isNull, or, sql } = require('drizzle-orm');
const { getConnection } = require('../db/index');
const schema = require('../db/schema');
const { authenticate } = require('../middleware/auth');

router.get('/posts', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const posts = await db
      .select({
        id: schema.posts.id,
        userId: schema.posts.userId,
        content: schema.posts.content,
        createdAt: schema.posts.createdAt,
        editedAt: schema.posts.editedAt,
        displayName: schema.users.displayName,
        userIsActive: schema.users.isActive,
      })
      .from(schema.posts)
      .innerJoin(schema.users, eq(schema.posts.userId, schema.users.id))
      .orderBy(schema.posts.createdAt);

          const enriched = await Promise.all(
      posts.map(async (p) => {
        const likes = await db
          .select()
          .from(schema.postLikes)
          .where(eq(schema.postLikes.postId, p.id));
        const commentCount = await db
          .select({ count: sql`COUNT(*)` })
          .from(schema.comments)
          .where(and(eq(schema.comments.postId, p.id), isNull(schema.comments.parentId)));
        return {
          ...p,
          username: p.userIsActive ? p.displayName : `${p.displayName} (inactive)`,
          likeCount: likes.length,
          liked: likes.some((l) => l.userId === req.user.id),
          commentCount: Number(commentCount[0]?.count || 0),
        };
      })
    );
    res.json(enriched.reverse());
  } catch (err) {
    console.error('Get posts error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/posts', authenticate, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    const { db } = getConnection();
    const [post] = await db
      .insert(schema.posts)
      .values({ userId: req.user.id, content: content.trim() })
      .returning();
    const { displayName } = req.user;
    res.json({
      success: true,
      post: {
        ...post,
        username: displayName,
        likeCount: 0,
        liked: false,
        commentCount: 0,
        userIsActive: true,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/posts/:id/like', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const existing = await db
      .select()
      .from(schema.postLikes)
      .where(and(eq(schema.postLikes.postId, req.params.id), eq(schema.postLikes.userId, req.user.id)));
    if (existing.length > 0) {
      await db
        .delete(schema.postLikes)
        .where(and(eq(schema.postLikes.postId, req.params.id), eq(schema.postLikes.userId, req.user.id)));
    } else {
      await db.insert(schema.postLikes).values({ postId: req.params.id, userId: req.user.id });
    }
    const likes = await db.select().from(schema.postLikes).where(eq(schema.postLikes.postId, req.params.id));
    res.json({ success: true, likeCount: likes.length, liked: existing.length === 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/posts/:id', authenticate, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    const { db } = getConnection();
    const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, req.params.id));
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    const [updated] = await db
      .update(schema.posts)
      .set({ content: content.trim(), editedAt: new Date() })
      .where(eq(schema.posts.id, req.params.id))
      .returning();
    res.json({ success: true, post: updated });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/posts/:id', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, req.params.id));
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.userId !== req.user.id && req.user.role === 'guest') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await db.delete(schema.commentLikes).where(
      sql`comment_id IN (SELECT id FROM comments WHERE post_id = ${req.params.id})`
    );
    await db.delete(schema.comments).where(eq(schema.comments.postId, req.params.id));
    await db.delete(schema.postLikes).where(eq(schema.postLikes.postId, req.params.id));
    await db.delete(schema.posts).where(eq(schema.posts.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/comments/:postId', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const comments = await db
      .select({
        id: schema.comments.id,
        postId: schema.comments.postId,
        parentId: schema.comments.parentId,
        userId: schema.comments.userId,
        content: schema.comments.content,
        createdAt: schema.comments.createdAt,
        displayName: schema.users.displayName,
        userIsActive: schema.users.isActive,
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.comments.userId, schema.users.id))
      .where(eq(schema.comments.postId, req.params.postId))
      .orderBy(schema.comments.createdAt);

    const enriched = await Promise.all(
      comments.map(async (c) => {
        const likes = await db
          .select()
          .from(schema.commentLikes)
          .where(eq(schema.commentLikes.commentId, c.id));
        return {
          ...c,
          username: c.userIsActive ? c.displayName : `${c.displayName} (inactive)`,
          likeCount: likes.length,
          liked: likes.some((l) => l.userId === req.user.id),
        };
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/comments', authenticate, async (req, res) => {
  const { postId, content, parentId } = req.body;
  if (!postId || !content || !content.trim()) {
    return res.status(400).json({ error: 'postId and content required' });
  }
  try {
    const { db } = getConnection();
    const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const [comment] = await db
      .insert(schema.comments)
      .values({
        postId,
        parentId: parentId || null,
        userId: req.user.id,
        content: content.trim(),
      })
      .returning();

    // Notify post owner (if not the commenter)
    if (post.userId !== req.user.id && !parentId) {
      await db.insert(schema.notifications).values({
        message: `${req.user.displayName} commented on your post`,
        type: 'post_reply',
        targetUserId: post.userId,
        relatedId: postId,
        relatedType: 'post',
      });
    }
    // Notify parent comment author (if this is a reply)
    if (parentId) {
      const [parent] = await db.select().from(schema.comments).where(eq(schema.comments.id, parentId));
      if (parent && parent.userId !== req.user.id) {
        await db.insert(schema.notifications).values({
          message: `${req.user.displayName} replied to your comment`,
          type: 'comment_reply',
          targetUserId: parent.userId,
          relatedId: postId,
          relatedType: 'post',
        });
      }
    }

    res.json({
      success: true,
      comment: {
        ...comment,
        username: req.user.displayName,
        likeCount: 0,
        liked: false,
        userIsActive: true,
      },
    });
  } catch (err) {
    console.error('Create comment error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/comments/:id/like', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const existing = await db
      .select()
      .from(schema.commentLikes)
      .where(and(eq(schema.commentLikes.commentId, req.params.id), eq(schema.commentLikes.userId, req.user.id)));
    if (existing.length > 0) {
      await db
        .delete(schema.commentLikes)
        .where(and(eq(schema.commentLikes.commentId, req.params.id), eq(schema.commentLikes.userId, req.user.id)));
    } else {
      await db.insert(schema.commentLikes).values({ commentId: req.params.id, userId: req.user.id });
    }
    const likes = await db.select().from(schema.commentLikes).where(eq(schema.commentLikes.commentId, req.params.id));
    res.json({ success: true, likeCount: likes.length, liked: existing.length === 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit comment — owner only
router.put('/comments/:id', authenticate, (req, res) => {
  const comment = store.comments.find(c => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  comment.content = content.trim();
  comment.editedAt = new Date().toISOString();
  res.json({ success: true, comment: { ...comment, likeCount: comment.likes.length, liked: comment.likes.includes(req.user.id) } });
});

// Delete comment — owner or admin
router.delete('/comments/:id', authenticate, (req, res) => {
  const comment = store.comments.find(c => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  // Also remove any replies to this comment
  const idx = store.comments.findIndex(c => c.id === req.params.id);
  store.comments.splice(idx, 1);
  store.comments = store.comments.filter(c => c.parentId !== req.params.id);
  res.json({ success: true });
});

module.exports = router;
