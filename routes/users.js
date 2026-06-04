const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render('profile', { title: 'My Profile - Ouba', user, error: null, success: null });
  } catch (error) {
    res.redirect('/');
  }
});

router.post('/profile', async (req, res) => {
  try {
    const { displayName, bio, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.session.userId);

    if (displayName) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;

    if (currentPassword && newPassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.render('profile', { title: 'My Profile - Ouba', user, error: 'Current password is incorrect', success: null });
      }
      if (newPassword.length < 6) {
        return res.render('profile', { title: 'My Profile - Ouba', user, error: 'New password must be at least 6 characters', success: null });
      }
      user.password = newPassword;
    }

    await user.save();
    res.render('profile', { title: 'My Profile - Ouba', user, error: null, success: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.redirect('/profile');
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const currentUser = await User.findById(req.session.userId);

    let users = [];
    if (query.length >= 1) {
      users = await User.find({
        $and: [
          { _id: { $ne: req.session.userId } },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { displayName: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      }).select('username displayName profilePic bio').limit(20);

      users = users.map(u => {
        const hasPendingReq = currentUser.friendRequests.some(
          fr => fr.from.toString() === u._id.toString() && fr.status === 'pending'
        );
        const isFriend = currentUser.friends.some(
          f => f.toString() === u._id.toString()
        );
        const gotRequest = u.friendRequests.some(
          fr => fr.from.toString() === currentUser._id.toString() && fr.status === 'pending'
        );
        return {
          ...u.toObject(),
          hasPendingReq,
          isFriend,
          gotRequest
        };
      });
    }

    res.json({ users });
  } catch (error) {
    console.error('Search error:', error);
    res.json({ users: [] });
  }
});

router.post('/friend-request/:userId', async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.session.userId);

    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (currentUser.friends.includes(targetUser._id)) {
      return res.status(400).json({ error: 'Already friends' });
    }

    const alreadySent = targetUser.friendRequests.some(
      fr => fr.from.toString() === currentUser._id.toString() && fr.status === 'pending'
    );
    if (alreadySent) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    targetUser.friendRequests.push({ from: currentUser._id, status: 'pending' });
    await targetUser.save();

    res.json({ success: true, message: 'Friend request sent!' });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/accept-request/:userId', async (req, res) => {
  try {
    const currentUser = await User.findById(req.session.userId);
    const senderUser = await User.findById(req.params.userId);

    if (!senderUser) return res.status(404).json({ error: 'User not found' });

    const request = currentUser.friendRequests.find(
      fr => fr.from.toString() === req.params.userId && fr.status === 'pending'
    );
    if (!request) return res.status(400).json({ error: 'No pending request' });

    request.status = 'accepted';
    currentUser.friends.push(senderUser._id);
    senderUser.friends.push(currentUser._id);

    await currentUser.save();
    await senderUser.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/reject-request/:userId', async (req, res) => {
  try {
    const currentUser = await User.findById(req.session.userId);

    const request = currentUser.friendRequests.find(
      fr => fr.from.toString() === req.params.userId && fr.status === 'pending'
    );
    if (!request) return res.status(400).json({ error: 'No pending request' });

    request.status = 'rejected';

    await currentUser.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/friends', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .populate('friends', 'username displayName profilePic bio')
      .populate('friendRequests.from', 'username displayName profilePic');

    const pendingRequests = user.friendRequests.filter(fr => fr.status === 'pending');

    res.render('friends', {
      title: 'Friends - Ouba',
      user,
      friends: user.friends,
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
    const currentUser = await User.findById(req.session.userId);
    const profileUser = await User.findById(req.params.id).select('username displayName profilePic bio');

    if (!profileUser) return res.status(404).json({ error: 'User not found' });

    const isFriend = currentUser.friends.some(f => f.toString() === profileUser._id.toString());
    const hasPendingReq = profileUser.friendRequests.some(
      fr => fr.from.toString() === currentUser._id.toString() && fr.status === 'pending'
    );

    res.json({
      user: profileUser,
      isFriend,
      hasPendingReq
    });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
