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
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });
    await FeatureFlag.upsert({ key, value: !!value });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

router.get('/', isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId, {
      attributes: ['id', 'username', 'email', 'displayName', 'role', 'profilePic']
    });
    if (!user) return res.redirect('/login');

    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'displayName', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    const flags = await FeatureFlag.findAll();
    const flagsMap = {};
    flags.forEach(f => { flagsMap[f.key] = f.value; });

    res.render('admin', {
      title: 'Admin Panel - Ouba',
      user,
      users,
      flags: flagsMap,
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
