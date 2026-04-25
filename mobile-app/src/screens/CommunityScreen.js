import React, { useState, useCallback } from 'react';
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

export default function CommunityScreen() {
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
    Alert.alert('Delete Post', 'Are you sure?', [
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
    } catch (e) {
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

  function renderPost({ item }) {
    const isOwner = item.userId === user?.id;
    const canDelete = isOwner || user?.role === 'admin';
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
              <TouchableOpacity onPress={() => openEditPost(item)} style={styles.editBtnWrap}>
                <Text style={styles.editBtn}>✏️</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity onPress={() => handleDeletePost(item.id)}>
                <Text style={styles.deleteBtn}>🗑</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.postContent}>{item.content}</Text>

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

  // Build threaded comments: top-level + their replies
  function renderComments() {
    const topLevel = comments.filter(c => !c.parentId);
    return topLevel.map(comment => {
      const replies = comments.filter(c => c.parentId === comment.id);
      return (
        <View key={comment.id}>
          <View style={styles.comment}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentUser}>{comment.username}</Text>
              <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
            </View>
            <Text style={styles.commentText}>{comment.content}</Text>
            <View style={styles.commentActions}>
              <TouchableOpacity onPress={() => handleLikeComment(comment.id)}>
                <Text style={styles.commentAction}>
                  {comment.liked ? '❤️' : '🤍'} {comment.likeCount || 0}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setReplyingTo(comment)}>
                <Text style={styles.commentAction}>↩ Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
          {replies.map(reply => (
            <View key={reply.id} style={styles.reply}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentUser}>{reply.username}</Text>
                <Text style={styles.commentTime}>{timeAgo(reply.createdAt)}</Text>
              </View>
              <Text style={styles.commentText}>{reply.content}</Text>
              <TouchableOpacity onPress={() => handleLikeComment(reply.id)}>
                <Text style={styles.commentAction}>
                  {reply.liked ? '❤️' : '🤍'} {reply.likeCount || 0}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
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
        <TouchableOpacity style={styles.newPostBtn} onPress={() => setPostModal(true)}>
          <Text style={styles.newPostText}>+ Post</Text>
        </TouchableOpacity>
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

      {/* New Post Modal */}
      <Modal visible={postModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
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
          <TextInput
            style={styles.postInput}
            value={newPostContent}
            onChangeText={setNewPostContent}
            placeholder="What's on your mind?"
            placeholderTextColor="#9CA3AF"
            multiline
            autoFocus
          />
        </SafeAreaView>
      </Modal>

      {/* Edit Post Modal */}
      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
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
          <TextInput
            style={styles.postInput}
            value={editContent}
            onChangeText={setEditContent}
            placeholder="Edit your post..."
            placeholderTextColor="#9CA3AF"
            multiline
            autoFocus
          />
        </SafeAreaView>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={commentModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setCommentModal(false); setReplyingTo(null); }}>
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={{ width: 50 }} />
          </View>

          {selectedPost && (
            <View style={styles.commentPostPreview}>
              <Text style={styles.commentPostText} numberOfLines={2}>{selectedPost.content}</Text>
            </View>
          )}

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={120}
          >
            <ScrollView style={styles.commentsScroll} contentContainerStyle={{ padding: 12 }}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 20, fontWeight: '700', color: '#1E3A8A' },
  newPostBtn: { backgroundColor: '#1E3A8A', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  newPostText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  list: { padding: 12, gap: 12 },
  postCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1E3A8A', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  postMeta: { flex: 1 },
  postUser: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  postTime: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  postBtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnWrap: { padding: 4 },
  editBtn: { fontSize: 15 },
  deleteBtn: { fontSize: 16, padding: 4 },
  postContent: { fontSize: 14, color: '#374151', lineHeight: 21, marginBottom: 12 },
  postActions: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { fontSize: 18 },
  actionCount: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  liked: { color: '#EF4444' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
  modalSafe: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalCancel: { fontSize: 15, color: '#6B7280' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalPost: { fontSize: 15, color: '#1E3A8A', fontWeight: '700' },
  postInput: { flex: 1, fontSize: 16, color: '#1F2937', padding: 16, textAlignVertical: 'top' },
  commentPostPreview: { backgroundColor: '#F3F4F6', padding: 12, borderLeftWidth: 3, borderLeftColor: '#1E3A8A', margin: 12, borderRadius: 8 },
  commentPostText: { fontSize: 13, color: '#6B7280' },
  commentsScroll: { flex: 1 },
  comment: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 10 },
  reply: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 10, marginBottom: 8, marginLeft: 24, borderLeftWidth: 2, borderLeftColor: '#D1D5DB' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentUser: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  commentTime: { fontSize: 11, color: '#9CA3AF' },
  commentText: { fontSize: 14, color: '#374151', lineHeight: 19, marginBottom: 8 },
  commentActions: { flexDirection: 'row', gap: 16 },
  commentAction: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  noComments: { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontSize: 14 },
  replyingBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8 },
  replyingText: { fontSize: 13, color: '#1E3A8A', fontWeight: '500' },
  replyingCancel: { color: '#6B7280', fontSize: 16, padding: 4 },
  commentInputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: '#1F2937', backgroundColor: '#F9FAFB' },
  sendBtn: { backgroundColor: '#1E3A8A', borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center' },
  sendText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
