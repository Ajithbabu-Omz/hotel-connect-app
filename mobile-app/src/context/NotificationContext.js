import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/api';

const NotificationContext = createContext({ unreadCount: 0, refresh: () => {}, clearBadge: () => {} });

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  async function fetchUnread() {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch {}
  }

  useEffect(() => {
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, refresh: fetchUnread, clearBadge: () => setUnreadCount(0) }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
