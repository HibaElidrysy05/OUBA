const { Message, User, Group, GroupMember } = require('../models');

const onlineUsers = new Map();
const disconnectTimers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

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

    socket.on('group-typing', ({ userId, groupId, isTyping }) => {
      const room = 'group:' + groupId;
      socket.to(room).emit('group-typing', { userId, isTyping });
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

        if (callback) callback({ success: true, message: populatedMessage });
      } catch (error) {
        console.error('Send message error:', error);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });

    socket.on('send-group-message', async (data, callback) => {
      try {
        const { groupId, content, fileUrl, fileType, fileName, fileSize, replyToId } = data;

        const message = await Message.create({
          senderId: data.senderId,
          groupId,
          content: content || '',
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          replyTo: replyToId || null
        });

        const populatedMessage = await populateMessage(message);

        const room = 'group:' + groupId;
        io.to(room).emit('new-group-message', populatedMessage);

        const group = await Group.findByPk(groupId, { attributes: ['id', 'name'] });
        const members = await GroupMember.findAll({ where: { groupId } });
        members.forEach(m => {
          if (m.userId !== data.senderId) {
            io.to('user:' + m.userId).emit('new-message-alert', {
              type: 'group',
              groupName: group ? group.name : 'Group',
              sender: populatedMessage.sender,
              content: content || (fileUrl ? 'Sent a file' : ''),
              chatUrl: '/group/' + groupId
            });
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
