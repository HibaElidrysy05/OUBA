const express = require('express');
const router = express.Router();
const { User } = require('../models');
const isAdmin = require('../middleware/admin');

router.get('/', isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'displayName', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.render('admin', {
      title: 'Admin Panel - Ouba',
      user: req.session.user,
      users,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Admin error:', error);
    res.render('admin', {
      title: 'Admin Panel - Ouba',
      user: req.session.user,
      users: [],
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
    if (target.id === req.session.user.id) {
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
    if (target.id === req.session.user.id) {
      return res.json({ success: false, error: 'Cannot delete yourself' });
    }
    await target.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
