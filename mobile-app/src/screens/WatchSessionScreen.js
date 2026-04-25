import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function WatchSessionScreen({ route, navigation }) {
  const { channel: initialChannel, readOnly } = route.params;
  const { user } = useAuth();
  const isReadOnly = readOnly || user?.role === 'admin';
  const [channel, setChannel] = useState(initialChannel);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(!isReadOnly);
  const flatRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isReadOnly) {
      loadMessages();
    } else {
      joinChannel();
    }
    return () => {
      if (!isReadOnly) leaveChannel();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function loadMessages() {
    try {
      const [msgRes, chRes] = await Promise.all([
        api.get(`/channels/${initialChannel.channelId}/messages`),
        api.get(`/channels/${initialChannel.channelId}`),
      ]);
      setMessages(msgRes.data);
      setChannel(prev => ({ ...prev, viewers: chRes.data.viewers }));
    } catch {}
    intervalRef.current = setInterval(refreshMessages, 5000);
  }

  async function joinChannel() {
    try {
      const { data } = await api.post('/join-channel', { channelId: initialChannel.channelId });
      setMessages(data.messages || []);
      setChannel(prev => ({ ...prev, viewers: data.viewers }));
    } catch (e) {
      console.error('Join channel error', e);
    } finally {
      setJoining(false);
    }
    intervalRef.current = setInterval(refreshMessages, 5000);
  }

  async function leaveChannel() {
    try {
      await api.post('/leave-channel', { channelId: initialChannel.channelId });
    } catch {}
  }

  async function refreshMessages() {
    try {
      const [msgRes, chRes] = await Promise.all([
        api.get(`/channels/${initialChannel.channelId}/messages`),
        api.get(`/channels/${initialChannel.channelId}`),
      ]);
      setMessages(msgRes.data);
      setChannel(prev => ({ ...prev, viewers: chRes.data.viewers }));
    } catch {}
  }

  async function sendMessage() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/channels/${initialChannel.channelId}/message`, { message });
      setMessages(prev => [...prev, data.message]);
      setMessage('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error('Send message error', e);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }) {
    const isMe = item.userId === user?.id;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && <Text style={styles.msgUser}>{item.username}</Text>}
        <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.channelName} numberOfLines={1}>{channel.name}</Text>
          <Text style={styles.program} numberOfLines={1}>{channel.currentProgram}</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Text style={styles.viewerCount}>👁 {channel.viewers}</Text>
        </View>
      </View>

      <View style={styles.nowPlaying}>
        <View style={styles.liveDot} />
        <Text style={styles.nowText}>NOW: {channel.currentProgram}</Text>
        <Text style={styles.nextText}>  |  NEXT: {channel.nextProgram}</Text>
      </View>

      {isReadOnly && (
        <View style={styles.readOnlyBar}>
          <Text style={styles.readOnlyText}>👁 View-only mode — admin cannot send messages</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {joining ? (
          <View style={styles.centered}><ActivityIndicator color="#1E3A8A" /></View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.chatEmpty}>
                <Text style={styles.chatEmptyText}>No messages yet</Text>
              </View>
            }
          />
        )}

        {!isReadOnly && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Say something..."
              placeholderTextColor="#9CA3AF"
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!message.trim() || sending}
            >
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { paddingRight: 10 },
  backText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  headerInfo: { flex: 1 },
  channelName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  program: { color: '#93C5FD', fontSize: 12, marginTop: 1 },
  viewerBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  viewerCount: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  nowPlaying: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 14, paddingVertical: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 },
  nowText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  nextText: { color: '#94A3B8', fontSize: 12 },
  readOnlyBar: { backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 7 },
  readOnlyText: { color: '#92400E', fontSize: 12, fontWeight: '500', textAlign: 'center' },
  chatContainer: { flex: 1 },
  messageList: { padding: 12, gap: 8 },
  msgRow: { alignItems: 'flex-start', maxWidth: '80%' },
  msgRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgUser: { fontSize: 11, color: '#6B7280', marginBottom: 2, marginLeft: 4 },
  msgBubble: { backgroundColor: '#FFF', borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  msgBubbleMe: { backgroundColor: '#1E3A8A', borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  msgText: { fontSize: 14, color: '#1F2937', lineHeight: 19 },
  msgTextMe: { color: '#FFF' },
  chatEmpty: { flex: 1, alignItems: 'center', paddingTop: 40 },
  chatEmptyText: { color: '#9CA3AF', fontSize: 14 },
  inputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8 },
  chatInput: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: '#1F2937', backgroundColor: '#F9FAFB' },
  sendBtn: { backgroundColor: '#1E3A8A', borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.45 },
  sendText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
