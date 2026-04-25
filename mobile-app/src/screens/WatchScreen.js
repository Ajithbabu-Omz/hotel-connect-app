import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function WatchScreen({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchChannels() {
    try {
      const { data } = await api.get('/channels');
      setChannels(data);
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
    if (item.currentProgramStart && item.currentProgramDuration) {
      progress = Math.min(1, Math.max(0, (now - item.currentProgramStart) / item.currentProgramDuration));
    }
    const hasProgress = item.currentProgramStart && item.currentProgramDuration;

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleJoin(item)} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.viewers}>👁 {item.viewers} watching</Text>
        </View>

        <Text style={styles.channelName}>{item.name}</Text>
        <Text style={styles.currentProgram}>{item.currentProgram}</Text>

        {hasProgress && (
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}

        <Text style={styles.nextProgram}>Up Next: {item.nextProgram}</Text>

        {isAdmin ? (
          <View style={styles.viewOnlyBadge}>
            <Text style={styles.viewOnlyText}>👁 View Only</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(item)}>
            <Text style={styles.joinText}>Join Chat</Text>
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
        <Text style={styles.title}>Watch</Text>
        <Text style={styles.subtitle}>{channels.length} channels available</Text>
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
  header: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 20, fontWeight: '700', color: '#1E3A8A' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  list: { padding: 12, gap: 12 },
  card: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DC2626', marginRight: 4 },
  liveText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
  viewers: { fontSize: 12, color: '#6B7280' },
  channelName: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  currentProgram: { fontSize: 14, color: '#374151', fontWeight: '500', marginBottom: 8 },
  progressBg: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#1E3A8A', borderRadius: 2 },
  nextProgram: { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },
  joinBtn: { backgroundColor: '#1E3A8A', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  joinText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  viewOnlyBadge: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  viewOnlyText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
});
