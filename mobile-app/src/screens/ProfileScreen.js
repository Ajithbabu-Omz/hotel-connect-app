import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

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
  const { user, logout, updateUser } = useAuth();
  const [editNameModal, setEditNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  function openEditName() {
    setNewName(user?.displayName || '');
    setEditNameModal(true);
  }

  async function handleSaveName() {
    if (!newName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await api.put('/me/display-name', { displayName: newName.trim() });
      await updateUser({ displayName: newName.trim() });
      setEditNameModal(false);
      Alert.alert('Updated', 'Your display name has been updated');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update display name');
    } finally {
      setSaving(false);
    }
  }

  const initials = (user?.displayName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  function formatExpiry(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  const isExpired = user?.expiryDate && new Date() > new Date(user.expiryDate);

  const roleLabel = user?.role === 'admin' ? '⚙️ Admin' : user?.role === 'staff' ? '🔑 Staff' : '👤 Guest';
  const avatarColor = user?.role === 'admin' ? '#F59E0B' : user?.role === 'staff' ? '#374151' : '#1E3A8A';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.displayName}</Text>
        <View style={[styles.roleBadge, user?.role === 'admin' && styles.roleBadgeAdmin, user?.role === 'staff' && styles.roleBadgeStaff]}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <InfoRow label="Username" value={user?.username} />
        {user?.role === 'guest' && <InfoRow label="Room Number" value={user?.room} />}
        {user?.role === 'guest' && <InfoRow label="Display Name" value={user?.displayName} />}
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
        {user?.role === 'staff' && (
          <InfoRow label="Permissions" value={user?.canCreateUsers ? 'Can create guest users' : 'Standard staff'} />
        )}
      </View>

      {/* Edit display name button — guests only */}
      {user?.role === 'guest' && (
        <TouchableOpacity style={styles.editNameBtn} onPress={openEditName}>
          <Text style={styles.editNameBtnText}>✏️  Edit Display Name</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Edit Display Name Modal */}
      <Modal visible={editNameModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditNameModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Display Name</Text>
            <TouchableOpacity onPress={handleSaveName} disabled={saving}>
              {saving ? <ActivityIndicator color="#1E3A8A" /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Your display name"
              placeholderTextColor="#9CA3AF"
              autoFocus
              maxLength={50}
            />
            <Text style={styles.hint}>This is the name others see on your posts and messages. Your username and room number cannot be changed.</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 20, fontWeight: '700', color: '#1E3A8A' },
  avatarContainer: { alignItems: 'center', paddingVertical: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  roleBadge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  roleBadgeAdmin: { backgroundColor: '#FFFBEB' },
  roleBadgeStaff: { backgroundColor: '#F3F4F6' },
  roleText: { fontSize: 13, fontWeight: '600', color: '#1E3A8A' },
  card: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#1F2937', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  expiredText: { color: '#DC2626' },
  editNameBtn: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  editNameBtnText: { color: '#1E3A8A', fontSize: 15, fontWeight: '700' },
  logoutBtn: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  modalSafe: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalCancel: { fontSize: 15, color: '#6B7280' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalSave: { fontSize: 15, color: '#1E3A8A', fontWeight: '700' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: '#1F2937', backgroundColor: '#F9FAFB' },
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: 10, lineHeight: 18 },
});
