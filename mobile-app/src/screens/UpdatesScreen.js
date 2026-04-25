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
};

export default function UpdatesScreen() {
  const { clearBadge, refresh: refreshBadge } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchNotifications() {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
      clearBadge();
    } catch (e) {
      console.error('Fetch notifications error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchNotifications(); }, []));

  async function markRead(id) {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch {}
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  function renderItem({ item }) {
    const color = TYPE_COLORS[item.type] || '#6B7280';
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.75}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.typeBadge, { backgroundColor: color }]}>
            <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1E3A8A" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Updates</Text>
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
            onRefresh={() => { setRefreshing(true); fetchNotifications(); }}
            colors={['#1E3A8A']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 20, fontWeight: '700', color: '#1E3A8A', flex: 1 },
  badge: { backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  list: { padding: 12, gap: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, flexDirection: 'row', alignItems: 'flex-start' },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: '#1E3A8A' },
  cardLeft: { flex: 1 },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  typeText: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  message: { fontSize: 14, color: '#1F2937', lineHeight: 20, fontWeight: '500' },
  time: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1E3A8A', marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
});
