const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { authenticate } = require('../middleware/auth');

const EPG_URL = 'https://streaming0.watchdishtv.com/serviceepginterface/serviceepgdata';
const EPG_CACHE_TTL = 5 * 60 * 1000;
let epgCache = null;
let epgCacheTime = 0;

function getMockChannels() {
  return [
    { channelId: 'ch-1', name: 'CNN International', currentProgram: 'World News Now', nextProgram: 'Breaking News Special' },
    { channelId: 'ch-2', name: 'BBC World News', currentProgram: 'Global Update', nextProgram: 'The Travel Show' },
    { channelId: 'ch-3', name: 'Discovery Channel', currentProgram: 'Shark Week', nextProgram: 'Planet Earth III' },
    { channelId: 'ch-4', name: 'ESPN', currentProgram: 'SportsCenter', nextProgram: 'NFL Live' },
    { channelId: 'ch-5', name: 'National Geographic', currentProgram: 'Wild Kingdom', nextProgram: 'Air Crash Investigation' },
    { channelId: 'ch-6', name: 'HBO', currentProgram: 'The Last of Us', nextProgram: 'House of the Dragon' },
    { channelId: 'ch-7', name: 'Fox Sports', currentProgram: 'Match of the Day', nextProgram: 'Formula 1' },
    { channelId: 'ch-8', name: 'MTV', currentProgram: 'Video Hits', nextProgram: 'Reality Check' },
    { channelId: 'ch-9', name: 'Animal Planet', currentProgram: 'Crocodile Hunter', nextProgram: 'Meerkat Manor' },
    { channelId: 'ch-10', name: 'History Channel', currentProgram: 'Ancient Aliens', nextProgram: 'Pawn Stars' },
  ].map(ch => ({
    ...ch,
    currentProgramStart: null,
    currentProgramDuration: null,
    viewers: store.watchSessions[ch.channelId] ? store.watchSessions[ch.channelId].viewers.size : 0,
  }));
}

async function fetchEPGData() {
  const now = Date.now();
  if (epgCache && now - epgCacheTime < EPG_CACHE_TTL) {
    return epgCache.map(ch => ({
      ...ch,
      viewers: store.watchSessions[ch.channelId] ? store.watchSessions[ch.channelId].viewers.size : 0,
    }));
  }
  try {
    const response = await axios.get(EPG_URL, { timeout: 6000 });
    const data = response.data;
    const services = data && Array.isArray(data.services) ? data.services : null;
    if (!services || services.length === 0) return getMockChannels();

    const channels = services.slice(0, 20).map((svc, idx) => {
      const channelId = svc.serviceKey || `epg-${idx + 1}`;
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
        name: svc.serviceName || `Channel ${idx + 1}`,
        currentProgram: currentEvent ? currentEvent.eventName : 'Live',
        nextProgram: nextEvent ? nextEvent.eventName : 'Coming up next',
        currentProgramStart: currentEvent ? currentEvent.startTime : null,
        currentProgramDuration: currentEvent ? currentEvent.duration * 1000 : null,
        streamUrl: svc.serviceUrlHLS || null,
      };
    });
    epgCache = channels;
    epgCacheTime = now;
    return channels.map(ch => ({
      ...ch,
      viewers: store.watchSessions[ch.channelId] ? store.watchSessions[ch.channelId].viewers.size : 0,
    }));
  } catch {
    return getMockChannels();
  }
}

router.get('/channels', authenticate, async (req, res) => {
  const channels = await fetchEPGData();
  res.json(channels);
});

router.get('/channels/:channelId', authenticate, async (req, res) => {
  const channels = await fetchEPGData();
  const channel = channels.find(c => c.channelId === req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  const session = store.watchSessions[req.params.channelId] || { viewers: new Set(), messages: [] };
  res.json({ ...channel, viewers: session.viewers.size, messages: session.messages.slice(-50) });
});

router.post('/join-channel', authenticate, (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  if (!store.watchSessions[channelId]) {
    store.watchSessions[channelId] = { viewers: new Set(), messages: [] };
  }
  store.watchSessions[channelId].viewers.add(req.user.id);
  const session = store.watchSessions[channelId];
  res.json({ success: true, viewers: session.viewers.size, messages: session.messages.slice(-50) });
});

router.post('/leave-channel', authenticate, (req, res) => {
  const { channelId } = req.body;
  if (store.watchSessions[channelId]) {
    store.watchSessions[channelId].viewers.delete(req.user.id);
  }
  res.json({ success: true });
});

router.post('/channels/:channelId/message', authenticate, (req, res) => {
  const { channelId } = req.params;
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
  if (!store.watchSessions[channelId]) {
    store.watchSessions[channelId] = { viewers: new Set(), messages: [] };
  }
  const chatMsg = {
    id: uuidv4(),
    userId: req.user.id,
    username: req.user.name,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };
  const msgs = store.watchSessions[channelId].messages;
  msgs.push(chatMsg);
  if (msgs.length > 100) store.watchSessions[channelId].messages = msgs.slice(-100);
  res.json({ success: true, message: chatMsg });
});

router.get('/channels/:channelId/messages', authenticate, (req, res) => {
  const session = store.watchSessions[req.params.channelId];
  res.json(session ? session.messages.slice(-50) : []);
});

module.exports = router;
