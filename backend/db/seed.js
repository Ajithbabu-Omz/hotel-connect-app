const bcrypt = require('bcryptjs');
const { getConnection } = require('./index');
const { users, menu, settings } = require('./schema');
const { eq } = require('drizzle-orm');

async function seed() {
  const { db } = getConnection();

  // Admin user
  const existing = await db.select().from(users).where(eq(users.username, 'admin'));
  if (existing.length === 0) {
    await db.insert(users).values({
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      displayName: 'Admin User',
      role: 'admin',
      isActive: true,
      canCreateUsers: false,
    });
    console.log('Seeded admin user (admin / admin123)');
  }

  // Default menu (empty — admin sets this via the app)
  const existingMenu = await db.select().from(menu);
  if (existingMenu.length === 0) {
    await db.insert(menu).values({ breakfast: '', lunch: '', dinner: '' });
  }

  // Default amenities (empty — admin adds these via the app)
  // Uncomment and edit to pre-load amenities:
  // const existingAmenities = await db.select().from(amenities);
  // if (existingAmenities.length === 0) {
  //   await db.insert(amenities).values([
  //     { name: 'Pool', icon: '🏊', description: 'Outdoor swimming pool', sortOrder: 1 },
  //     { name: 'Gym', icon: '💪', description: 'Fully equipped fitness center', sortOrder: 2 },
  //   ]);
  // }

  // Default settings
  const existingSettings = await db.select().from(settings).where(eq(settings.key, 'auto_close_days'));
  if (existingSettings.length === 0) {
    await db.insert(settings).values({ key: 'auto_close_days', value: '7' });
  }
}

module.exports = { seed };
