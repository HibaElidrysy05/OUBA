const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const fileUpload = require('express-fileupload');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const auth = require('./middleware/auth');
const socketHandler = require('./socket/handler');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

app.use((req, res, next) => {
  res.locals.currentUser = null;
  if (req.session.userId) {
    const User = require('./models/User');
    User.findById(req.session.userId).select('username displayName profilePic bio')
      .then(user => {
        res.locals.currentUser = user;
        next();
      })
      .catch(() => next());
  } else {
    next();
  }
});

app.use('/', require('./routes/auth'));

app.get('/', auth, async (req, res) => {
  try {
    const User = require('./models/User');
    const user = await User.findById(req.session.userId)
      .populate('friends', 'username displayName profilePic bio');

    const Message = require('./models/Message');
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: req.session.userId }, { receiver: req.session.userId }]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.session.userId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', req.session.userId] }, { $ne: ['$read', true] }] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    const conversationUsers = await User.find({
      _id: { $in: messages.map(m => m._id) }
    }).select('username displayName profilePic bio');

    const conversations = messages.map(m => {
      const u = conversationUsers.find(
        usr => usr._id.toString() === m._id.toString()
      );
      return { user: u, lastMessage: m.lastMessage, unreadCount: m.unreadCount };
    }).filter(c => c.user);

    const pendingCount = user.friendRequests.filter(fr => fr.status === 'pending').length;

    res.render('dashboard', {
      title: 'Dashboard - Ouba',
      user,
      friends: user.friends,
      conversations,
      pendingCount
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/login');
  }
});

app.use('/', require('./routes/users'));
app.use('/', require('./routes/messages'));
app.use('/upload', require('./routes/upload'));

socketHandler(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Ouba server running on port ${PORT}`);
});
