const express = require('express');
const router = express.Router();
const { webpush, vapidPublicKey } = require('../config/push');
const auth = require('../middleware/auth');

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

module.exports = router;
