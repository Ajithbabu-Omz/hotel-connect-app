require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { eq, and, lte, isNull } = require('drizzle-orm');
const { setupDatabase } = require('./db/index');
const { seed } = require('./db/seed');
const { getConnection } = require('./db/index');
const schema = require('./db/schema');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/community'));
app.use('/', require('./routes/channels'));
app.use('/', require('./routes/notifications'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Auto-close service requests cron job: runs every hour
cron.schedule('0 * * * *', async () => {
  try {
    const { db } = getConnection();
    // Get auto_close_days setting
    const [setting] = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'auto_close_days'));
    const days = parseInt(setting?.value || '7', 10);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Find open requests created before the cutoff
    const openRequests = await db
      .select()
      .from(schema.serviceRequests)
      .where(and(eq(schema.serviceRequests.status, 'open'), lte(schema.serviceRequests.createdAt, cutoff)));

    for (const request of openRequests) {
      // Get last message for this request
      const messages = await db
        .select({
          userId: schema.serviceRequestMessages.userId,
          role: schema.users.role,
        })
        .from(schema.serviceRequestMessages)
        .innerJoin(schema.users, eq(schema.serviceRequestMessages.userId, schema.users.id))
        .where(eq(schema.serviceRequestMessages.requestId, request.id))
        .orderBy(schema.serviceRequestMessages.createdAt);

      const lastMsg = messages[messages.length - 1];
      // Only auto-close if last message is from admin or staff
      if (lastMsg && (lastMsg.role === 'admin' || lastMsg.role === 'staff')) {
        await db
          .update(schema.serviceRequests)
          .set({ status: 'closed', closedAt: new Date() })
          .where(eq(schema.serviceRequests.id, request.id));
        console.log(`Auto-closed service request ${request.id}`);
      }
    }
  } catch (err) {
    console.error('Auto-close cron error:', err);
  }
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await setupDatabase();
    console.log('Database schema ready');
    await seed();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Hotel Connect Backend running on http://0.0.0.0:${PORT}`);
      console.log('Default admin: username=admin  password=admin123');
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();
