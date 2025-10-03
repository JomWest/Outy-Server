const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { authMiddleware } = require('../../../security/auth');
const { Expo } = require('expo-server-sdk');

const router = express.Router();

const tokensFile = path.join(__dirname, '../../../../backups/push_tokens.json');

async function readTokens() {
  try {
    const txt = await fs.readFile(tokensFile, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return { users: {} };
  }
}

async function writeTokens(data) {
  await fs.mkdir(path.dirname(tokensFile), { recursive: true });
  await fs.writeFile(tokensFile, JSON.stringify(data, null, 2), 'utf8');
}

/** Register Expo push token for current user */
router.post('/register', authMiddleware, async (req, res, next) => {
  try {
    const { token, device } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token inválido' });
    }
    const data = await readTokens();
    const list = data.users[req.user.id] || [];
    // De-duplicate by token string
    const existingIdx = list.findIndex((t) => t.token === token);
    const record = { token, device: device || {}, updatedAt: new Date().toISOString() };
    if (existingIdx >= 0) list[existingIdx] = record; else list.push(record);
    data.users[req.user.id] = list;
    await writeTokens(data);
    res.json({ ok: true, tokens: list.length });
  } catch (err) {
    next(err);
  }
});

/** Utility to send push to all tokens of a user */
async function sendPushToUser(userId, message) {
  const expo = new Expo();
  const data = await readTokens();
  const tokens = (data.users[userId] || []).map((t) => t.token).filter((t) => Expo.isExpoPushToken(t));
  if (tokens.length === 0) return { sent: 0 };

  const chunks = expo.chunkPushNotifications(tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: message.title || 'Nuevo mensaje',
    body: message.body || '',
    data: message.data || {},
    channelId: 'messages',
  })));

  let sent = 0;
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      sent += receipts.length;
    } catch (e) {
      console.error('sendPushNotificationsAsync error', e);
    }
  }
  return { sent };
}

module.exports = { router, sendPushToUser };