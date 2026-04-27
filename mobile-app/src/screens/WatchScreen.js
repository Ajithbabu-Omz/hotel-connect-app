import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

function formatRemaining(startMs, durationMs) {
  if (!startMs || !durationMs) return null;
  const endMs = startMs + durationMs;
  const remainingMs = endMs - Date.now();
  if (remainingMs <= 0) return null;
  const mins = Math.ceil(remainingMs / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m left` : `${hrs}h left`;
}

function LiveDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

export default function WatchScreen({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'staff';
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchChannels() {
    try {
      const { data } = await api.get('/channels');
      setChannels(data.channels || []);
    } catch (e) {
      console.error('Fetch channels error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => {
    fetchChannels();
    const interval = setInterval(fetchChannels, 30000);
    return () => clearInterval(interval);
  }, []));

  function handleJoin(channel) {
    navigation.navigate('WatchSession', { channel, readOnly: isAdmin });
  }

  function renderChannel({ item }) {
    const now = Date.now();
    let progress = 0;
    const hasProgress = item.currentProgramStart && item.currentProgramDuration;
    if (hasProgress) {
      progress = Math.min(1, Math.max(0, (now - item.currentProgramStart) / item.currentProgramDuration));
    }
    const remaining = hasProgress ? formatRemaining(item.currentProgramStart, item.currentProgramDuration) : null;
    const progressPct = Math.round(progress * 100);

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleJoin(item)} activeOpacity={0.85}>
        {/* Card top row */}
        <View style={styles.cardHeader}>
          <View style={styles.liveBadge}>
            <LiveDot />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.viewers}>👁 {item.viewers} watching</Text>
        </View>

        {/* Channel name */}
        <Text style={styles.channelName}>{item.name}</Text>

        {/* ON NOW */}
        <View style={styles.programRow}>
          <View style={styles.programLabelWrap}>
            <Text style={styles.onNowLabel}>ON NOW</Text>
          </View>
          <Text style={styles.currentProgram} numberOfLines={1}>{item.currentProgram}</Text>
        </View>

        {/* Progress bar */}
        {hasProgress && (
          <View style={styles.progressSection}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressPct}>{progressPct}%</Text>
              {remaining && <Text style={styles.remainingText}>{remaining}</Text>}
            </View>
          </View>
        )}

        {/* UP NEXT */}
        <View style={styles.nextRow}>
          <Text style={styles.nextLabel}>UP NEXT</Text>
          <Text style={styles.nextProgram} numberOfLines={1}>{item.nextProgram}</Text>
        </View>

        {/* Join button */}
        {isAdmin ? (
          <View style={styles.viewOnlyBadge}>
            <Text style={styles.viewOnlyText}>👁 View Only</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(item)}>
            <Text style={styles.joinText}>💬 Join Chat</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading channels...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Watch Together</Text>
        <Text style={styles.subtitle}>{channels.length} channels live</Text>
      </View>

      <FlatList
        data={channels}
        keyExtractor={item => item.channelId}
        renderItem={renderChannel}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchChannels(); }}
            colors={['#1E3A8A']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📺</Text>
            <Text style={styles.emptyText}>No channels available</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  header: {
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1E3A8A' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  list: { padding: 12, gap: 12 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, gap: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DC2626' },
  liveText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
  viewers: { fontSize: 12, color: '#6B7280' },
  channelName: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  programRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  programLabelWrap: {
    backgroundColor: '#1E3A8A', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  onNowLabel: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  currentProgram: { fontSize: 14, color: '#1F2937', fontWeight: '600', flex: 1 },
  progressSection: { marginBottom: 10 },
  progressBg: {
    height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 4,
  },
  progressFill: { height: 5, backgroundColor: '#1E3A8A', borderRadius: 3 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPct: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  remainingText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  nextLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.8 },
  nextProgram: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  joinBtn: {
    backgroundColor: '#1E3A8A', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  joinText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  viewOnlyBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  viewOnlyText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
});
