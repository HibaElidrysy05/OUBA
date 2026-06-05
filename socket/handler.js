const { Message, User, Group, GroupMember, PushSubscription } = require('../models');
const { webpush } = require('../config/push');

const onlineUsers = new Map();
const disconnectTimers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    async function sendPush(userId, title, body, url) {
      try {
        const subs = await PushSubscription.findAll({ where: { userId } });
        for (const sub of subs) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { auth: sub.auth, p256dh: sub.p256dh }
            }, JSON.stringify({ title, body, url }));
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await sub.destroy();
            }
          }
        }
      } catch (err) {
        console.error('Push send error:', err);
      }
    }

    socket.on('user-online', (userId) => {
      const uid = userId.toString();
      if (disconnectTimers.has(uid)) {
        clearTimeout(disconnectTimers.get(uid));
        disconnectTimers.delete(uid);
      }
      onlineUsers.set(uid, socket.id);
      socket.userId = uid;
      socket.join('global');
      socket.join('user:' + uid);
      const onlineArray = Array.from(onlineUsers.keys());
      socket.emit('initial-status', onlineArray);
      socket.to('global').emit('user-status', { userId: uid, status: 'online' });
    });

    socket.on('join-chat', ({ userId, friendId }) => {
      const room = [userId, friendId].sort().join('-');
      socket.join(room);
      socket.currentRoom = room;
    });

    socket.on('join-group', (groupId) => {
      const room = 'group:' + groupId;
      socket.join(room);
      socket.currentRoom = room;
    });

    socket.on('typing', ({ userId, friendId, isTyping }) => {
      const room = [userId, friendId].sort().join('-');
      io.to(room).emit('user-typing', { userId, isTyping });
    });

    socket.on('group-typing', ({ userId, groupId, name, isTyping }) => {
      const room = 'group:' + groupId;
      socket.to(room).emit('group-typing', { userId, name, isTyping });
    });

    async function populateMessage(message) {
      return await Message.findByPk(message.id, {
        include: [
          { association: 'sender', attributes: ['id', 'username', 'displayName', 'profilePic'] },
          {
            association: 'repliedTo',
            attributes: ['id', 'content', 'fileUrl', 'fileType', 'fileName', 'senderId'],
            include: [{ association: 'sender', attributes: ['id', 'username', 'displayName'] }]
          }
        ]
      });
    }

    socket.on('send-message', async (data, callback) => {
      try {
        const { receiverId, content, fileUrl, fileType, fileName, fileSize, replyToId } = data;

        const message = await Message.create({
          senderId: data.senderId,
          receiverId,
          content: content || '',
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          replyTo: replyToId || null
        });

        const populatedMessage = await populateMessage(message);

        const room = [data.senderId, receiverId].sort().join('-');
        io.to(room).emit('new-message', populatedMessage);

        io.to('user:' + receiverId).emit('new-message-alert', {
          type: 'dm',
          sender: populatedMessage.sender,
          content: content || (fileUrl ? 'Sent a file' : ''),
          chatUrl: '/chat/' + data.senderId
        });

        const receiverSockets = await io.in('user:' + receiverId).fetchSockets();
        if (receiverSockets.length === 0) {
          const senderName = populatedMessage.sender.displayName || populatedMessage.sender.username;
          sendPush(receiverId, 'Ouba - ' + senderName, content || (fileUrl ? 'Sent a file' : ''), '/chat/' + data.senderId);
        }

        if (callback) callback({ success: true, message: populatedMessage });
      } catch (error) {
        console.error('Send message error:', error);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });

    socket.on('send-group-message', async (data, callback) => {
      try {
        const { groupId, content, fileUrl, fileType, fileName, fileSize, replyToId } = data;

        const contentText = content || '';
        const mentionRegex = /@(\w+)/g;
        const mentionedUsernames = [];
        let match;
        while ((match = mentionRegex.exec(contentText)) !== null) {
          mentionedUsernames.push(match[1].toLowerCase());
        }

        let mentionIds = [];
        if (mentionedUsernames.length > 0) {
          const members = await GroupMember.findAll({
            where: { groupId },
            include: [{ association: 'user', attributes: ['id', 'username'] }]
          });
          const mentionedUsers = members.filter(m =>
            m.user && mentionedUsernames.includes(m.user.username.toLowerCase())
          );
          mentionIds = mentionedUsers.map(m => m.user.id);
        }

        const message = await Message.create({
          senderId: data.senderId,
          groupId,
          content: contentText,
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          replyTo: replyToId || null,
          mentions: mentionIds
        });

        const populatedMessage = await populateMessage(message);

        const room = 'group:' + groupId;
        io.to(room).emit('new-group-message', populatedMessage);

        const group = await Group.findByPk(groupId, { attributes: ['id', 'name'] });
        const allMembers = await GroupMember.findAll({ where: { groupId } });
        allMembers.forEach(async m => {
          if (m.userId !== data.senderId) {
            io.to('user:' + m.userId).emit('new-message-alert', {
              type: 'group',
              groupName: group ? group.name : 'Group',
              sender: populatedMessage.sender,
              content: content || (fileUrl ? 'Sent a file' : ''),
              chatUrl: '/group/' + groupId,
              mentioned: mentionIds.includes(m.userId)
            });
            const memberSockets = await io.in('user:' + m.userId).fetchSockets();
            if (memberSockets.length === 0) {
              const senderName = populatedMessage.sender.displayName || populatedMessage.sender.username;
              const groupName = group ? group.name : 'Group';
              const pushBody = mentionIds.includes(m.userId)
                ? senderName + ' mentioned you in ' + groupName
                : (content || (fileUrl ? 'Sent a file' : ''));
              sendPush(m.userId, 'Ouba - ' + groupName, pushBody, '/group/' + groupId);
            }
          }
        });

        if (callback) callback({ success: true, message: populatedMessage });
      } catch (error) {
        console.error('Send group message error:', error);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });

    socket.on('react-to-message', async ({ messageId, emoji, userId, roomType, roomId }) => {
      try {
        const message = await Message.findByPk(messageId);
        if (!message) return;

        const reactions = message.reactions || {};
        if (!reactions[emoji]) reactions[emoji] = [];

        const idx = reactions[emoji].indexOf(userId);
        if (idx === -1) {
          reactions[emoji].push(userId);
        } else {
          reactions[emoji].splice(idx, 1);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        }

        await message.update({ reactions });

        const room = roomType === 'group' ? 'group:' + roomId : [userId, roomId].sort().join('-');
        io.to(room).emit('message-reacted', { messageId, reactions, userId, emoji });
      } catch (error) {
        console.error('React error:', error);
      }
    });

    socket.on('mark-read', async ({ messageIds }) => {
      try {
        const messages = await Message.findAll({
          where: { id: messageIds },
          attributes: ['id', 'senderId']
        });

        await Message.update(
          { read: true },
          { where: { id: messageIds } }
        );

        const bySender = {};
        messages.forEach(m => {
          if (!bySender[m.senderId]) bySender[m.senderId] = [];
          bySender[m.senderId].push(m.id);
        });
        Object.keys(bySender).forEach(senderId => {
          io.to('user:' + senderId).emit('messages-read', bySender[senderId]);
        });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        const uid = socket.userId;
        if (disconnectTimers.has(uid)) clearTimeout(disconnectTimers.get(uid));
        disconnectTimers.set(uid, setTimeout(() => {
          onlineUsers.delete(uid);
          disconnectTimers.delete(uid);
          io.to('global').emit('user-status', { userId: uid, status: 'offline' });
        }, 5000));
      }
      console.log('User disconnected:', socket.id);
    });

    socket.on('delete-message', async ({ messageId, userId, roomType, roomId }) => {
      try {
        const message = await Message.findByPk(messageId);
        if (!message) return;

        const user = await User.findByPk(userId, { attributes: ['role'] });
        const isAdmin = user && user.role === 'admin';
        if (message.senderId !== userId && !isAdmin) return;

        await message.destroy();

        const room = roomType === 'group' ? 'group:' + roomId : [userId, roomId].sort().join('-');
        io.to(room).emit('message-deleted', { messageId });
      } catch (error) {
        console.error('Delete message error:', error);
      }
    });
  });
};
