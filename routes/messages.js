const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/chat/:friendId', async (req, res) => {
  try {
    const currentUser = await User.findById(req.session.userId);
    const friend = await User.findById(req.params.friendId).select('username displayName profilePic bio');

    if (!friend) return res.redirect('/');

    const isFriend = currentUser.friends.some(f => f.toString() === friend._id.toString());
    if (!isFriend) return res.redirect('/friends');

    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: friend._id },
        { sender: friend._id, receiver: currentUser._id }
      ]
    }).sort({ createdAt: 1 }).populate('sender', 'username displayName profilePic');

    const friends = await User.findById(req.session.userId)
      .populate('friends', 'username displayName profilePic bio');

    res.render('chat', {
      title: `Chat with ${friend.displayName || friend.username} - Ouba`,
      user: currentUser,
      friend,
      messages,
      friends: friends.friends
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.redirect('/');
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const userId = req.session.userId;

    const messages = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    const conversationUsers = await User.find({
      _id: { $in: messages.map(m => m._id) }
    }).select('username displayName profilePic bio');

    const conversations = messages.map(m => {
      const user = conversationUsers.find(
        u => u._id.toString() === m._id.toString()
      );
      return {
        user,
        lastMessage: m.lastMessage
      };
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Conversations error:', error);
    res.json({ conversations: [] });
  }
});

module.exports = router;
