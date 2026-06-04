const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/chat/:friendId', async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const friendId = req.params.friendId;

    const currentUser = await User.findByPk(currentUserId);
    const friend = await User.findByPk(friendId, {
      attributes: ['id', 'username', 'displayName', 'profilePic', 'bio']
    });

    if (!friend) return res.redirect('/');

    const friends = await currentUser.getFriends();
    const isFriend = friends.some(f => f.id === friend.id);
    if (!isFriend) return res.redirect('/friends');

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: currentUserId, receiverId: friendId },
          { senderId: friendId, receiverId: currentUserId }
        ]
      },
      order: [['createdAt', 'ASC']],
      include: [
        { association: 'sender', attributes: ['id', 'username', 'displayName', 'profilePic'] }
      ]
    });

    const userWithFriends = await User.findByPk(currentUserId, {
      include: [
        {
          association: 'Friends',
          attributes: ['id', 'username', 'displayName', 'profilePic', 'bio']
        }
      ]
    });

    res.render('chat', {
      title: `Chat with ${friend.displayName || friend.username} - Ouba`,
      user: currentUser,
      friend,
      messages,
      friends: userWithFriends.Friends || []
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.redirect('/');
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const userId = req.session.userId;

    const allMessages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    const convMap = {};
    for (const msg of allMessages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!convMap[partnerId]) {
        convMap[partnerId] = msg;
      }
    }

    const partnerIds = Object.keys(convMap);
    const conversationUsers = partnerIds.length > 0
      ? await User.findAll({
          where: { id: partnerIds },
          attributes: ['id', 'username', 'displayName', 'profilePic', 'bio']
        })
      : [];

    const conversations = conversationUsers.map(u => ({
      user: u,
      lastMessage: convMap[u.id]
    }));

    conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json({ conversations });
  } catch (error) {
    console.error('Conversations error:', error);
    res.json({ conversations: [] });
  }
});

module.exports = router;
