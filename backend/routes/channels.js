const express = require('express');
const router = express.Router();
const axios = require('axios');
const { eq, desc } = require('drizzle-orm');
const { getConnection } = require('../db/index');
const schema = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const fs = require('fs').promises;

// ── Generic URL proxy ────────────────────────────────────────────────────────
// POST /request  { url: "https://..." }
router.post('/request', authenticate, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const upstream = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
      },
    });
    res.set('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');
    res.set('Access-Control-Allow-Origin', '*');
    res.status(upstream.status).send(Buffer.from(upstream.data));
  } catch (err) {
    const status = err.response?.status || 502;
    await fs.appendFile('/app/requests.txt', `PROXY ERROR ${status} ${url}: ${err.message}\n`).catch(() => {});
    res.status(status).json({ error: 'Proxy request failed', detail: err.message });
  }
});

// ── DRM Token proxy ──────────────────────────────────────────────────────────
// GET /drm-token?contentId=<id>
// Proxies to $STREAMING_URL/$DRMTOKEN_ENDPOINT?contentID=<id> and returns the
// full DRM token payload (serviceUrlHLS, serviceUrlHLSWidevine, drmToken …)
router.get('/drm-token', authenticate, async (req, res) => {
  const { contentId } = req.query;
  if (!contentId) return res.status(400).json({ error: 'contentId is required' });

  // contentId from the client is channelId (serviceKey). Resolve the real
  // contentID (hex hash) from the EPG data.
  const { channels } = await fetchEPGData();
  const channel = channels.find((c) => c.channelId === contentId);
  const resolvedContentId = channel?.contentID || contentId;

  const streamingUrl = process.env.STREAMING_URL;
  const drmEndpoint = process.env.DRMTOKEN_ENDPOINT;
  if (!streamingUrl || !drmEndpoint) {
    return res.status(503).json({ error: 'DRM service not configured' });
  }

  // DRMTOKEN_ENDPOINT may be a full URL or just a path segment.
  // Normalise: strip any trailing query string placeholder the env might include.
  let upstreamBase;
  if (drmEndpoint.startsWith('http')) {
    // Full URL — strip any trailing ?contentID= placeholder
    upstreamBase = drmEndpoint.replace(/\?contentID=.*$/, '').replace(/\/+$/, '');
  } else {
    upstreamBase = `${streamingUrl.replace(/\/+$/, '')}/${drmEndpoint.replace(/^\/+/, '')}`;
  }
  const upstreamUrl = `${upstreamBase}?contentID=${encodeURIComponent(resolvedContentId)}`;

  await fs.appendFile('/app/requests.txt', upstreamUrl + '\n').catch(() => {});

  try {
    const response = await axios.get(upstreamUrl, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    console.error('DRM token fetch error:', err.message);
    const status = err.response?.status || 502;
    res.status(status).json({ error: 'Failed to fetch DRM token' });
  }
});

const EPG_CACHE_TTL = 5 * 60 * 1000;
let epgCache = null;
let epgCacheTime = 0;

// In-memory viewer tracking (ephemeral)
const watchSessions = {};

async function fetchEPGData() {
  const streamingUrl = process.env.STREAMING_URL;
  const epgEndpoint = process.env.EPG_ENDPOINT;
  if (!streamingUrl || !epgEndpoint) {
    return { channels: [], error: 'No channels available' };
  }
  const epgUrl = `${streamingUrl}/${epgEndpoint}`;
  const now = Date.now();
  if (epgCache && now - epgCacheTime < EPG_CACHE_TTL) {
    return { channels: epgCache };
  }
  try {
    const response = await axios.get(epgUrl, { timeout: 8000 });
    const data = response.data;
    const services = data && Array.isArray(data.services) ? data.services : null;
    if (!services || services.length === 0) {
      return { channels: [], error: 'No channels available' };
    }
    const channels = services.slice(0, 50).map((svc, idx) => {
      const channelId = String(svc.serviceKey || `epg-${idx + 1}`);
      const events = Array.isArray(svc.events) ? svc.events : [];
      let currentEvent = null;
      let nextEvent = null;
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const start = ev.startTime;
        const end = start + ev.duration * 1000;
        if (now >= start && now < end) {
          currentEvent = ev;
          nextEvent = events[i + 1] || null;
          break;
        }
      }
      if (!currentEvent && events.length > 0) {
        currentEvent = events[0];
        nextEvent = events[1] || null;
      }
      return {
        channelId,
        contentID: svc.contentID || null,
        name: svc.serviceName || `Channel ${idx + 1}`,
        currentProgram: currentEvent ? currentEvent.eventName : 'Live',
        nextProgram: nextEvent ? nextEvent.eventName : 'Coming up next',
        currentProgramStart: currentEvent ? currentEvent.startTime : null,
        currentProgramDuration: currentEvent ? currentEvent.duration * 1000 : null,
        streamUrl: svc.serviceUrlHLS || null,
        streamUrlWidevine: svc.serviceUrlHLSWidevine || null,
      };
    });
    epgCache = channels;
    epgCacheTime = now;
    return { channels };
  } catch (err) {
    console.error('EPG fetch error:', err.message);
    return { channels: [], error: 'No channels available' };
  }
}

router.get('/channels', authenticate, async (req, res) => {
  const { channels, error } = await fetchEPGData();
  if (error && channels.length === 0) {
    return res.json({ channels: [], message: error });
  }
  const withViewers = channels.map((ch) => ({
    ...ch,
    viewers: watchSessions[ch.channelId] ? watchSessions[ch.channelId].size : 0,
  }));
  res.json({ channels: withViewers });
});

router.get('/channels/:channelId', authenticate, async (req, res) => {
  const { channels, error } = await fetchEPGData();
  if (error && channels.length === 0) {
    return res.status(404).json({ error: 'No channels available' });
  }
  const channel = channels.find((c) => c.channelId === req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  try {
    const { db } = getConnection();
    const messages = await db
      .select({
        id: schema.channelMessages.id,
        channelId: schema.channelMessages.channelId,
        userId: schema.channelMessages.userId,
        message: schema.channelMessages.message,
        createdAt: schema.channelMessages.createdAt,
        displayName: schema.users.displayName,
        userIsActive: schema.users.isActive,
      })
      .from(schema.channelMessages)
      .innerJoin(schema.users, eq(schema.channelMessages.userId, schema.users.id))
      .where(eq(schema.channelMessages.channelId, req.params.channelId))
      .orderBy(desc(schema.channelMessages.createdAt))
      .limit(50);

    res.json({
      ...channel,
      viewers: watchSessions[req.params.channelId] ? watchSessions[req.params.channelId].size : 0,
      messages: messages.map((m) => ({
        ...m,
        username: m.userIsActive ? m.displayName : `${m.displayName} (inactive)`,
      })).reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/join-channel', authenticate, (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  if (!watchSessions[channelId]) watchSessions[channelId] = new Set();
  watchSessions[channelId].add(req.user.id);
  res.json({ success: true, viewers: watchSessions[channelId].size });
});

router.post('/leave-channel', authenticate, (req, res) => {
  const { channelId } = req.body;
  if (watchSessions[channelId]) {
    watchSessions[channelId].delete(req.user.id);
  }
  res.json({ success: true });
});

router.post('/channels/:channelId/message', authenticate, async (req, res) => {
  const { channelId } = req.params;
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
  if (req.user.role === 'admin' || req.user.role === 'staff') {
    return res.status(403).json({ error: 'Admin/staff are view-only in watch sessions' });
  }
  try {
    const { db } = getConnection();
    const [msg] = await db
      .insert(schema.channelMessages)
      .values({ channelId, userId: req.user.id, message: message.trim() })
      .returning();
    res.json({
      success: true,
      message: { ...msg, username: req.user.displayName, userIsActive: true },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/channels/:channelId/messages', authenticate, async (req, res) => {
  try {
    const { db } = getConnection();
    const messages = await db
      .select({
        id: schema.channelMessages.id,
        channelId: schema.channelMessages.channelId,
        userId: schema.channelMessages.userId,
        message: schema.channelMessages.message,
        createdAt: schema.channelMessages.createdAt,
        displayName: schema.users.displayName,
        userIsActive: schema.users.isActive,
      })
      .from(schema.channelMessages)
      .innerJoin(schema.users, eq(schema.channelMessages.userId, schema.users.id))
      .where(eq(schema.channelMessages.channelId, req.params.channelId))
      .orderBy(desc(schema.channelMessages.createdAt))
      .limit(50);

    res.json(
      messages
        .map((m) => ({
          ...m,
          username: m.userIsActive ? m.displayName : `${m.displayName} (inactive)`,
        }))
        .reverse()
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
