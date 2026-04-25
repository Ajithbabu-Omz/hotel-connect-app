const bcrypt = require('bcryptjs');

const store = {
  users: [
    {
      id: 'admin-1',
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      name: 'Admin User',
      room: null,
      expiryDate: null,
      createdAt: new Date().toISOString(),
    },
  ],
  posts: [
    {
      id: 'post-1',
      userId: 'admin-1',
      username: 'Admin User',
      content: 'Welcome to the Community App! Feel free to post and connect with others.',
      likes: [],
      createdAt: new Date().toISOString(),
    },
  ],
  comments: [],
  menu: {
    breakfast: 'Scrambled Eggs, Toast, Orange Juice, Fresh Fruit',
    lunch: 'Grilled Chicken, Steamed Rice, Garden Salad',
    dinner: 'Pasta Carbonara, Garlic Bread, Caesar Salad',
  },
  notifications: [
    {
      id: 'notif-1',
      message: 'Welcome to the Community App! Enjoy your stay.',
      type: 'general',
      createdAt: new Date().toISOString(),
      readBy: [],
    },
  ],
  events: [
    {
      id: 'event-1',
      title: 'Community Movie Night',
      description: 'Join us for a fun movie night in the common room',
      date: new Date(Date.now() + 86400000 * 2).toISOString(),
      location: 'Common Room',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'event-2',
      title: 'Rooftop BBQ',
      description: 'Weekend BBQ on the rooftop terrace',
      date: new Date(Date.now() + 86400000 * 5).toISOString(),
      location: 'Rooftop Terrace',
      createdAt: new Date().toISOString(),
    },
  ],
  serviceRequests: [],
  watchSessions: {},
};

module.exports = store;
