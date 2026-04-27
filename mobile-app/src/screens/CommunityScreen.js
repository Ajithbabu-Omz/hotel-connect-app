import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Modal, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityScreen({ route, navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New post modal
  const [postModal, setPostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [postingLoading, setPostingLoading] = useState(false);

  // Edit post modal
  const [editModal, setEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Comments modal
  const [commentModal, setCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentInputRef = useRef(null);

  // Comment edit state
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [editCommentLoading, setEditCommentLoading] = useState(false);

  async function fetchPosts() {
    try {
      const { data } = await api.get('/posts');
      setPosts(data);
    } catch (e) {
      console.error('Fetch posts error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchPosts(); }, []));

  useEffect(() => {
    if (route?.params?.openPostId && posts.length > 0) {
      const post = posts.find(p => p.id === route.params.openPostId);
      if (post && !commentModal) {
        openComments(post);
        // Clear param so it doesn't reopen if the user closes it manually
        navigation.setParams({ openPostId: null });
      }
    }
  }, [route?.params?.openPostId, posts]);

  async function handleLikePost(postId) {
    try {
      const { data } = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, likeCount: data.likeCount, liked: data.liked } : p
      ));
    } catch {}
  }

  function openEditPost(post) {
    setEditingPost(post);
    setEditContent(post.content);
    setEditModal(true);
  }

  async function handleEditPost() {
    if (!editContent.trim() || editLoading) return;
    setEditLoading(true);
    try {
      const { data } = await api.put(`/posts/${editingPost.id}`, { content: editContent });
      setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: data.post.content, editedAt: data.post.editedAt } : p));
      setEditModal(false);
    } catch {
      Alert.alert('Error', 'Failed to update post');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeletePost(postId) {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/posts/${postId}`);
            setPosts(prev => prev.filter(p => p.id !== postId));
          } catch {}
        }
      },
    ]);
  }

  async function createPost() {
    if (!newPostContent.trim()) return;
    setPostingLoading(true);
    try {
      const { data } = await api.post('/posts', { content: newPostContent });
      setPosts(prev => [data.post, ...prev]);
      setNewPostContent('');
      setPostModal(false);
    } catch {
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setPostingLoading(false);
    }
  }

  async function openComments(post) {
    setSelectedPost(post);
    setCommentModal(true);
    setCommentsLoading(true);
    setComments([]);
    setReplyingTo(null);
    setCommentText('');
    setEditingCommentId(null);
    try {
      const { data } = await api.get(`/comments/${post.id}`);
      setComments(data);
    } catch {} finally {
      setCommentsLoading(false);
    }
  }

  async function submitComment() {
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const payload = { postId: selectedPost.id, content: commentText };
      if (replyingTo) payload.parentId = replyingTo.id;
      const { data } = await api.post('/comments', payload);
      setComments(prev => [...prev, data.comment]);
      // Update comment count on the post
      setPosts(prev => prev.map(p =>
        p.id === selectedPost.id ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
      ));
      setCommentText('');
      setReplyingTo(null);
    } catch {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleLikeComment(commentId) {
    try {
      const { data } = await api.post(`/comments/${commentId}/like`);
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, likeCount: data.likeCount, liked: data.liked } : c
      ));
    } catch {}
  }

  function startEditComment(comment) {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  }

  async function saveEditComment(commentId) {
    if (!editCommentText.trim() || editCommentLoading) return;
    setEditCommentLoading(true);
    try {
      const { data } = await api.put(`/comments/${commentId}`, { content: editCommentText });
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, content: data.comment.content, editedAt: data.comment.editedAt } : c
      ));
      setEditingCommentId(null);
    } catch {
      Alert.alert('Error', 'Failed to edit comment');
    } finally {
      setEditCommentLoading(false);
    }
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditCommentText('');
  }

  async function handleDeleteComment(commentId) {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));
          } catch {
            Alert.alert('Error', 'Failed to delete comment');
          }
        }
      },
    ]);
  }

  function renderPost({ item }) {
    const isOwner = item.userId === user?.id;
    const canDelete = isOwner || user?.role === 'admin' || user?.role === 'staff';
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.username || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.postUser}>{item.username}</Text>
            <Text style={styles.postTime}>{timeAgo(item.createdAt)}{item.editedAt ? ' · edited' : ''}</Text>
          </View>
          <View style={styles.postBtns}>
            {isOwner && (
              <TouchableOpacity onPress={() => openEditPost(item)} style={styles.iconBtnWrap}>
                <Text style={styles.iconBtnText}>✏️</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity onPress={() => handleDeletePost(item.id)} style={styles.iconBtnWrap}>
                <Text style={styles.iconBtnText}>🗑</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.postCardBody}>
          <Text style={styles.postContent}>{item.content}</Text>
        </View>

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLikePost(item.id)}>
            <Text style={[styles.actionIcon, item.liked && styles.liked]}>
              {item.liked ? '❤️' : '🤍'}
            </Text>
            <Text style={[styles.actionCount, item.liked && styles.liked]}>{item.likeCount || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => openComments(item)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionCount}>{item.commentCount || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render a single comment row with optional inline edit
  function renderCommentRow(comment, isReply = false) {
    const isOwner = comment.userId === user?.id;
    const canDelete = isOwner || user?.role === 'admin';
    const isEditing = editingCommentId === comment.id;

    return (
      <View key={comment.id} style={isReply ? styles.reply : styles.comment}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUser}>{comment.username}</Text>
          <View style={styles.commentHeaderRight}>
            <Text style={styles.commentTime}>
              {timeAgo(comment.createdAt)}{comment.editedAt ? ' · edited' : ''}
            </Text>
            {isOwner && !isEditing && (
              <TouchableOpacity onPress={() => startEditComment(comment)} style={styles.commentIconBtn}>
                <Text style={styles.commentIconTxt}>✏️</Text>
              </TouchableOpacity>
            )}
            {canDelete && !isEditing && (
              <TouchableOpacity onPress={() => handleDeleteComment(comment.id)} style={styles.commentIconBtn}>
                <Text style={styles.commentIconTxt}>🗑</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isEditing ? (
          <View style={styles.inlineEditWrap}>
            <TextInput
              style={styles.inlineEditInput}
              value={editCommentText}
              onChangeText={setEditCommentText}
              multiline
              autoFocus
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.inlineEditBtns}>
              <TouchableOpacity onPress={cancelEditComment} style={styles.inlineCancelBtn}>
                <Text style={styles.inlineCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => saveEditComment(comment.id)}
                style={[styles.inlineSaveBtn, editCommentLoading && { opacity: 0.6 }]}
                disabled={editCommentLoading}
              >
                {editCommentLoading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.inlineSaveTxt}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.commentText}>{comment.content}</Text>
        )}

        {!isEditing && (
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={() => handleLikeComment(comment.id)}>
              <Text style={styles.commentAction}>
                {comment.liked ? '❤️' : '🤍'} {comment.likeCount || 0}
              </Text>
            </TouchableOpacity>
            {!isReply && (
              <TouchableOpacity onPress={() => {
                setReplyingTo(comment);
                setTimeout(() => commentInputRef.current?.focus(), 100);
              }}>
                <Text style={styles.commentAction}>↩ Reply</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  // Build threaded comments: top-level + their replies
  function renderComments() {
    const topLevel = comments.filter(c => !c.parentId);
    return topLevel.map(comment => {
      const replies = comments.filter(c => c.parentId === comment.id);
      return (
        <View key={comment.id}>
          {renderCommentRow(comment, false)}
          {replies.map(reply => renderCommentRow(reply, true))}
        </View>
      );
    });
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1E3A8A" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPosts(); }}
            colors={['#1E3A8A']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No posts yet. Be the first!</Text>
          </View>
        }
      />

      {/* Floating New Post Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setPostModal(true)}>
        <Text style={styles.fabText}>+ New Post</Text>
      </TouchableOpacity>

      {/* New Post Modal */}
      <Modal visible={postModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setPostModal(false); setNewPostContent(''); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Post</Text>
            <View style={{ width: 60 }} />
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setPostModal(false); setNewPostContent(''); }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Post</Text>
              <TouchableOpacity
                onPress={createPost}
                disabled={!newPostContent.trim() || postingLoading}
              >
                {postingLoading
                  ? <ActivityIndicator color="#1E3A8A" />
                  : <Text style={[styles.modalPost, !newPostContent.trim() && { opacity: 0.4 }]}>Post</Text>
                }
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.postInput}
                value={newPostContent}
                onChangeText={setNewPostContent}
                placeholder="What's on your mind?"
                placeholderTextColor="#9CA3AF"
                multiline
                autoFocus
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Edit Post Modal */}
      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Post</Text>
              <TouchableOpacity onPress={handleEditPost} disabled={!editContent.trim() || editLoading}>
                {editLoading
                  ? <ActivityIndicator color="#1E3A8A" />
                  : <Text style={[styles.modalPost, !editContent.trim() && { opacity: 0.4 }]}>Save</Text>
                }
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.postInput}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="Edit your post..."
                placeholderTextColor="#9CA3AF"
                multiline
                autoFocus
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={commentModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setCommentModal(false); setReplyingTo(null); setEditingCommentId(null); }}>
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={{ width: 50 }} />
          </View>

          {selectedPost && (
            <View style={styles.commentPostPreview}>
              <Text style={styles.commentPostPreviewUser}>{selectedPost.username}</Text>
              <Text style={styles.commentPostText}>{selectedPost.content}</Text>
            </View>
          )}

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
          >
            <ScrollView
              style={styles.commentsScroll}
              contentContainerStyle={{ padding: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              {commentsLoading
                ? <ActivityIndicator color="#1E3A8A" style={{ marginTop: 20 }} />
                : renderComments()
              }
              {!commentsLoading && comments.length === 0 && (
                <Text style={styles.noComments}>No comments yet. Add one!</Text>
              )}
            </ScrollView>

            {replyingTo && (
              <View style={styles.replyingBar}>
                <Text style={styles.replyingText}>Replying to {replyingTo.username}</Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Text style={styles.replyingCancel}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                ref={commentInputRef}
                style={styles.commentInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : 'Add a comment...'}
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={submitComment}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!commentText.trim() || submittingComment) && { opacity: 0.4 }]}
                onPress={submitComment}
                disabled={!commentText.trim() || submittingComment}
              >
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1E3A8A' },
  fab: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: '#1E3A8A', borderRadius: 28, paddingHorizontal: 24, paddingVertical: 13, shadowColor: '#1E3A8A', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  list: { padding: 12, gap: 12 },
  postCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1E3A8A', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  postMeta: { flex: 1 },
  postUser: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  postTime: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  postBtns: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtnWrap: { padding: 6 },
  iconBtnText: { fontSize: 16 },
  postCardBody: { marginTop: 4, marginBottom: 16 },
  postContent: { fontSize: 16, color: '#1F2937', lineHeight: 24, fontWeight: '500' },
  postActions: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { fontSize: 18 },
  actionCount: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  liked: { color: '#EF4444' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
  modalSafe: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalCancel: { fontSize: 15, color: '#6B7280' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalPost: { fontSize: 15, color: '#1E3A8A', fontWeight: '700' },
  postInput: { flex: 1, fontSize: 16, color: '#1F2937', padding: 16, textAlignVertical: 'top', minHeight: 150 },
  commentPostPreview: {
    backgroundColor: '#EFF6FF', padding: 16,
    margin: 12, borderRadius: 12,
    borderLeftWidth: 4, borderLeftColor: '#1E3A8A',
  },
  commentPostPreviewUser: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 6 },
  commentPostText: { fontSize: 16, color: '#1F2937', fontWeight: 'bold', lineHeight: 22 },
  commentsScroll: { flex: 1 },
  comment: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  reply: {
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10,
    marginBottom: 8, marginLeft: 28, borderLeftWidth: 3, borderLeftColor: '#93C5FD',
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentUser: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  commentTime: { fontSize: 11, color: '#9CA3AF' },
  commentIconBtn: { padding: 3 },
  commentIconTxt: { fontSize: 13 },
  commentText: { fontSize: 14, color: '#374151', lineHeight: 19, marginBottom: 8 },
  commentActions: { flexDirection: 'row', gap: 16 },
  commentAction: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  noComments: { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontSize: 14 },
  inlineEditWrap: { marginVertical: 6 },
  inlineEditInput: {
    borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
    color: '#1F2937', backgroundColor: '#EFF6FF', textAlignVertical: 'top', minHeight: 60,
  },
  inlineEditBtns: { flexDirection: 'row', gap: 8, marginTop: 6, justifyContent: 'flex-end' },
  inlineCancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  inlineCancelTxt: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  inlineSaveBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1E3A8A' },
  inlineSaveTxt: { fontSize: 13, color: '#FFF', fontWeight: '700' },
  replyingBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8,
  },
  replyingText: { fontSize: 13, color: '#1E3A8A', fontWeight: '500' },
  replyingCancel: { color: '#6B7280', fontSize: 16, padding: 4 },
  commentInputRow: {
    flexDirection: 'row', padding: 10,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8,
  },
  commentInput: {
    flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 14,
    color: '#1F2937', backgroundColor: '#F9FAFB',
  },
  sendBtn: { backgroundColor: '#1E3A8A', borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center' },
  sendText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
