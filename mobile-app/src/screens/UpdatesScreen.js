import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { useNotifications } from '../context/NotificationContext';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_COLORS = {
  broadcast: '#1E3A8A',
  general: '#059669',
  emergency: '#DC2626',
  maintenance: '#D97706',
  menu_update: '#7C3AED',
  service_reply: '#0891B2',
  post_reply: '#DB2777',
  comment_reply: '#DB2777',
  event: '#059669',
};

export default function NotificationsScreen({ navigation }) {
  const { clearBadge } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchAndMarkRead() {
    try {
      const { data } = await api.get('/notifications');
      // Show unread state briefly before marking all read
      setNotifications(data);
      // Facebook-style: auto mark all as read the moment the screen is opened
      await api.put('/notifications/read-all');
      // Update local state to reflect read status
      setNotifications(data.map(n => ({ ...n, read: true })));
      clearBadge();
    } catch (e) {
      console.error('Fetch notifications error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Trigger ONLY when screen is focused (not on app launch)
  useFocusEffect(useCallback(() => { fetchAndMarkRead(); }, []));

  function handleNotificationPress(item) {
    const type = item.type;
    const refId = item.referenceId;

    if ((type === 'post_like' || type === 'post_comment' || type === 'like' || type === 'comment') && refId) {
      // Navigate to Community tab, passing the post ID to open
      navigation.navigate('Community', { openPostId: refId });
    } else if (type === 'service_reply' && refId) {
      // Navigate to Home tab, passing request ID to highlight
      navigation.navigate('Home', { openRequestId: refId });
    }
    // Broadcast / general / emergency — no navigation needed
  }

  function renderItem({ item }) {
    const meta = TYPE_META[item.type] || { color: '#6B7280', bg: '#F9FAFB', icon: '🔔', label: 'INFO' };
    const isNavigable = ['post_like', 'post_comment', 'like', 'comment', 'service_reply'].includes(item.type) && item.referenceId;

    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={isNavigable ? 0.7 : 1}
      >
        <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
          <Text style={styles.iconText}>{meta.icon}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={[styles.typeBadge, { backgroundColor: meta.color }]}>
              <Text style={styles.typeText}>{meta.label}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
            {isNavigable && <Text style={styles.tapHint}>Tap to view →</Text>}
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1E3A8A" /></View>;
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount} new</Text>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAndMarkRead(); }}
            colors={['#1E3A8A']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1E3A8A', flex: 1 },
  badge: { backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: '#1E3A8A', backgroundColor: '#FAFBFF' },
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  iconText: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  typeBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typeText: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1E3A8A' },
  tapHint: { fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' },
  message: { fontSize: 14, color: '#1F2937', lineHeight: 20, fontWeight: '500' },
  time: { fontSize: 12, color: '#9CA3AF', marginTop: 5 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
});
