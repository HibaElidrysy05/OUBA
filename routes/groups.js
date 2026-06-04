const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { User, Group, GroupMember, Message } = require('../models');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/groups', async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId, {
      include: [{ association: 'Groups' }]
    });

    res.render('groups', {
      title: 'Groups - Ouba',
      user,
      groups: user.Groups || [],
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Groups page error:', error);
    res.redirect('/');
  }
});

router.post('/groups', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await Group.create({
      name: name.trim(),
      createdBy: req.session.userId
    });

    await GroupMember.create({
      groupId: group.id,
      userId: req.session.userId,
      role: 'admin'
    });

    res.json({ success: true, groupId: group.id });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.get('/group/:id', async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, {
      include: [
        { association: 'creator', attributes: ['id', 'username', 'displayName', 'profilePic'] },
        { association: 'members', include: [{ association: 'user', attributes: ['id', 'username', 'displayName', 'profilePic'] }] }
      ]
    });

    if (!group) return res.redirect('/groups');

    const isMember = group.members.some(m => m.userId === req.session.userId);
    if (!isMember) return res.redirect('/groups');

    const messages = await Message.findAll({
      where: { groupId: group.id },
      include: [{ association: 'sender', attributes: ['id', 'username', 'displayName', 'profilePic'] }],
      order: [['createdAt', 'ASC']],
      limit: 100
    });

    const user = await User.findByPk(req.session.userId, {
      include: [{ association: 'Groups' }]
    });

    res.render('group-chat', {
      title: `${group.name} - Ouba`,
      user,
      group,
      members: group.members,
      messages,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Group chat error:', error);
    res.redirect('/groups');
  }
});

router.post('/group/:id/add', async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, {
      include: [{ association: 'members' }]
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const member = group.members.find(m => m.userId === req.session.userId && m.role === 'admin');
    if (!member) return res.status(403).json({ error: 'Only admins can add members' });

    const { userId } = req.body;
    const alreadyMember = group.members.some(m => m.userId === userId);
    if (alreadyMember) return res.status(400).json({ error: 'Already a member' });

    await GroupMember.create({
      groupId: group.id,
      userId,
      role: 'member'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.post('/group/:id/leave', async (req, res) => {
  try {
    const membership = await GroupMember.findOne({
      where: { groupId: req.params.id, userId: req.session.userId }
    });
    if (!membership) return res.status(404).json({ error: 'Not a member' });

    await membership.destroy();

    const remaining = await GroupMember.count({ where: { groupId: req.params.id } });
    if (remaining === 0) {
      await Group.destroy({ where: { id: req.params.id } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

router.get('/group/:id/members', async (req, res) => {
  try {
    const members = await GroupMember.findAll({
      where: { groupId: req.params.id },
      include: [{ association: 'user', attributes: ['id', 'username', 'displayName', 'profilePic'] }]
    });

    const currentUser = await User.findByPk(req.session.userId);
    const friends = await currentUser.getFriends();
    const memberIds = members.map(m => m.userId);

    const addableFriends = friends.filter(f => !memberIds.includes(f.id));

    res.json({ members, addableFriends });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get members' });
  }
});

router.post('/group/:id/edit', async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.createdBy !== req.session.userId) {
      return res.status(403).json({ error: 'Only the creator can edit the group' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    await group.update({ name: name.trim() });
    res.json({ success: true });
  } catch (error) {
    console.error('Edit group error:', error);
    res.status(500).json({ error: 'Failed to edit group' });
  }
});

router.post('/group/:id/delete', async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.createdBy !== req.session.userId) {
      return res.status(403).json({ error: 'Only the creator can delete the group' });
    }

    await GroupMember.destroy({ where: { groupId: group.id } });
    await Message.update({ groupId: null }, { where: { groupId: group.id } });
    await group.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

module.exports = router;
