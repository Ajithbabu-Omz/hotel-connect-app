import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, FlatList, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const STATUS_COLORS = { open: '#FEF3C7', closed: '#F3F4F6' };
const STATUS_TEXT = { open: '#92400E', closed: '#6B7280' };

// ─── GUEST HOME ────────────────────────────────────────────────────────────────

function GuestHome({ user, navigation }) {
  const [menu, setMenu] = useState(null);
  const [events, setEvents] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [requestModal, setRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('');
  const [requestDesc, setRequestDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      const [menuRes, eventsRes, reqRes, amenRes] = await Promise.all([
        api.get('/menu'),
        api.get('/events'),
        api.get('/my-requests'),
        api.get('/amenities'),
      ]);
      setMenu(menuRes.data);
      setEvents(eventsRes.data.slice(0, 3));
      setMyRequests(reqRes.data);
      setAmenities(amenRes.data);
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
    if (!requestDesc.trim()) {
      Alert.alert('Description required', 'Please describe your request.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/service-request', { type: requestType, description: requestDesc });
      Alert.alert('Request Sent', `Your ${requestType} request has been submitted.`);
      setRequestModal(false);
      const { data } = await api.get('/my-requests');
      setMyRequests(data);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  async function closeRequest(id) {
    Alert.alert('Close Request', 'Are you sure you want to close this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive', onPress: async () => {
          try {
            await api.post(`/service-request/${id}/close`);
            const { data } = await api.get('/my-requests');
            setMyRequests(data);
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.error || 'Failed to close request');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={['#1E3A8A']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.guestHeader}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.displayName?.split(' ')[0]} 👋</Text>
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
              <TouchableOpacity
                key={req.id}
                style={styles.myReqCard}
                onPress={() => navigation.navigate('ServiceRequest', { request: req, isGuest: true })}
              >
                <View style={styles.myReqLeft}>
                  <Text style={styles.myReqType}>{req.type.charAt(0).toUpperCase() + req.type.slice(1)}</Text>
                  {req.messages?.length > 0 && (
                    <Text style={styles.myReqDesc} numberOfLines={1}>
                      {req.messages[req.messages.length - 1].message}
                    </Text>
                  )}
                  <Text style={styles.myReqTime}>{formatDate(req.createdAt)}</Text>
                </View>
                <View style={styles.myReqRight}>
                  <View style={[styles.myReqBadge, { backgroundColor: STATUS_COLORS[req.status] || '#F3F4F6' }]}>
                    <Text style={[styles.myReqBadgeText, { color: STATUS_TEXT[req.status] || '#374151' }]}>
                      {req.status}
                    </Text>
                  </View>
                  {req.status === 'open' && (
                    <TouchableOpacity
                      style={styles.closeSmallBtn}
                      onPress={() => closeRequest(req.id)}
                    >
                      <Text style={styles.closeSmallText}>Close</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
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

        {/* Amenities (from API) */}
        {amenities.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Amenities</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.amenitiesRow}>
                {amenities.map(a => (
                  <View key={a.id} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>{a.icon} {a.name}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={{ height: 24 }} />
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
          <KeyboardAvoidingView style={{ flex: 1, padding: 16 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Text style={styles.inputLabel}>Description *</Text>
            <TextInput
              style={styles.textArea}
              value={requestDesc}
              onChangeText={setRequestDesc}
              placeholder="Describe your request..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              autoFocus
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

// ─── ADMIN / STAFF HOME ────────────────────────────────────────────────────────

function AdminHome({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const canCreateGuests = isAdmin || (isStaff && user?.canCreateUsers);

  const [view, setView] = useState('dashboard');
  const [expandedReqId, setExpandedReqId] = useState(null);
  const [reqActionStatus, setReqActionStatus] = useState({});
  const [reqActionReply, setReqActionReply] = useState({});
  const [reqUpdating, setReqUpdating] = useState({});
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [menu, setMenu] = useState({ breakfast: '', lunch: '', dinner: '' });
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({ auto_close_days: '7' });
  const [loading, setLoading] = useState(false);

  // Create user form
  const [createUserModal, setCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', roomNumber: '' });
  const [makeStaff, setMakeStaff] = useState(false);
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

  // Event form — date/time state pre-filled to now
  const [createEventModal, setCreateEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', location: '' });
  const [eventDate, setEventDate] = useState(new Date());
  const [eventTime, setEventTime] = useState(new Date());
  const [showEventDatePicker, setShowEventDatePicker] = useState(false);
  const [showEventTimePicker, setShowEventTimePicker] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      // Always fetch users — admin needs all for stats; staff with canCreateGuests needs guests
      const calls = [
        api.get('/admin/users'),
        api.get('/admin/service-requests'),
        api.get('/menu'),
        api.get('/events'),
      ];
      if (isAdmin) calls.push(api.get('/admin/settings'));
      const results = await Promise.all(calls);
      setUsers(results[0].data);
      setRequests(results[1].data);
      setMenu(results[2].data || { breakfast: '', lunch: '', dinner: '' });
      setEvents(results[3].data);
      if (isAdmin && results[4]) setSettings(results[4].data);
    } catch (e) {
      console.error('Admin fetch error', e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function handleDeactivateUser(id) {
    Alert.alert('Deactivate User', 'This will deactivate the user and close their open requests.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive', onPress: async () => {
          try {
            await api.put(`/admin/users/${id}`, { isActive: false });
            setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: false } : u));
          } catch { Alert.alert('Error', 'Failed to deactivate user'); }
        },
      },
    ]);
  }

  async function handleReactivateUser(id) {
    try {
      await api.put(`/admin/users/${id}`, { isActive: true });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: true } : u));
    } catch { Alert.alert('Error', 'Failed to reactivate user'); }
  }

  function openEditUser(u) {
    setEditingUser(u);
    setEditUserForm({ name: u.displayName || '', password: '', roomNumber: u.room || '' });
    setEditExpiryDate(u.expiryDate ? new Date(u.expiryDate) : null);
    setEditUserModal(true);
  }

  async function handleCreateUser() {
    if (!newUser.username || !newUser.password) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }
    if (!makeStaff && !newUser.roomNumber) {
      Alert.alert('Error', 'Room number is required for guest users');
      return;
    }
    try {
      const { data } = await api.post('/admin/create-user', {
        ...newUser,
        makeStaff,
        expiryDate: createExpiryDate ? createExpiryDate.toISOString() : '',
      });
      setUsers(prev => [...prev, data.user]);
      setCreateUserModal(false);
      setNewUser({ username: '', password: '', name: '', roomNumber: '' });
      setMakeStaff(false);
      setCreateExpiryDate(null);
      Alert.alert('Success', `${makeStaff ? 'Staff' : 'Guest'} user created successfully`);
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
      await api.put(`/admin/users/${editingUser.id}`, payload);
      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        displayName: editUserForm.name || u.displayName,
        room: editUserForm.roomNumber || u.room,
        expiryDate: editExpiryDate ? editExpiryDate.toISOString() : null,
      } : u));
      setEditUserModal(false);
      Alert.alert('Success', 'User updated');
    } catch {
      Alert.alert('Error', 'Failed to update user');
    }
  }

  async function handleToggleCanCreateUsers(userId, current) {
    try {
      await api.put(`/admin/users/${userId}`, { canCreateUsers: !current });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, canCreateUsers: !current } : u));
    } catch { Alert.alert('Error', 'Failed to update permission'); }
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
    if (!newEvent.title) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    try {
      // Merge date + time into one datetime
      const combined = new Date(eventDate);
      combined.setHours(eventTime.getHours(), eventTime.getMinutes(), 0, 0);
      const { data } = await api.post('/admin/events', {
        ...newEvent,
        date: combined.toISOString(),
      });
      setEvents(prev => [...prev, data.event]);
      setCreateEventModal(false);
      setNewEvent({ title: '', description: '', location: '' });
      setEventDate(new Date());
      setEventTime(new Date());
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
        },
      },
    ]);
  }

  async function handleSaveSettings() {
    const days = parseInt(settings.auto_close_days, 10);
    if (isNaN(days) || days < 1) {
      Alert.alert('Error', 'Must be a positive number of days');
      return;
    }
    try {
      await api.put('/admin/settings', { auto_close_days: days });
      Alert.alert('Saved', `Requests will auto-close after ${days} days`);
    } catch { Alert.alert('Error', 'Failed to save settings'); }
  }

  const dashItems = [
    ...(canCreateGuests ? [{ key: 'users', label: 'Users', icon: '👥', count: users.length }] : []),
    { key: 'menu', label: 'Menu', icon: '🍽', count: null },
    { key: 'broadcast', label: 'Broadcast', icon: '📢', count: null },
    { key: 'events', label: 'Events', icon: '📅', count: events.length },
    ...(isAdmin ? [{ key: 'settings', label: 'Settings', icon: '⚙️', count: null }] : []),
  ];

  if (loading && view === 'dashboard') {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1E3A8A" /></View>;
  }

  // ── Sub-views ──
  if (view !== 'dashboard') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setView('dashboard')}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.subTitle}>
            {{ users: 'Manage Users', requests: 'Service Requests', menu: 'Update Menu', broadcast: 'Broadcast', events: 'Events', settings: 'Settings' }[view]}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* USERS VIEW */}
        {view === 'users' && (
          <View style={{ flex: 1 }}>
            {canCreateGuests && (
              <TouchableOpacity style={styles.addBtn} onPress={() => { setMakeStaff(false); setCreateUserModal(true); }}>
                <Text style={styles.addBtnText}>+ Create Guest User</Text>
              </TouchableOpacity>
            )}
            {isAdmin && (
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#374151', marginTop: 0 }]} onPress={() => { setMakeStaff(true); setCreateUserModal(true); }}>
                <Text style={styles.addBtnText}>+ Create Staff User</Text>
              </TouchableOpacity>
            )}
            <FlatList
              data={users.filter(u => isAdmin ? true : u.role !== 'staff')}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 12, gap: 10 }}
              renderItem={({ item }) => (
                <View style={[styles.userCard, !item.isActive && { opacity: 0.6 }]}>
                  <View style={styles.userInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.userName}>{item.displayName}</Text>
                      {!item.isActive && <Text style={styles.inactiveTag}>(inactive)</Text>}
                      {item.role === 'staff' && <Text style={styles.staffTag}>Staff</Text>}
                    </View>
                    <Text style={styles.userSub}>@{item.username}{item.room ? ` · Room ${item.room}` : ''}</Text>
                    {item.expiryDate && <Text style={styles.userExpiry}>Expires: {formatDate(item.expiryDate)}</Text>}
                    {isAdmin && item.role === 'staff' && (
                      <View style={styles.permRow}>
                        <Text style={styles.permLabel}>Can create guests</Text>
                        <Switch
                          value={item.canCreateUsers}
                          onValueChange={() => handleToggleCanCreateUsers(item.id, item.canCreateUsers)}
                          trackColor={{ true: '#1E3A8A' }}
                          thumbColor="#FFF"
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.userCardBtns}>
                    <TouchableOpacity onPress={() => openEditUser(item)} style={styles.editUserBtn}>
                      <Text style={styles.editUserText}>Edit</Text>
                    </TouchableOpacity>
                    {item.isActive ? (
                      <TouchableOpacity onPress={() => handleDeactivateUser(item.id)} style={styles.deleteUserBtn}>
                        <Text style={styles.deleteUserText}>Deactivate</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => handleReactivateUser(item.id)} style={styles.reactivateBtn}>
                        <Text style={styles.reactivateText}>Activate</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No users yet</Text>}
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
              <TouchableOpacity
                style={styles.requestCard}
                onPress={() => navigation.navigate('ServiceRequest', { request: item, isGuest: false })}
              >
                <View style={styles.requestInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.requestType}>{item.type.toUpperCase()}</Text>
                    <View style={[styles.statusBadgeSmall, item.status === 'open' ? styles.statusOpen : styles.statusClosed]}>
                      <Text style={styles.statusSmallText}>{item.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.requestUser}>
                    {item.userDisplayName}{!item.userIsActive ? ' (inactive)' : ''} · Room {item.userRoom}
                  </Text>
                  {item.lastMessage && (
                    <Text style={styles.requestDesc} numberOfLines={1}>
                      {item.lastMessage.senderDisplayName}: {item.lastMessage.message}
                    </Text>
                  )}
                  <Text style={styles.requestTime}>{formatDate(item.createdAt)} · {item.messageCount} message{item.messageCount !== 1 ? 's' : ''}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No service requests</Text>}
          />
        )}

        {/* MENU VIEW */}
        {view === 'menu' && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
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
          </KeyboardAvoidingView>
        )}

        {/* BROADCAST VIEW */}
        {view === 'broadcast' && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Message</Text>
              <TextInput
                style={styles.textArea}
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
                    <Text style={[styles.typeChipText, broadcastType === t && styles.typeChipTextActive]}>{t}</Text>
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
                  'Breakfast is ready 🍳', 'Lunch is ready 🍽', 'Dinner is ready 🌙',
                  'Pool maintenance today ⚠️', 'Maintenance at 5 PM 🔧', 'WiFi maintenance in 10 mins 📶',
                ].map(msg => (
                  <TouchableOpacity key={msg} style={styles.quickMsgBtn} onPress={() => setBroadcastMsg(msg)}>
                    <Text style={styles.quickMsgText}>{msg}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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

        {/* SETTINGS VIEW (admin only) */}
        {view === 'settings' && isAdmin && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
              <View style={styles.settingCard}>
                <Text style={styles.settingTitle}>Auto-close Service Requests</Text>
                <Text style={styles.settingDesc}>
                  Automatically close open requests where the last reply is from staff/admin, after this many days from creation.
                </Text>
                <Text style={styles.inputLabel}>Days</Text>
                <TextInput
                  style={styles.input}
                  value={String(settings.auto_close_days || '7')}
                  onChangeText={v => setSettings(prev => ({ ...prev, auto_close_days: v }))}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveSettings}>
                <Text style={styles.submitBtnText}>Save Settings</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* Create User Modal */}
        <Modal visible={createUserModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCreateUserModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{makeStaff ? 'Create Staff User' : 'Create Guest User'}</Text>
              <View style={{ width: 60 }} />
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                {[
                  { key: 'name', label: 'Full Name', placeholder: 'Display Name' },
                  { key: 'username', label: 'Username *', placeholder: 'username' },
                  { key: 'password', label: 'Password *', placeholder: '••••••', secure: true },
                  ...(!makeStaff ? [{ key: 'roomNumber', label: 'Room Number *', placeholder: '101' }] : []),
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
                {!makeStaff && (
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
                )}
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateUser}>
                  <Text style={styles.submitBtnText}>Create {makeStaff ? 'Staff' : 'Guest'} User</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Edit User Modal */}
        <Modal visible={editUserModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditUserModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit {editingUser?.role === 'staff' ? 'Staff' : 'Guest'}</Text>
              <View style={{ width: 60 }} />
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                {[
                  { key: 'name', label: 'Display Name', placeholder: 'Name' },
                  { key: 'password', label: 'New Password (leave blank to keep)', placeholder: '••••••', secure: true },
                  ...(editingUser?.role !== 'staff' ? [{ key: 'roomNumber', label: 'Room Number', placeholder: '101' }] : []),
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
                {editingUser?.role !== 'staff' && (
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
                )}
                <TouchableOpacity style={styles.submitBtn} onPress={handleEditUser}>
                  <Text style={styles.submitBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
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
              <View style={{ width: 60 }} />
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
                {/* Title */}
                <View>
                  <Text style={styles.inputLabel}>Title *</Text>
                  <TextInput
                    style={styles.input}
                    value={newEvent.title}
                    onChangeText={v => setNewEvent(prev => ({ ...prev, title: v }))}
                    placeholder="Event title"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Date picker */}
                <View>
                  <Text style={styles.inputLabel}>Date *</Text>
                  <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEventDatePicker(true)}>
                    <Text style={styles.datePickerValue}>
                      {eventDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.datePickerIcon}>📅</Text>
                  </TouchableOpacity>
                  {showEventDatePicker && (
                    <DateTimePicker
                      value={eventDate}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={(_, date) => { setShowEventDatePicker(false); if (date) setEventDate(date); }}
                    />
                  )}
                </View>

                {/* Time picker */}
                <View>
                  <Text style={styles.inputLabel}>Time</Text>
                  <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEventTimePicker(true)}>
                    <Text style={styles.datePickerValue}>
                      {eventTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={styles.datePickerIcon}>🕐</Text>
                  </TouchableOpacity>
                  {showEventTimePicker && (
                    <DateTimePicker
                      value={eventTime}
                      mode="time"
                      display="default"
                      onChange={(_, time) => { setShowEventTimePicker(false); if (time) setEventTime(time); }}
                    />
                  )}
                </View>

                {/* Location */}
                <View>
                  <Text style={styles.inputLabel}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={newEvent.location}
                    onChangeText={v => setNewEvent(prev => ({ ...prev, location: v }))}
                    placeholder="Common Room"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Description */}
                <View>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={styles.input}
                    value={newEvent.description}
                    onChangeText={v => setNewEvent(prev => ({ ...prev, description: v }))}
                    placeholder="About this event..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateEvent}>
                  <Text style={styles.submitBtnText}>Create Event</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Dashboard ──
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.adminHeader}>
          <Text style={styles.adminGreeting}>{isAdmin ? 'Admin' : 'Staff'} Dashboard</Text>
          <Text style={styles.adminSub}>Hotel Management</Text>
        </View>
        <View style={styles.statsRow}>
          {isAdmin ? (
            <>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{users.filter(u => u.role === 'guest' && u.isActive).length}</Text>
                <Text style={styles.statLabel}>Active Guests</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: '#6366F1' }]}>{users.filter(u => u.role === 'staff' && u.isActive).length}</Text>
                <Text style={styles.statLabel}>Staff</Text>
              </View>
            </>
          ) : (
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{users.filter(u => u.role === 'guest' && u.isActive).length}</Text>
              <Text style={styles.statLabel}>Active Guests</Text>
            </View>
          )}
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#F59E0B' }]}>{requests.filter(r => r.status === 'open').length}</Text>
            <Text style={styles.statLabel}>Open Requests</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#10B981' }]}>{events.length}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>
        <View style={styles.section}>
          <SectionTitle>Quick Actions</SectionTitle>
          <View style={styles.dashGrid}>
            {dashItems.map(item => (
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
        <View style={[styles.section, { marginBottom: 24 }]}>
          <SectionTitle>Recent Open Requests</SectionTitle>
          {requests.filter(r => r.status === 'open').slice(0, 3).length === 0 ? (
            <View style={styles.card}><Text style={styles.emptyText}>No open service requests</Text></View>
          ) : (
            requests.filter(r => r.status === 'open').slice(0, 3).map(req => (
              <TouchableOpacity
                key={req.id}
                style={styles.recentReqCard}
                onPress={() => navigation.navigate('ServiceRequest', { request: req, isGuest: false })}
              >
                <Text style={styles.reqType}>{req.type}</Text>
                <Text style={styles.reqUser}>
                  {req.userDisplayName}{!req.userIsActive ? ' (inactive)' : ''} · Room {req.userRoom}
                </Text>
                <View style={[styles.statusBadgeSmall, styles.statusOpen]}>
                  <Text style={styles.statusSmallText}>open</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  if (user?.role === 'admin' || user?.role === 'staff') return <AdminHome navigation={navigation} />;
  return <GuestHome user={user} navigation={navigation} />;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  guestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E3A8A', padding: 20, paddingTop: 8 },
  greeting: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  roomTag: { color: '#93C5FD', fontSize: 14, marginTop: 2 },
  statusBadge: { backgroundColor: '#10B981', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  adminHeader: { backgroundColor: '#1E3A8A', padding: 20, paddingTop: 8, paddingBottom: 24 },
  adminGreeting: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  adminSub: { color: '#93C5FD', fontSize: 14, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -12 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  statNum: { fontSize: 24, fontWeight: '700', color: '#1E3A8A' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '500' },

  dashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dashCard: { width: '47%', backgroundColor: '#FFF', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, position: 'relative' },
  dashIcon: { fontSize: 30, marginBottom: 6 },
  dashLabel: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  dashBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#F59E0B', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dashBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 10 },

  helpRow: { flexDirection: 'row', gap: 10 },
  helpCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  helpIcon: { fontSize: 28, marginBottom: 6 },
  helpLabel: { fontSize: 13, fontWeight: '600', color: '#1F2937' },

  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  menuCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2, gap: 12 },
  menuRow: { gap: 2 },
  mealLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  mealValue: { fontSize: 14, color: '#1F2937' },

  eventCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  eventDateBox: { backgroundColor: '#1E3A8A', borderRadius: 8, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  eventDateText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  eventMonthText: { color: '#93C5FD', fontSize: 10, fontWeight: '600' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  eventLocation: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  eventDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  amenitiesRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  amenityChip: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  amenityText: { fontSize: 13, color: '#1E3A8A', fontWeight: '600' },

  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { fontSize: 14, color: '#1E3A8A', fontWeight: '600' },
  subTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  userCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  userSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  userExpiry: { fontSize: 11, color: '#F59E0B', marginTop: 2 },
  inactiveTag: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },
  staffTag: { backgroundColor: '#374151', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, color: '#FFF', fontSize: 10, fontWeight: '700' },
  userCardBtns: { flexDirection: 'column', gap: 6, alignItems: 'flex-end' },
  editUserBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  editUserText: { color: '#1E3A8A', fontSize: 12, fontWeight: '600' },
  deleteUserBtn: { backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  deleteUserText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  reactivateBtn: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  reactivateText: { color: '#16A34A', fontSize: 12, fontWeight: '600' },

  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  permLabel: { fontSize: 12, color: '#6B7280' },

  datePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: '#F9FAFB' },
  datePickerValue: { fontSize: 14, color: '#1F2937' },
  datePickerPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  datePickerIcon: { fontSize: 16 },

  myReqCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  myReqLeft: { flex: 1 },
  myReqRight: { alignItems: 'flex-end', gap: 4 },
  myReqType: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  myReqDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  myReqTime: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  myReqBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  myReqBadgeText: { fontSize: 12, fontWeight: '700' },
  closeSmallBtn: { backgroundColor: '#FEF2F2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  closeSmallText: { color: '#DC2626', fontSize: 11, fontWeight: '600' },

  requestCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  requestInfo: { flex: 1 },
  requestType: { fontSize: 13, fontWeight: '700', color: '#1E3A8A', marginBottom: 2 },
  requestUser: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  requestDesc: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  requestTime: { fontSize: 11, color: '#9CA3AF' },
  statusBadgeSmall: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusOpen: { backgroundColor: '#FEF3C7' },
  statusClosed: { backgroundColor: '#F3F4F6' },
  statusSmallText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  chevron: { fontSize: 22, color: '#9CA3AF' },

  recentReqCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  reqType: { fontSize: 13, fontWeight: '700', color: '#1F2937', textTransform: 'capitalize' },
  reqUser: { fontSize: 12, color: '#6B7280', marginTop: 1, marginBottom: 4 },

  eventCardAdmin: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },

  addBtn: { backgroundColor: '#1E3A8A', margin: 12, marginBottom: 6, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#1F2937', backgroundColor: '#F9FAFB' },
  textArea: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#1F2937', backgroundColor: '#F9FAFB', minHeight: 90, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#1E3A8A', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  typeChipActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  typeChipText: { fontSize: 13, color: '#6B7280' },
  typeChipTextActive: { color: '#FFF', fontWeight: '600' },
  quickMsgSection: { marginTop: 8 },
  quickMsgBtn: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 11, marginBottom: 8 },
  quickMsgText: { fontSize: 13, color: '#374151' },

  settingCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 2, gap: 10 },
  settingTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  settingDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  modalSafe: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalCancel: { fontSize: 15, color: '#6B7280' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalPost: { fontSize: 15, color: '#1E3A8A', fontWeight: '700' },

  emptyText: { color: '#9CA3AF', textAlign: 'center', padding: 16, fontSize: 14 },
});
