import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, FlatList, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// ─── GUEST HOME ───────────────────────────────────────────────────────────────

function GuestHome({ user }) {
  const [menu, setMenu] = useState(null);
  const [events, setEvents] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [requestModal, setRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('');
  const [requestDesc, setRequestDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      const [menuRes, eventsRes, reqRes] = await Promise.all([
        api.get('/menu'),
        api.get('/events'),
        api.get('/my-requests'),
      ]);
      setMenu(menuRes.data);
      setEvents(eventsRes.data.slice(0, 3));
      setMyRequests(reqRes.data);
    } catch {}
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  function openRequest(type) {
    setRequestType(type);
    setRequestDesc('');
    setRequestModal(true);
  }

  async function submitRequest() {
    setSubmitting(true);
    try {
      await api.post('/service-request', { type: requestType, description: requestDesc });
      Alert.alert('Request Sent', `Your ${requestType} request has been submitted.`);
      setRequestModal(false);
      const { data } = await api.get('/my-requests');
      setMyRequests(data);
    } catch {
      Alert.alert('Error', 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  const STATUS_COLORS = { pending: '#FEF3C7', done: '#D1FAE5', rejected: '#FEE2E2' };
  const STATUS_TEXT = { pending: '#92400E', done: '#065F46', rejected: '#991B1B' };

  const AMENITIES = ['🏊 Pool', '💪 Gym', '🧺 Laundry', '☕ Café', '📚 Library', '🅿️ Parking'];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={['#1E3A8A']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.guestHeader}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
            <Text style={styles.roomTag}>Room {user?.room}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Active</Text>
          </View>
        </View>

        {/* Help Hub */}
        <View style={styles.section}>
          <SectionTitle>Help Hub</SectionTitle>
          <View style={styles.helpRow}>
            {[
              { type: 'cleaning', label: 'Cleaning', icon: '🧹' },
              { type: 'food', label: 'Food', icon: '🍽' },
              { type: 'maintenance', label: 'Maintenance', icon: '🔧' },
            ].map(item => (
              <TouchableOpacity key={item.type} style={styles.helpCard} onPress={() => openRequest(item.type)}>
                <Text style={styles.helpIcon}>{item.icon}</Text>
                <Text style={styles.helpLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* My Requests */}
        {myRequests.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>My Requests</SectionTitle>
            {myRequests.slice(0, 5).map(req => (
              <View key={req.id} style={styles.myReqCard}>
                <View style={styles.myReqLeft}>
                  <Text style={styles.myReqType}>{req.type.charAt(0).toUpperCase() + req.type.slice(1)}</Text>
                  {req.description ? <Text style={styles.myReqDesc} numberOfLines={1}>{req.description}</Text> : null}
                  <Text style={styles.myReqTime}>{formatDate(req.createdAt)}</Text>
                </View>
                <View style={[styles.myReqBadge, { backgroundColor: STATUS_COLORS[req.status] || '#F3F4F6' }]}>
                  <Text style={[styles.myReqBadgeText, { color: STATUS_TEXT[req.status] || '#374151' }]}>
                    {req.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Today's Menu */}
        <View style={styles.section}>
          <SectionTitle>Today's Menu</SectionTitle>
          {menu ? (
            <View style={styles.menuCard}>
              {[
                { label: '🌅 Breakfast', value: menu.breakfast },
                { label: '☀️ Lunch', value: menu.lunch },
                { label: '🌙 Dinner', value: menu.dinner },
              ].map(m => (
                <View key={m.label} style={styles.menuRow}>
                  <Text style={styles.mealLabel}>{m.label}</Text>
                  <Text style={styles.mealValue}>{m.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.card}><ActivityIndicator color="#1E3A8A" /></View>
          )}
        </View>

        {/* Events */}
        <View style={styles.section}>
          <SectionTitle>Upcoming Events</SectionTitle>
          {events.length === 0 ? (
            <View style={styles.card}><Text style={styles.emptyText}>No upcoming events</Text></View>
          ) : (
            events.map(ev => (
              <View key={ev.id} style={styles.eventCard}>
                <View style={styles.eventDateBox}>
                  <Text style={styles.eventDateText}>{new Date(ev.date).getDate()}</Text>
                  <Text style={styles.eventMonthText}>{new Date(ev.date).toLocaleString('en-US', { month: 'short' })}</Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  {ev.location ? <Text style={styles.eventLocation}>📍 {ev.location}</Text> : null}
                  {ev.description ? <Text style={styles.eventDesc} numberOfLines={1}>{ev.description}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Amenities */}
        <View style={styles.section}>
          <SectionTitle>Amenities</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.amenitiesRow}>
              {AMENITIES.map(a => (
                <View key={a} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>{a}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Highlights */}
        <View style={[styles.section, { marginBottom: 24 }]}>
          <SectionTitle>Highlights</SectionTitle>
          <View style={styles.highlightCard}>
            <Text style={styles.highlightIcon}>🎉</Text>
            <View>
              <Text style={styles.highlightTitle}>Community Night Every Friday</Text>
              <Text style={styles.highlightSub}>Join neighbors for games & fun</Text>
            </View>
          </View>
          <View style={styles.highlightCard}>
            <Text style={styles.highlightIcon}>📶</Text>
            <View>
              <Text style={styles.highlightTitle}>Free High-Speed WiFi</Text>
              <Text style={styles.highlightSub}>Available in all common areas</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Service Request Modal */}
      <Modal visible={requestModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setRequestModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Request {requestType.charAt(0).toUpperCase() + requestType.slice(1)}</Text>
            <View style={{ width: 60 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1, padding: 16 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.textArea]}
              value={requestDesc}
              onChangeText={setRequestDesc}
              placeholder="Describe your request..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={submitRequest}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── ADMIN HOME ───────────────────────────────────────────────────────────────

function AdminHome() {
  const [view, setView] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [menu, setMenu] = useState({ breakfast: '', lunch: '', dinner: '' });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create user form
  const [createUserModal, setCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', roomNumber: '' });
  const [createExpiryDate, setCreateExpiryDate] = useState(null);
  const [showCreatePicker, setShowCreatePicker] = useState(false);

  // Edit user form
  const [editUserModal, setEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', password: '', roomNumber: '' });
  const [editExpiryDate, setEditExpiryDate] = useState(null);
  const [showEditPicker, setShowEditPicker] = useState(false);

  // Broadcast form
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastType, setBroadcastType] = useState('broadcast');
  const [broadcasting, setBroadcasting] = useState(false);

  // Event form
  const [createEventModal, setCreateEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '', location: '' });

  async function fetchAll() {
    setLoading(true);
    try {
      const [usersRes, requestsRes, menuRes, eventsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/service-requests'),
        api.get('/menu'),
        api.get('/events'),
      ]);
      setUsers(usersRes.data);
      setRequests(requestsRes.data);
      setMenu(menuRes.data);
      setEvents(eventsRes.data);
    } catch (e) {
      console.error('Admin fetch error', e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function handleDeleteUser(id) {
    Alert.alert('Delete User', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/admin/users/${id}`);
            setUsers(prev => prev.filter(u => u.id !== id));
          } catch { Alert.alert('Error', 'Failed to delete user'); }
        }
      },
    ]);
  }

  function openEditUser(u) {
    setEditingUser(u);
    setEditUserForm({ name: u.name || '', password: '', roomNumber: u.room || '' });
    setEditExpiryDate(u.expiryDate ? new Date(u.expiryDate) : null);
    setEditUserModal(true);
  }

  async function handleCreateUser() {
    if (!newUser.username || !newUser.password || !newUser.roomNumber) {
      Alert.alert('Error', 'Username, password, and room number are required');
      return;
    }
    try {
      const { data } = await api.post('/admin/create-user', {
        ...newUser,
        expiryDate: createExpiryDate ? createExpiryDate.toISOString() : '',
      });
      setUsers(prev => [...prev, data.user]);
      setCreateUserModal(false);
      setNewUser({ username: '', password: '', name: '', roomNumber: '' });
      setCreateExpiryDate(null);
      Alert.alert('Success', 'User created successfully');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to create user');
    }
  }

  async function handleEditUser() {
    if (!editingUser) return;
    try {
      const payload = {
        name: editUserForm.name,
        roomNumber: editUserForm.roomNumber,
        expiryDate: editExpiryDate ? editExpiryDate.toISOString() : null,
      };
      if (editUserForm.password) payload.password = editUserForm.password;
      const { data } = await api.put(`/admin/users/${editingUser.id}`, payload);
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...data.user } : u));
      setEditUserModal(false);
      Alert.alert('Success', 'User updated');
    } catch {
      Alert.alert('Error', 'Failed to update user');
    }
  }

  async function handleUpdateMenu() {
    try {
      await api.post('/admin/menu', menu);
      Alert.alert('Success', 'Menu updated');
    } catch {
      Alert.alert('Error', 'Failed to update menu');
    }
  }

  async function handleBroadcast() {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      await api.post('/admin/broadcast', { message: broadcastMsg, type: broadcastType });
      Alert.alert('Sent', 'Notification broadcast to all users');
      setBroadcastMsg('');
    } catch {
      Alert.alert('Error', 'Failed to broadcast');
    } finally {
      setBroadcasting(false);
    }
  }

  async function handleCreateEvent() {
    if (!newEvent.title || !newEvent.date) {
      Alert.alert('Error', 'Title and date are required');
      return;
    }
    try {
      const { data } = await api.post('/admin/events', newEvent);
      setEvents(prev => [...prev, data.event]);
      setCreateEventModal(false);
      setNewEvent({ title: '', description: '', date: '', location: '' });
    } catch { Alert.alert('Error', 'Failed to create event'); }
  }

  async function handleDeleteEvent(id) {
    Alert.alert('Delete Event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/admin/events/${id}`);
            setEvents(prev => prev.filter(e => e.id !== id));
          } catch {}
        }
      },
    ]);
  }

  async function handleUpdateRequestStatus(id, status) {
    try {
      await api.put(`/admin/service-requests/${id}`, { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch {}
  }

  const DASH_ITEMS = [
    { key: 'users', label: 'Users', icon: '👥', count: users.length },
    { key: 'requests', label: 'Requests', icon: '🔧', count: requests.filter(r => r.status === 'pending').length },
    { key: 'menu', label: 'Menu', icon: '🍽', count: null },
    { key: 'broadcast', label: 'Broadcast', icon: '📢', count: null },
    { key: 'events', label: 'Events', icon: '📅', count: events.length },
  ];

  if (loading && view === 'dashboard') {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1E3A8A" /></View>;
  }

  // Sub-views
  if (view !== 'dashboard') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setView('dashboard')}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.subTitle}>
            {view === 'users' ? 'Manage Users' : view === 'requests' ? 'Service Requests' : view === 'menu' ? 'Update Menu' : view === 'broadcast' ? 'Broadcast' : 'Events'}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* USERS VIEW */}
        {view === 'users' && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setCreateUserModal(true)}>
              <Text style={styles.addBtnText}>+ Create Guest User</Text>
            </TouchableOpacity>
            <FlatList
              data={users}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 12, gap: 10 }}
              renderItem={({ item }) => (
                <View style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userSub}>@{item.username} · Room {item.room}</Text>
                    {item.expiryDate && <Text style={styles.userExpiry}>Expires: {formatDate(item.expiryDate)}</Text>}
                  </View>
                  <View style={styles.userCardBtns}>
                    <TouchableOpacity onPress={() => openEditUser(item)} style={styles.editUserBtn}>
                      <Text style={styles.editUserText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteUser(item.id)} style={styles.deleteUserBtn}>
                      <Text style={styles.deleteUserText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No guest users yet</Text>}
            />
          </View>
        )}

        {/* REQUESTS VIEW */}
        {view === 'requests' && (
          <FlatList
            data={requests}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 12, gap: 10 }}
            renderItem={({ item }) => (
              <View style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestType}>{item.type.toUpperCase()}</Text>
                  <Text style={styles.requestUser}>{item.username} · Room {item.room}</Text>
                  {item.description ? <Text style={styles.requestDesc}>{item.description}</Text> : null}
                  <View style={[styles.statusBadgeSmall, item.status === 'pending' && styles.statusPending, item.status === 'done' && styles.statusDone]}>
                    <Text style={styles.statusSmallText}>{item.status}</Text>
                  </View>
                </View>
                {item.status === 'pending' && (
                  <TouchableOpacity onPress={() => handleUpdateRequestStatus(item.id, 'done')} style={styles.markDoneBtn}>
                    <Text style={styles.markDoneText}>✓ Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No service requests</Text>}
          />
        )}

        {/* MENU VIEW */}
        {view === 'menu' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {['breakfast', 'lunch', 'dinner'].map(meal => (
              <View key={meal}>
                <Text style={styles.inputLabel}>{meal.charAt(0).toUpperCase() + meal.slice(1)}</Text>
                <TextInput
                  style={styles.input}
                  value={menu[meal]}
                  onChangeText={v => setMenu(prev => ({ ...prev, [meal]: v }))}
                  placeholder={`Enter ${meal} items`}
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </View>
            ))}
            <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateMenu}>
              <Text style={styles.submitBtnText}>Save Menu</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* BROADCAST VIEW */}
        {view === 'broadcast' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.textArea]}
              value={broadcastMsg}
              onChangeText={setBroadcastMsg}
              placeholder='e.g. "Breakfast is ready" or "Maintenance at 5 PM"'
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />
            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeRow}>
              {['broadcast', 'general', 'maintenance', 'emergency'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, broadcastType === t && styles.typeChipActive]}
                  onPress={() => setBroadcastType(t)}
                >
                  <Text style={[styles.typeChipText, broadcastType === t && styles.typeChipTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, (broadcasting || !broadcastMsg.trim()) && { opacity: 0.6 }]}
              onPress={handleBroadcast}
              disabled={broadcasting || !broadcastMsg.trim()}
            >
              {broadcasting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>📢 Send Broadcast</Text>}
            </TouchableOpacity>

            <View style={styles.quickMsgSection}>
              <Text style={styles.inputLabel}>Quick Messages</Text>
              {[
                'Breakfast is ready 🍳',
                'Lunch is ready 🍽',
                'Dinner is ready 🌙',
                'Pool maintenance today ⚠️',
                'Maintenance at 5 PM 🔧',
                'WiFi maintenance in 10 mins 📶',
              ].map(msg => (
                <TouchableOpacity key={msg} style={styles.quickMsgBtn} onPress={() => setBroadcastMsg(msg)}>
                  <Text style={styles.quickMsgText}>{msg}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* EVENTS VIEW */}
        {view === 'events' && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setCreateEventModal(true)}>
              <Text style={styles.addBtnText}>+ Create Event</Text>
            </TouchableOpacity>
            <FlatList
              data={events}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 12, gap: 10 }}
              renderItem={({ item }) => (
                <View style={styles.eventCardAdmin}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <Text style={styles.eventLocation}>📅 {formatDate(item.date)}</Text>
                    {item.location ? <Text style={styles.eventLocation}>📍 {item.location}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteEvent(item.id)} style={styles.deleteUserBtn}>
                    <Text style={styles.deleteUserText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No events yet</Text>}
            />
          </View>
        )}

        {/* Create User Modal */}
        <Modal visible={createUserModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCreateUserModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Create Guest User</Text>
              <TouchableOpacity onPress={handleCreateUser}>
                <Text style={styles.modalPost}>Create</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {[
                { key: 'name', label: 'Full Name', placeholder: 'Guest Name' },
                { key: 'username', label: 'Username *', placeholder: 'username' },
                { key: 'password', label: 'Password *', placeholder: '••••••', secure: true },
                { key: 'roomNumber', label: 'Room Number *', placeholder: '101' },
              ].map(field => (
                <View key={field.key}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={newUser[field.key]}
                    onChangeText={v => setNewUser(prev => ({ ...prev, [field.key]: v }))}
                    placeholder={field.placeholder}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={field.secure}
                    autoCapitalize="none"
                  />
                </View>
              ))}
              <View>
                <Text style={styles.inputLabel}>Expiry Date</Text>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowCreatePicker(true)}>
                  <Text style={createExpiryDate ? styles.datePickerValue : styles.datePickerPlaceholder}>
                    {createExpiryDate ? createExpiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Select expiry date'}
                  </Text>
                  <Text style={styles.datePickerIcon}>📅</Text>
                </TouchableOpacity>
                {showCreatePicker && (
                  <DateTimePicker
                    value={createExpiryDate || new Date()}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(_, date) => { setShowCreatePicker(false); if (date) setCreateExpiryDate(date); }}
                  />
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Edit User Modal */}
        <Modal visible={editUserModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditUserModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Guest</Text>
              <TouchableOpacity onPress={handleEditUser}>
                <Text style={styles.modalPost}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {[
                { key: 'name', label: 'Full Name', placeholder: 'Guest Name' },
                { key: 'password', label: 'New Password (leave blank to keep)', placeholder: '••••••', secure: true },
                { key: 'roomNumber', label: 'Room Number', placeholder: '101' },
              ].map(field => (
                <View key={field.key}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={editUserForm[field.key]}
                    onChangeText={v => setEditUserForm(prev => ({ ...prev, [field.key]: v }))}
                    placeholder={field.placeholder}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={field.secure}
                    autoCapitalize="none"
                  />
                </View>
              ))}
              <View>
                <Text style={styles.inputLabel}>Expiry Date</Text>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEditPicker(true)}>
                  <Text style={editExpiryDate ? styles.datePickerValue : styles.datePickerPlaceholder}>
                    {editExpiryDate ? editExpiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No expiry set'}
                  </Text>
                  <Text style={styles.datePickerIcon}>📅</Text>
                </TouchableOpacity>
                {showEditPicker && (
                  <DateTimePicker
                    value={editExpiryDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(_, date) => { setShowEditPicker(false); if (date) setEditExpiryDate(date); }}
                  />
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Create Event Modal */}
        <Modal visible={createEventModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCreateEventModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Create Event</Text>
              <TouchableOpacity onPress={handleCreateEvent}>
                <Text style={styles.modalPost}>Create</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {[
                { key: 'title', label: 'Title *', placeholder: 'Event title' },
                { key: 'date', label: 'Date * (YYYY-MM-DD)', placeholder: '2025-12-25' },
                { key: 'location', label: 'Location', placeholder: 'Common Room' },
                { key: 'description', label: 'Description', placeholder: 'About this event...' },
              ].map(field => (
                <View key={field.key}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={newEvent[field.key]}
                    onChangeText={v => setNewEvent(prev => ({ ...prev, [field.key]: v }))}
                    placeholder={field.placeholder}
                    placeholderTextColor="#9CA3AF"
                    multiline={field.key === 'description'}
                  />
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // DASHBOARD
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.adminHeader}>
          <Text style={styles.adminGreeting}>Admin Dashboard</Text>
          <Text style={styles.adminSub}>Community Management</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{users.length}</Text>
            <Text style={styles.statLabel}>Guests</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#F59E0B' }]}>{requests.filter(r => r.status === 'pending').length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#10B981' }]}>{events.length}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <SectionTitle>Quick Actions</SectionTitle>
          <View style={styles.dashGrid}>
            {DASH_ITEMS.map(item => (
              <TouchableOpacity key={item.key} style={styles.dashCard} onPress={() => setView(item.key)}>
                <Text style={styles.dashIcon}>{item.icon}</Text>
                <Text style={styles.dashLabel}>{item.label}</Text>
                {item.count !== null && (
                  <View style={styles.dashBadge}>
                    <Text style={styles.dashBadgeText}>{item.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Requests */}
        <View style={[styles.section, { marginBottom: 24 }]}>
          <SectionTitle>Recent Requests</SectionTitle>
          {requests.slice(0, 3).length === 0 ? (
            <View style={styles.card}><Text style={styles.emptyText}>No service requests</Text></View>
          ) : (
            requests.slice(0, 3).map(req => (
              <View key={req.id} style={styles.recentReqCard}>
                <Text style={styles.reqType}>{req.type}</Text>
                <Text style={styles.reqUser}>{req.username} · Room {req.room}</Text>
                <View style={[styles.statusBadgeSmall, req.status === 'pending' ? styles.statusPending : styles.statusDone]}>
                  <Text style={styles.statusSmallText}>{req.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminHome />;
  return <GuestHome user={user} />;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Guest header
  guestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E3A8A', padding: 20, paddingTop: 8 },
  greeting: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  roomTag: { color: '#93C5FD', fontSize: 14, marginTop: 2 },
  statusBadge: { backgroundColor: '#10B981', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // Admin header
  adminHeader: { backgroundColor: '#1E3A8A', padding: 20, paddingTop: 8, paddingBottom: 24 },
  adminGreeting: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  adminSub: { color: '#93C5FD', fontSize: 14, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -12 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  statNum: { fontSize: 24, fontWeight: '700', color: '#1E3A8A' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '500' },

  // Dashboard grid
  dashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dashCard: { width: '47%', backgroundColor: '#FFF', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, position: 'relative' },
  dashIcon: { fontSize: 30, marginBottom: 6 },
  dashLabel: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  dashBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#F59E0B', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dashBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 10 },

  // Help Hub
  helpRow: { flexDirection: 'row', gap: 10 },
  helpCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  helpIcon: { fontSize: 28, marginBottom: 6 },
  helpLabel: { fontSize: 13, fontWeight: '600', color: '#1F2937' },

  // Menu card
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  menuCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2, gap: 12 },
  menuRow: { gap: 2 },
  mealLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  mealValue: { fontSize: 14, color: '#1F2937' },

  // Events
  eventCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  eventDateBox: { backgroundColor: '#1E3A8A', borderRadius: 8, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  eventDateText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  eventMonthText: { color: '#93C5FD', fontSize: 10, fontWeight: '600' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  eventLocation: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  eventDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Amenities
  amenitiesRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  amenityChip: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  amenityText: { fontSize: 13, color: '#1E3A8A', fontWeight: '600' },

  // Highlights
  highlightCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2, gap: 12 },
  highlightIcon: { fontSize: 28 },
  highlightTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  highlightSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },

  // Sub-header (admin views)
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { fontSize: 14, color: '#1E3A8A', fontWeight: '600' },
  subTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  // User cards
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  userSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  userExpiry: { fontSize: 11, color: '#F59E0B', marginTop: 2 },
  userCardBtns: { flexDirection: 'row', gap: 8 },
  editUserBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  editUserText: { color: '#1E3A8A', fontSize: 12, fontWeight: '600' },
  deleteUserBtn: { backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  deleteUserText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },

  // Date picker
  datePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: '#F9FAFB' },
  datePickerValue: { fontSize: 14, color: '#1F2937' },
  datePickerPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  datePickerIcon: { fontSize: 16 },

  // My Requests (guest)
  myReqCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  myReqLeft: { flex: 1 },
  myReqType: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  myReqDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  myReqTime: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  myReqBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  myReqBadgeText: { fontSize: 12, fontWeight: '700' },

  // Request cards
  requestCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  requestInfo: { flex: 1 },
  requestType: { fontSize: 13, fontWeight: '700', color: '#1E3A8A', marginBottom: 2 },
  requestUser: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  requestDesc: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  statusBadgeSmall: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusDone: { backgroundColor: '#D1FAE5' },
  statusSmallText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  markDoneBtn: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  markDoneText: { color: '#059669', fontSize: 12, fontWeight: '700' },

  // Recent request card (dashboard)
  recentReqCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  reqType: { fontSize: 13, fontWeight: '700', color: '#1F2937', textTransform: 'capitalize' },
  reqUser: { fontSize: 12, color: '#6B7280', marginTop: 1, marginBottom: 4 },

  // Event card (admin list)
  eventCardAdmin: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },

  // Form inputs
  addBtn: { backgroundColor: '#1E3A8A', margin: 12, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#1F2937', backgroundColor: '#F9FAFB' },
  textArea: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#1F2937', backgroundColor: '#F9FAFB', minHeight: 90, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#1E3A8A', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Broadcast
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  typeChipActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  typeChipText: { fontSize: 13, color: '#6B7280' },
  typeChipTextActive: { color: '#FFF', fontWeight: '600' },
  quickMsgSection: { marginTop: 8 },
  quickMsgBtn: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 11, marginBottom: 8 },
  quickMsgText: { fontSize: 13, color: '#374151' },

  // Modal
  modalSafe: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalCancel: { fontSize: 15, color: '#6B7280' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalPost: { fontSize: 15, color: '#1E3A8A', fontWeight: '700' },

  emptyText: { color: '#9CA3AF', textAlign: 'center', padding: 16, fontSize: 14 },
});
