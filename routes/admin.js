const express = require('express');
const router = express.Router();
const { User, Message, FriendRequest, Group, GroupMember, FeatureFlag } = require('../models');
const { Op } = require('sequelize');
const isAdmin = require('../middleware/admin');

router.get('/api/flags', isAdmin, async (req, res) => {
  try {
    const flags = await FeatureFlag.findAll();
    const map = {};
    flags.forEach(f => { map[f.key] = f.value; });
    res.json(map);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load flags' });
  }
});

router.post('/api/flags', isAdmin, async (req, res) => {
  try {
    const { key, value, stringValue } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });
    const update = { key };
    if (typeof value !== 'undefined') update.value = !!value;
    if (typeof stringValue !== 'undefined') update.stringValue = stringValue;
    await FeatureFlag.upsert(update);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

router.post('/api/logo', isAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.logo) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const file = req.files.logo;
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only images allowed' });
    }
    if (file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Max 2MB' });
    }
    const streamifier = require('streamifier');
    const cloudinary = require('../config/cloudinary');
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'ouba', public_id: 'custom_logo', overwrite: true },
        (err, r) => err ? reject(err) : resolve(r)
      );
      streamifier.createReadStream(file.data).pipe(stream);
    });
    await FeatureFlag.upsert({ key: 'logo_url', stringValue: result.secure_url });
    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/', isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId, {
      attributes: ['id', 'username', 'email', 'displayName', 'role', 'profilePic']
    });
    if (!user) return res.redirect('/login');

    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'displayName', 'gender', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    const flags = await FeatureFlag.findAll();
    const flagsMap = {};
    const flagsString = {};
    flags.forEach(f => {
      flagsMap[f.key] = f.value;
      if (f.stringValue) flagsString[f.key] = f.stringValue;
    });

    res.render('admin', {
      title: 'Admin Panel - Ouba',
      user,
      users,
      flags: flagsMap,
      flagsString,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Admin error:', error);
    const user = await User.findByPk(req.session.userId, {
      attributes: ['id', 'username', 'email', 'displayName', 'role', 'profilePic']
    });
    res.render('admin', {
      title: 'Admin Panel - Ouba',
      user,
      users: [],
      flags: {},
      flagsString: {},
      error: 'Failed to load users',
      success: null
    });
  }
});

router.post('/user/:id/role', isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.json({ success: false, error: 'Invalid role' });
    }
    const target = await User.findByPk(req.params.id);
    if (!target) return res.json({ success: false, error: 'User not found' });
    if (target.id === req.session.userId) {
      return res.json({ success: false, error: 'Cannot change your own role' });
    }
    target.role = role;
    await target.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Role change error:', error);
    res.json({ success: false, error: 'Server error' });
  }
});

router.post('/user/:id/delete', isAdmin, async (req, res) => {
  try {
    const target = await User.findByPk(req.params.id);
    if (!target) return res.json({ success: false, error: 'User not found' });
    if (target.id === req.session.userId) {
      return res.json({ success: false, error: 'Cannot delete yourself' });
    }
    await deleteUserData(target.id);
    await target.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.json({ success: false, error: 'Server error' });
  }
});

async function deleteUserData(userId) {
  await Message.destroy({ where: { [Op.or]: [{ senderId: userId }, { receiverId: userId }] } });
  await FriendRequest.destroy({ where: { [Op.or]: [{ senderId: userId }, { receiverId: userId }] } });
  await GroupMember.destroy({ where: { userId } });
  await Group.destroy({ where: { createdBy: userId } });
  const sequelize = require('../config/db');
  await sequelize.query('DELETE FROM "UserFriends" WHERE "userId" = ? OR "friendId" = ?', { replacements: [userId, userId] });
}

module.exports = router;
