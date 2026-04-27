import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import api, { BASE_URL } from '../api/api';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_HEIGHT = Math.round(SCREEN_WIDTH * (9 / 16));

// ─── Shaka Player HTML template ──────────────────────────────────────────────
function buildShakaHtml({ streamUrl, drmToken, backendUrl, authToken }) {
  const hasDrm = Boolean(drmToken);
  const drmServersJson = hasDrm
    ? JSON.stringify({
        'com.widevine.alpha': {
          LA_URL: 'https://dish-sb.conax.cloud/widevine/license',
          maxLicenseRequestRetries: 0,
          headers: { PreAuthorization: drmToken },
        },
      })
    : null;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#000; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; }
    video { width:100%; height:100%; object-fit:contain; }
    #error { display:none; color:#FCA5A5; font-family:sans-serif; font-size:13px; text-align:center; padding:16px; }
  </style>
</head>
<body>
  <video id="video" playsinline controls></video>
  <div id="error"></div>
  <script src="https://cdn.jsdelivr.net/npm/shaka-player@4/dist/shaka-player.compiled.js"></script>
  <script>
    (async function () {
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Browser not supported for DRM playback';
        return;
      }
      const video = document.getElementById('video');
      const player = new shaka.Player(video);

      var config = {
        streaming: { bufferingGoal: 15, rebufferingGoal: 9 },
      };
      ${hasDrm ? `config.drm = { servers: ${drmServersJson} };` : '// clear content — no DRM'}
      player.configure(config);

      // Proxy all manifest/segment requests through the backend
      var _proxyUrl = ${JSON.stringify(backendUrl + '/request')};
      var _authToken = ${JSON.stringify(authToken)};
      player.getNetworkingEngine().registerRequestFilter(function(type, request) {
        if (type === 2) return; // 2 = LICENSE, goes direct to license server
        var originalUrl = request.uris[0];
        request.uris = [_proxyUrl];
        request.method = 'POST';
        request.headers = {
          'Content-Type': 'application/json',
          'Authorization': _authToken,
        };
        request.body = JSON.stringify({ url: originalUrl });
      });

      player.addEventListener('error', function(e) {
        var el = document.getElementById('error');
        el.style.display = 'block';
        el.textContent = 'Playback error: ' + (e.detail && e.detail.message ? e.detail.message : e.detail && e.detail.code ? 'code ' + e.detail.code : 'unknown');
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: el.textContent }));
      });

      try {
        await player.load(${JSON.stringify(streamUrl)});

        // Wait until at least 3 segments (~9 s) are buffered before starting playback
        function startWhenReady() {
          if (video.buffered.length > 0 && (video.buffered.end(0) - video.currentTime) >= 9) {
            video.play();
          } else {
            video.addEventListener('progress', function onProgress() {
              if (video.buffered.length > 0 && (video.buffered.end(0) - video.currentTime) >= 9) {
                video.removeEventListener('progress', onProgress);
                video.play();
              }
            });
          }
        }
        startWhenReady();
      } catch (err) {
        var el = document.getElementById('error');
        el.style.display = 'block';
        var httpStatus = (err.data && err.data[1]) ? ' [HTTP ' + err.data[1] + ']' : '';
        var failedUrl = (err.data && err.data[0]) ? ' url=' + err.data[0] : '';
        el.textContent = 'Load error: code=' + (err.code || '?') + httpStatus + failedUrl + ' — ' + err.message;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: err.message }));
      }
    })();
  </script>
</body>
</html>`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WatchSessionScreen({ route, navigation }) {
  const { channel: initialChannel, readOnly } = route.params;
  const { user } = useAuth();
  const isReadOnly = readOnly || user?.role === 'admin' || user?.role === 'staff';

  const [channel, setChannel] = useState(initialChannel);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(!isReadOnly);
  const [drmData, setDrmData] = useState(null);   // { streamUrl, drmToken }
  const [drmError, setDrmError] = useState(null);
  const [drmLoading, setDrmLoading] = useState(true);

  const flatRef = useRef(null);
  const intervalRef = useRef(null);

  // Fetch DRM token from backend on mount
  useEffect(() => {
    (async () => {
      try {
        const contentId = initialChannel.channelId;
        const { data } = await api.get('/drm-token', { params: { contentId } });
        // Stream URL comes from EPG (channel object), not the DRM token response
        const streamUrl = initialChannel.streamUrlWidevine || initialChannel.streamUrl;
        setDrmData({ streamUrl, drmToken: data.drmToken });
      } catch (e) {
        setDrmError('Could not load stream. Please try again.');
        console.error('DRM token error:', e?.response?.data || e.message);
      } finally {
        setDrmLoading(false);
      }
    })();
  }, []);

  // Chat join / leave
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
    } catch { }
    intervalRef.current = setInterval(refreshMessages, 5000);
  }

  async function joinChannel() {
    try {
      const [joinRes, msgRes] = await Promise.all([
        api.post('/join-channel', { channelId: initialChannel.channelId }),
        api.get(`/channels/${initialChannel.channelId}/messages`),
      ]);
      setMessages(msgRes.data || []);
      setChannel(prev => ({ ...prev, viewers: joinRes.data.viewers }));
    } catch (e) {
      console.error('Join channel error', e);
    } finally {
      setJoining(false);
    }
    intervalRef.current = setInterval(refreshMessages, 5000);
  }

  async function leaveChannel() {
    try { await api.post('/leave-channel', { channelId: initialChannel.channelId }); } catch { }
  }

  async function refreshMessages() {
    try {
      const [msgRes, chRes] = await Promise.all([
        api.get(`/channels/${initialChannel.channelId}/messages`),
        api.get(`/channels/${initialChannel.channelId}`),
      ]);
      setMessages(msgRes.data);
      setChannel(prev => ({ ...prev, viewers: chRes.data.viewers }));
    } catch { }
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
        {!isMe && <Text style={styles.msgUser}>{item.username || item.displayName}</Text>}
        <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
        </View>
      </View>
    );
  }

  const shakaHtml = drmData
    ? buildShakaHtml({
        streamUrl: drmData.streamUrl,
        drmToken: drmData.drmToken,
        backendUrl: BASE_URL,
        authToken: api.defaults.headers.common['Authorization'] || '',
      })
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top bar ── */}
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

      {/* ── Shaka Player ── */}
      <View style={styles.playerContainer}>
        {drmLoading && (
          <View style={styles.playerPlaceholder}>
            <ActivityIndicator color="#93C5FD" size="large" />
            <Text style={styles.playerPlaceholderText}>Loading stream…</Text>
          </View>
        )}
        {!drmLoading && drmError && (
          <View style={styles.playerPlaceholder}>
            <Text style={styles.playerError}>⚠️ {drmError}</Text>
          </View>
        )}
        {!drmLoading && !drmError && shakaHtml && (
          <WebView
            style={styles.webview}
            originWhitelist={['*']}
            source={{ html: shakaHtml }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'error') console.warn('[Shaka]', msg.msg);
              } catch { }
            }}
          />
        )}
      </View>

      {/* ── Now playing strip ── */}
      <View style={styles.nowPlaying}>
        <View style={styles.liveDot} />
        <Text style={styles.nowText}>NOW: {channel.currentProgram}</Text>
        <Text style={styles.nextText}>  |  NEXT: {channel.nextProgram}</Text>
      </View>

      {isReadOnly && (
        <View style={styles.readOnlyBar}>
          <Text style={styles.readOnlyText}>👁 View-only mode — admin/staff cannot send messages</Text>
        </View>
      )}

      {/* ── Chat ── */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
              blurOnSubmit={false}
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
  safe: { flex: 1, backgroundColor: '#0F172A' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E3A8A', paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: { paddingRight: 10 },
  backText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  headerInfo: { flex: 1 },
  channelName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  program: { color: '#93C5FD', fontSize: 12, marginTop: 1 },
  viewerBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  viewerCount: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Player
  playerContainer: {
    width: SCREEN_WIDTH,
    height: PLAYER_HEIGHT,
    backgroundColor: '#000',
  },
  webview: { flex: 1, backgroundColor: '#000' },
  playerPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  playerPlaceholderText: { color: '#93C5FD', fontSize: 13 },
  playerError: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },

  // Now playing bar
  nowPlaying: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F172A', paddingHorizontal: 14, paddingVertical: 8,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 },
  nowText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  nextText: { color: '#94A3B8', fontSize: 12 },

  // Read-only bar
  readOnlyBar: { backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 7 },
  readOnlyText: { color: '#92400E', fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Chat
  chatContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  messageList: { padding: 12, gap: 8 },
  msgRow: { alignItems: 'flex-start', maxWidth: '80%' },
  msgRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgUser: { fontSize: 11, color: '#6B7280', marginBottom: 2, marginLeft: 4 },
  msgBubble: {
    backgroundColor: '#FFF', borderRadius: 14, borderBottomLeftRadius: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  msgBubbleMe: { backgroundColor: '#1E3A8A', borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  msgText: { fontSize: 14, color: '#1F2937', lineHeight: 19 },
  msgTextMe: { color: '#FFF' },
  chatEmpty: { flex: 1, alignItems: 'center', paddingTop: 40 },
  chatEmptyText: { color: '#9CA3AF', fontSize: 14 },
  inputRow: {
    flexDirection: 'row', padding: 10,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8,
  },
  chatInput: {
    flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 14,
    color: '#1F2937', backgroundColor: '#F9FAFB',
  },
  sendBtn: { backgroundColor: '#1E3A8A', borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.45 },
  sendText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
