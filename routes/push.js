const express = require('express');
const router = express.Router();
const { webpush, vapidPublicKey } = require('../config/push');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

router.use(auth);

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

router.post('/push-subscribe', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    const { PushSubscription } = require('../models');
    await PushSubscription.destroy({ where: { endpoint } });
    await PushSubscription.create({
      userId,
      endpoint,
      auth: keys.auth,
      p256dh: keys.p256dh
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/push-unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    const { PushSubscription } = require('../models');
    await PushSubscription.destroy({ where: { endpoint } });
    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/push/debug', isAdmin, (req, res) => {
  res.redirect('/admin');
});

router.post('/push/test', isAdmin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { PushSubscription } = require('../models');
    const subs = await PushSubscription.findAll({ where: { userId } });
    if (subs.length === 0) return res.json({ error: 'No push subscriptions found' });
    let sent = 0, failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { auth: sub.auth, p256dh: sub.p256dh }
        }, JSON.stringify({
          title: 'Ouba Test',
          body: 'This is a test notification from Ouba!',
          url: '/'
        }));
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 410 || err.statusCode === 404) await sub.destroy();
      }
    }
    res.json({ sent, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
