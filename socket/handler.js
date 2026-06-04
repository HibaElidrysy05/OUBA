const Message = require('../models/Message');
const User = require('../models/User');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('user-online', (userId) => {
      onlineUsers.set(userId.toString(), socket.id);
      socket.userId = userId.toString();
      io.emit('user-status', { userId: userId.toString(), status: 'online' });
    });

    socket.on('join-chat', ({ userId, friendId }) => {
      const room = [userId, friendId].sort().join('-');
      socket.join(room);
      socket.currentRoom = room;
    });

    socket.on('typing', ({ userId, friendId, isTyping }) => {
      const room = [userId, friendId].sort().join('-');
      io.to(room).emit('user-typing', { userId, isTyping });
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

        const receiverSocketId = onlineUsers.get(receiverId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('notification', {
            type: 'message',
            from: data.senderId
          });
        }

        if (callback) callback({ success: true, message: populatedMessage });
      } catch (error) {
        console.error('Send message error:', error);
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
        io.emit('user-status', { userId: socket.userId, status: 'offline' });
      }
      console.log('User disconnected:', socket.id);
    });
  });
};
