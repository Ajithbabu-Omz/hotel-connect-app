const { pgTable, text, boolean, timestamp, uuid, integer, primaryKey } = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('guest'), // admin | staff | guest
  room: text('room'),
  expiryDate: timestamp('expiry_date'),
  isActive: boolean('is_active').notNull().default(true),
  canCreateUsers: boolean('can_create_users').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  editedAt: timestamp('edited_at'),
});

const postLikes = pgTable('post_likes', {
  postId: uuid('post_id').notNull(),
  userId: uuid('user_id').notNull(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull(),
  parentId: uuid('parent_id'),
  userId: uuid('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const commentLikes = pgTable('comment_likes', {
  commentId: uuid('comment_id').notNull(),
  userId: uuid('user_id').notNull(),
}, (t) => [primaryKey({ columns: [t.commentId, t.userId] })]);

const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  message: text('message').notNull(),
  type: text('type').notNull().default('general'),
  targetUserId: uuid('target_user_id'), // null = all users
  relatedId: uuid('related_id'),
  relatedType: text('related_type'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const notificationReads = pgTable('notification_reads', {
  notificationId: uuid('notification_id').notNull(),
  userId: uuid('user_id').notNull(),
}, (t) => [primaryKey({ columns: [t.notificationId, t.userId] })]);

const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  date: timestamp('date').notNull(),
  location: text('location').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const menu = pgTable('menu', {
  id: uuid('id').primaryKey().defaultRandom(),
  breakfast: text('breakfast').notNull().default(''),
  lunch: text('lunch').notNull().default(''),
  dinner: text('dinner').notNull().default(''),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const serviceRequests = pgTable('service_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(), // cleaning | food | maintenance
  status: text('status').notNull().default('open'), // open | closed
  createdAt: timestamp('created_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at'),
  closedById: uuid('closed_by_id'),
});

const serviceRequestMessages = pgTable('service_request_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull(),
  userId: uuid('user_id').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const amenities = pgTable('amenities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

const channelMessages = pgTable('channel_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: text('channel_id').notNull(),
  userId: uuid('user_id').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

module.exports = {
  users,
  posts,
  postLikes,
  comments,
  commentLikes,
  notifications,
  notificationReads,
  events,
  menu,
  serviceRequests,
  serviceRequestMessages,
  amenities,
  settings,
  channelMessages,
};
