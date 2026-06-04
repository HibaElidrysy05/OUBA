const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/profile', async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    res.render('profile', { title: 'My Profile - Ouba', user, error: null, success: null });
  } catch (error) {
    res.redirect('/');
  }
});

router.post('/profile', async (req, res) => {
  try {
    const { displayName, bio, currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.session.userId);

    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;

    if (currentPassword && newPassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.render('profile', { title: 'My Profile - Ouba', user, error: 'Current password is incorrect', success: null });
      }
      if (newPassword.length < 6) {
        return res.render('profile', { title: 'My Profile - Ouba', user, error: 'New password must be at least 6 characters', success: null });
      }
      updates.password = newPassword;
    }

    await user.update(updates);
    const updatedUser = await User.findByPk(req.session.userId);
    res.render('profile', { title: 'My Profile - Ouba', user: updatedUser, error: null, success: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.redirect('/profile');
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const currentUserId = req.session.userId;

    let users = [];
    if (query.length >= 1) {
      const found = await User.findAll({
        where: {
          id: { [Op.ne]: currentUserId },
          [Op.or]: [
            { username: { [Op.iLike]: `%${query}%` } },
            { displayName: { [Op.iLike]: `%${query}%` } }
          ]
        },
        attributes: ['id', 'username', 'displayName', 'profilePic', 'bio'],
        limit: 20
      });

      const sentRequests = await FriendRequest.findAll({
        where: {
          senderId: currentUserId,
          status: 'pending'
        }
      });
      const sentToIds = new Set(sentRequests.map(r => r.receiverId));

      const receivedRequests = await FriendRequest.findAll({
        where: {
          receiverId: currentUserId,
          status: 'pending'
        }
      });
      const receivedFromIds = new Set(receivedRequests.map(r => r.senderId));

      const currentUser = await User.findByPk(currentUserId);
      const friendIds = new Set((await currentUser.getFriends()).map(f => f.id));

      users = found.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        profilePic: u.profilePic,
        bio: u.bio,
        isFriend: friendIds.has(u.id),
        hasPendingReq: sentToIds.has(u.id),
        gotRequest: receivedFromIds.has(u.id)
      }));
    }

    res.json({ users });
  } catch (error) {
    console.error('Search error:', error);
    res.json({ users: [] });
  }
});

router.post('/friend-request/:userId', async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const targetId = req.params.userId;

    if (currentUserId === targetId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    const targetUser = await User.findByPk(targetId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const currentUser = await User.findByPk(currentUserId);
    const friends = await currentUser.getFriends();
    if (friends.some(f => f.id === targetId)) {
      return res.status(400).json({ error: 'Already friends' });
    }

    const existing = await FriendRequest.findOne({
      where: {
        senderId: currentUserId,
        receiverId: targetId,
        status: 'pending'
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    await FriendRequest.create({
      senderId: currentUserId,
      receiverId: targetId,
      status: 'pending'
    });

    res.json({ success: true, message: 'Friend request sent!' });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/accept-request/:userId', async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const senderId = req.params.userId;

    const request = await FriendRequest.findOne({
      where: {
        senderId,
        receiverId: currentUserId,
        status: 'pending'
      }
    });
    if (!request) return res.status(400).json({ error: 'No pending request' });

    await request.update({ status: 'accepted' });

    const currentUser = await User.findByPk(currentUserId);
    const senderUser = await User.findByPk(senderId);

    await currentUser.addFriend(senderUser);
    await senderUser.addFriend(currentUser);

    res.json({ success: true });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/reject-request/:userId', async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const senderId = req.params.userId;

    const request = await FriendRequest.findOne({
      where: {
        senderId,
        receiverId: currentUserId,
        status: 'pending'
      }
    });
    if (!request) return res.status(400).json({ error: 'No pending request' });

    await request.update({ status: 'rejected' });

    res.json({ success: true });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/friends', async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId, {
      include: [
        {
          association: 'Friends',
          attributes: ['id', 'username', 'displayName', 'profilePic', 'bio']
        },
        {
          association: 'ReceivedRequests',
          where: { status: 'pending' },
          required: false,
          include: [{ association: 'Sender', attributes: ['id', 'username', 'displayName', 'profilePic'] }]
        }
      ]
    });

    const pendingRequests = (user.ReceivedRequests || []).filter(r => r.status === 'pending');

    res.render('friends', {
      title: 'Friends - Ouba',
      user,
      friends: user.Friends || [],
      pendingRequests,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Friends page error:', error);
    res.redirect('/');
  }
});

router.get('/user/:id', async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const profileUser = await User.findByPk(req.params.id, {
      attributes: ['id', 'username', 'displayName', 'profilePic', 'bio']
    });

    if (!profileUser) return res.status(404).json({ error: 'User not found' });

    const currentUser = await User.findByPk(currentUserId);
    const friends = await currentUser.getFriends();
    const isFriend = friends.some(f => f.id === profileUser.id);

    const pendingReq = await FriendRequest.findOne({
      where: {
        senderId: currentUserId,
        receiverId: profileUser.id,
        status: 'pending'
      }
    });

    res.json({
      user: profileUser,
      isFriend,
      hasPendingReq: !!pendingReq
    });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
