import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  function formatExpiry(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  const isExpired = user?.expiryDate && new Date() > new Date(user.expiryDate);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, user?.role === 'admin' && styles.avatarAdmin]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <View style={[styles.roleBadge, user?.role === 'admin' && styles.roleBadgeAdmin]}>
          <Text style={styles.roleText}>{user?.role === 'admin' ? '⚙️ Admin' : '👤 Guest'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <InfoRow label="Username" value={user?.username} />
        {user?.role === 'guest' && <InfoRow label="Room Number" value={user?.room} />}
        {user?.role === 'guest' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Access Expiry</Text>
            <Text style={[styles.infoValue, isExpired && styles.expiredText]}>
              {formatExpiry(user?.expiryDate) || 'No expiry set'}
              {isExpired ? ' (Expired)' : ''}
            </Text>
          </View>
        )}
        {user?.role === 'admin' && <InfoRow label="Role" value="Administrator" />}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 20, fontWeight: '700', color: '#1E3A8A' },
  avatarContainer: { alignItems: 'center', paddingVertical: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1E3A8A', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarAdmin: { backgroundColor: '#F59E0B' },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  roleBadge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  roleBadgeAdmin: { backgroundColor: '#FFFBEB' },
  roleText: { fontSize: 13, fontWeight: '600', color: '#1E3A8A' },
  card: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#1F2937', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  expiredText: { color: '#DC2626' },
  logoutBtn: { marginHorizontal: 16, marginTop: 24, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
});
