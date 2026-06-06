const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const fileUpload = require('express-fileupload');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { Op } = require('sequelize');
require('dotenv').config();

const sequelize = require('./config/db');
const { connectDB } = require('./config/db');
const { User, Message, syncDB } = require('./models');
const auth = require('./middleware/auth');
const socketHandler = require('./socket/handler');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/health', (req, res) => res.send('OK'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  abortOnLimit: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'ouba_secret_key',
  resave: false,
  saveUninitialized: false,
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true
  }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

app.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.locals.currentUser = null;
  res.locals.flags = {};
  try {
    const FeatureFlag = require('./models/FeatureFlag');
    const allFlags = await FeatureFlag.findAll();
    const strMap = {};
    allFlags.forEach(f => {
      res.locals.flags[f.key] = f.value;
      if (f.stringValue) strMap[f.key] = f.stringValue;
    });
    res.locals.flagsString = strMap;
  } catch (_) {}
  if (req.session.userId) {
    const user = await User.findByPk(req.session.userId, {
      attributes: ['id', 'username', 'displayName', 'profilePic', 'bio', 'role', 'gender']
    });
    if (user) {
      res.locals.currentUser = user;
      const Message = require('./models/Message');
      const GroupMember = require('./models/GroupMember');
      const { Op } = require('sequelize');

      const dmUnread = await Message.count({
        where: { receiverId: user.id, read: false, groupId: null }
      });

      const memberships = await GroupMember.findAll({
        where: { userId: user.id },
        attributes: ['groupId', 'lastReadAt']
      });
      let groupUnread = 0;
      for (const m of memberships) {
        const cnt = await Message.count({
          where: {
            groupId: m.groupId,
            senderId: { [Op.ne]: user.id },
            createdAt: { [Op.gt]: m.lastReadAt }
          }
        });
        groupUnread += cnt;
      }
      res.locals.dmUnread = dmUnread;
      res.locals.groupUnread = groupUnread;
    }
  }
  next();
});

app.use('/', require('./routes/auth'));

app.get('/api/conversations', auth, async (req, res) => {
  try {
    const allMessages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.session.userId },
          { receiverId: req.session.userId }
        ],
        groupId: null
      },
      order: [['createdAt', 'DESC']]
    });

    const convMap = {};
    for (const msg of allMessages) {
      const partnerId = msg.senderId === req.session.userId ? msg.receiverId : msg.senderId;
      if (!partnerId) continue;
      if (!convMap[partnerId]) {
        convMap[partnerId] = { lastMessage: msg, unreadCount: 0 };
      }
      if (msg.receiverId === req.session.userId && !msg.read) {
        convMap[partnerId].unreadCount += 1;
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
      lastMessage: convMap[u.id].lastMessage,
      unreadCount: convMap[u.id].unreadCount
    }));
    conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json({ conversations });
  } catch (error) {
    res.json({ conversations: [] });
  }
});

app.get('/', auth, async (req, res) => {
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
          include: [{ association: 'sender', attributes: ['id', 'username', 'displayName', 'profilePic'] }]
        }
      ]
    });

    const allMessages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.session.userId },
          { receiverId: req.session.userId }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    const convMap = {};
    for (const msg of allMessages) {
      const partnerId = msg.senderId === req.session.userId ? msg.receiverId : msg.senderId;
      if (!partnerId) continue;
      if (!convMap[partnerId]) {
        convMap[partnerId] = { lastMessage: msg, unreadCount: 0 };
      }
      if (msg.receiverId === req.session.userId && !msg.read) {
        convMap[partnerId].unreadCount += 1;
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
      lastMessage: convMap[u.id].lastMessage,
      unreadCount: convMap[u.id].unreadCount
    }));

    conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    const Friends = user.Friends || [];
    const pendingRequests = (user.ReceivedRequests || []).filter(r => r.status === 'pending');

    res.render('dashboard', {
      title: 'Dashboard - Ouba',
      user,
      friends: Friends,
      conversations,
      pendingCount: pendingRequests.length
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/login');
  }
});

app.use('/', require('./routes/users'));
app.use('/', require('./routes/messages'));
app.use('/', require('./routes/groups'));
app.use('/upload', require('./routes/upload'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/map'));
app.use('/', require('./routes/push'));
app.use('/', require('./routes/community'));

app.get('/api/debug/group-messages/:id', auth, async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { groupId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [{ association: 'sender', attributes: ['id', 'username', 'displayName'] }]
    });
    res.json({ count: messages.length, messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

socketHandler(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  await syncDB();
  const adminCount = await User.count({ where: { role: 'admin' } });
  if (adminCount === 0) {
    const firstUser = await User.findOne({ order: [['createdAt', 'ASC']] });
    if (firstUser) {
      firstUser.role = 'admin';
      await firstUser.save();
      console.log('First user promoted to admin');
    }
  }
  console.log(`Ouba server running on port ${PORT}`);
});
