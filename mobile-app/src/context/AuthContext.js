import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          try {
            // Always fetch fresh user data to pick up any role/permission/active changes
            const { data } = await api.get('/me');
            await AsyncStorage.setItem('user', JSON.stringify(data));
            setUser(data);
          } catch (error) {
            const status = error?.response?.status;
            // Only force-logout on definitive server rejections:
            //   401 = token invalid / account deactivated
            //   403 = forbidden
            //   404 = user deleted / not found
            // If there is no response (network down, server unreachable, 5xx), keep the
            // cached session so the user stays logged in while offline.
            if (status === 401 || status === 403 || status === 404) {
              delete api.defaults.headers.common['Authorization'];
              await AsyncStorage.multiRemove(['token', 'user']);
              // user stays null → app shows login screen
            } else {
              // Server unreachable or 5xx — restore session from cache
              const cached = await AsyncStorage.getItem('user');
              if (cached) setUser(JSON.parse(cached));
            }
          }
        }
      } catch (e) {
        console.error('Auth load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(username, password) {
    const { data } = await api.post('/login', { username, password });
    const { token, user: u } = data;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return u;
  }

  async function logout() {
    delete api.defaults.headers.common['Authorization'];
    await AsyncStorage.multiRemove(['token', 'user']);
    setUser(null);
  }

  async function updateUser(updates) {
    const updated = { ...user, ...updates };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
