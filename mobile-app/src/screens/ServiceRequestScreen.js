import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
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

export default function ServiceRequestScreen({ route, navigation }) {
  const { request: initialRequest, isGuest } = route.params;
  const { user } = useAuth();
  const [request, setRequest] = useState(initialRequest);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const canClose = user?.role === 'admin' || (user?.role === 'guest' && request?.userId === user?.id);
  const canReply = request?.status === 'open' &&
    (user?.role === 'admin' || user?.role === 'staff' ||
      (user?.role === 'guest' && request?.userId === user?.id));

  async function fetchMessages() {
    try {
      const { data } = await api.get(`/service-request/${initialRequest.id}/messages`);
      setRequest(data.request);
      setMessages(data.messages);
    } catch (e) {
      console.error('Fetch messages error', e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchMessages(); }, []));

  async function sendReply() {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/service-request/${request.id}/reply`, { message: replyText.trim() });
      setReplyText('');
      await fetchMessages();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    Alert.alert('Close Request', 'Are you sure you want to close this service request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive', onPress: async () => {
          try {
            await api.post(`/service-request/${request.id}/close`);
            await fetchMessages();
            Alert.alert('Closed', 'Service request has been closed');
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.error || 'Failed to close request');
          }
        },
      },
    ]);
  }

  const TYPE_ICONS = { cleaning: '🧹', food: '🍽', maintenance: '🔧' };
  const isClosed = request?.status === 'closed';

  function renderMessage({ item }) {
    const isMe = item.userId === user?.id;
    const isStaffAdmin = item.senderRole === 'admin' || item.senderRole === 'staff';
    const senderLabel = item.senderIsActive
      ? item.senderDisplayName
      : `${item.senderDisplayName} (inactive)`;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && (
          <View style={[styles.msgAvatar, isStaffAdmin && styles.msgAvatarStaff]}>
            <Text style={styles.msgAvatarText}>{(senderLabel || 'U')[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
          {!isMe && (
            <Text style={[styles.msgSender, isStaffAdmin && { color: '#1E3A8A' }]}>
              {senderLabel}{isStaffAdmin ? ` (${item.senderRole})` : ''}
            </Text>
          )}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {TYPE_ICONS[request?.type] || '📋'} {request?.type?.charAt(0).toUpperCase() + request?.type?.slice(1)} Request
          </Text>
          <View style={[styles.statusBadge, isClosed ? styles.statusClosed : styles.statusOpen]}>
            <Text style={styles.statusText}>{isClosed ? 'Closed' : 'Open'}</Text>
          </View>
        </View>
        {canClose && !isClosed && (
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        )}
        {(!canClose || isClosed) && <View style={{ width: 50 }} />}
      </View>

      {/* Request meta */}
      {!isGuest && (
        <View style={styles.metaBar}>
          <Text style={styles.metaText}>
            {request?.userDisplayName}{!request?.userIsActive ? ' (inactive)' : ''} · Room {request?.userRoom}
          </Text>
          <Text style={styles.metaTime}>Created {timeAgo(request?.createdAt)}</Text>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#1E3A8A" /></View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.msgList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No messages yet</Text>
              </View>
            }
            renderItem={renderMessage}
          />

          {isClosed ? (
            <View style={styles.closedBar}>
              <Text style={styles.closedBarText}>This request is closed</Text>
            </View>
          ) : canReply ? (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Write a reply..."
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!replyText.trim() || sending) && { opacity: 0.4 }]}
                onPress={sendReply}
                disabled={!replyText.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.sendText}>Send</Text>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.closedBar}>
              <Text style={styles.closedBarText}>You cannot reply to this request</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { paddingRight: 8 },
  backText: { fontSize: 14, color: '#1E3A8A', fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  statusOpen: { backgroundColor: '#FEF3C7' },
  statusClosed: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  closeBtn: { backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  closeBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },

  metaBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 8,
  },
  metaText: { fontSize: 13, color: '#1E3A8A', fontWeight: '600' },
  metaTime: { fontSize: 11, color: '#6B7280' },

  msgList: { padding: 12, gap: 10 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },

  msgAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#9CA3AF',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  msgAvatarStaff: { backgroundColor: '#1E3A8A' },
  msgAvatarText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  msgBubble: {
    maxWidth: '75%', borderRadius: 14, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  msgBubbleMe: { backgroundColor: '#1E3A8A', borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: '#FFF', borderBottomLeftRadius: 4 },

  msgSender: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 3 },
  msgText: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
  msgTextMe: { color: '#FFF' },
  msgTime: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: 'rgba(255,255,255,0.65)' },

  empty: { flex: 1, alignItems: 'center', paddingTop: 40 },
  emptyText: { color: '#9CA3AF', fontSize: 14 },

  inputRow: {
    flexDirection: 'row', padding: 10, backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8, alignItems: 'flex-end',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: '#1F2937',
    backgroundColor: '#F9FAFB', maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#1E3A8A', borderRadius: 18, paddingHorizontal: 16,
    paddingVertical: 10, justifyContent: 'center',
  },
  sendText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  closedBar: {
    backgroundColor: '#F3F4F6', padding: 14, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  closedBarText: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
});
