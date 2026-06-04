const { Message, User, Group, GroupMember } = require('../models');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('user-online', (userId) => {
      onlineUsers.set(userId.toString(), socket.id);
      socket.userId = userId.toString();
      socket.join('global');
      socket.join('user:' + userId.toString());
      const onlineArray = Array.from(onlineUsers.keys());
      socket.emit('initial-status', onlineArray);
      socket.to('global').emit('user-status', { userId: userId.toString(), status: 'online' });
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

    socket.on('send-message', async (data, callback) => {
      try {
        const { receiverId, content, fileUrl, fileType, fileName, fileSize } = data;

        const message = await Message.create({
          senderId: data.senderId,
          receiverId,
          content: content || '',
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileName: fileName || null,
          fileSize: fileSize || null
        });

        const populatedMessage = await Message.findByPk(message.id, {
          include: [
            { association: 'sender', attributes: ['id', 'username', 'displayName', 'profilePic'] }
          ]
        });

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
        const { groupId, content, fileUrl, fileType, fileName, fileSize } = data;

        const message = await Message.create({
          senderId: data.senderId,
          groupId,
          content: content || '',
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileName: fileName || null,
          fileSize: fileSize || null
        });

        const populatedMessage = await Message.findByPk(message.id, {
          include: [
            { association: 'sender', attributes: ['id', 'username', 'displayName', 'profilePic'] }
          ]
        });

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

    socket.on('mark-read', async ({ messageIds }) => {
      try {
        await Message.update(
          { read: true },
          { where: { id: messageIds } }
        );
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.to('global').emit('user-status', { userId: socket.userId, status: 'offline' });
      }
      console.log('User disconnected:', socket.id);
    });
  });
};
