const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { authenticate } = require('../middleware/auth');

router.get('/posts', authenticate, (req, res) => {
  const posts = store.posts
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(post => ({
      ...post,
      commentCount: store.comments.filter(c => c.postId === post.id && !c.parentId).length,
      likeCount: post.likes.length,
      liked: post.likes.includes(req.user.id),
    }));
  res.json(posts);
});

router.post('/posts', authenticate, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const post = {
    id: uuidv4(),
    userId: req.user.id,
    username: req.user.name,
    content: content.trim(),
    likes: [],
    createdAt: new Date().toISOString(),
  };
  store.posts.push(post);
  res.json({ success: true, post: { ...post, likeCount: 0, liked: false, commentCount: 0 } });
});

router.post('/posts/:id/like', authenticate, (req, res) => {
  const post = store.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const idx = post.likes.indexOf(req.user.id);
  if (idx === -1) post.likes.push(req.user.id);
  else post.likes.splice(idx, 1);
  res.json({ success: true, likeCount: post.likes.length, liked: idx === -1 });
});

router.put('/posts/:id', authenticate, (req, res) => {
  const post = store.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  post.content = content.trim();
  post.editedAt = new Date().toISOString();
  res.json({ success: true, post });
});

router.delete('/posts/:id', authenticate, (req, res) => {
  const post = store.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const idx = store.posts.findIndex(p => p.id === req.params.id);
  store.posts.splice(idx, 1);
  store.comments = store.comments.filter(c => c.postId !== req.params.id);
  res.json({ success: true });
});

router.get('/comments/:postId', authenticate, (req, res) => {
  const comments = store.comments
    .filter(c => c.postId === req.params.postId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(c => ({ ...c, likeCount: c.likes.length, liked: c.likes.includes(req.user.id) }));
  res.json(comments);
});

router.post('/comments', authenticate, (req, res) => {
  const { postId, content, parentId } = req.body;
  if (!postId || !content || !content.trim()) return res.status(400).json({ error: 'postId and content required' });
  if (!store.posts.find(p => p.id === postId)) return res.status(404).json({ error: 'Post not found' });
  const comment = {
    id: uuidv4(),
    postId,
    parentId: parentId || null,
    userId: req.user.id,
    username: req.user.name,
    content: content.trim(),
    likes: [],
    createdAt: new Date().toISOString(),
  };
  store.comments.push(comment);
  res.json({ success: true, comment: { ...comment, likeCount: 0, liked: false } });
});

router.post('/comments/:id/like', authenticate, (req, res) => {
  const comment = store.comments.find(c => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  const idx = comment.likes.indexOf(req.user.id);
  if (idx === -1) comment.likes.push(req.user.id);
  else comment.likes.splice(idx, 1);
  res.json({ success: true, likeCount: comment.likes.length, liked: idx === -1 });
});

module.exports = router;
