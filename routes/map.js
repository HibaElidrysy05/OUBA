const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/map', async (req, res) => {
  try {
    const currentUser = await User.findByPk(req.session.userId, {
      attributes: ['id', 'username', 'displayName', 'profilePic', 'shareLocation', 'latitude', 'longitude']
    });
    const friends = await currentUser.getFriends({
      attributes: ['id', 'username', 'displayName', 'profilePic', 'shareLocation', 'latitude', 'longitude']
    });
    res.render('map', {
      title: 'Map - Ouba',
      user: currentUser,
      friends: friends || []
    });
  } catch (error) {
    console.error('Map error:', error);
    res.redirect('/');
  }
});

router.post('/api/location/update', async (req, res) => {
  try {
    const { latitude, longitude, shareLocation } = req.body;
    const userId = req.session.userId;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (shareLocation) {
      if (latitude == null || longitude == null) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
      }
      user.latitude = latitude;
      user.longitude = longitude;
    } else {
      user.latitude = null;
      user.longitude = null;
    }
    user.shareLocation = !!shareLocation;
    await user.save();
    res.json({ success: true, shareLocation: user.shareLocation });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/api/friends/locations', async (req, res) => {
  try {
    const currentUser = await User.findByPk(req.session.userId);
    const friends = await currentUser.getFriends({
      attributes: ['id', 'username', 'displayName', 'profilePic', 'latitude', 'longitude'],
      where: { shareLocation: true, latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } }
    });
    res.json({ friends: friends || [] });
  } catch (error) {
    console.error('Friends locations error:', error);
    res.json({ friends: [] });
  }
});

module.exports = router;
