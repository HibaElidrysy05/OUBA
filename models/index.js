const sequelize = require('../config/db');
const User = require('./User');
const Message = require('./Message');
const FriendRequest = require('./FriendRequest');
const Group = require('./Group');
const GroupMember = require('./GroupMember');

User.hasMany(Message, { as: 'SentMessages', foreignKey: 'senderId' });
User.hasMany(Message, { as: 'ReceivedMessages', foreignKey: 'receiverId' });
Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
Message.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId' });
Message.belongsTo(Message, { as: 'repliedTo', foreignKey: 'replyTo' });

User.hasMany(FriendRequest, { as: 'SentRequests', foreignKey: 'senderId' });
User.hasMany(FriendRequest, { as: 'ReceivedRequests', foreignKey: 'receiverId' });
FriendRequest.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
FriendRequest.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId' });

User.belongsToMany(User, {
  as: 'Friends',
  through: 'UserFriends',
  foreignKey: 'userId',
  otherKey: 'friendId',
  timestamps: false
});

Group.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
User.hasMany(Group, { as: 'CreatedGroups', foreignKey: 'createdBy' });

Group.hasMany(GroupMember, { as: 'members', foreignKey: 'groupId' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId' });

GroupMember.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(GroupMember, { as: 'GroupMemberships', foreignKey: 'userId' });

Group.belongsToMany(User, {
  as: 'Participants',
  through: GroupMember,
  foreignKey: 'groupId',
  otherKey: 'userId'
});

User.belongsToMany(Group, {
  as: 'Groups',
  through: GroupMember,
  foreignKey: 'userId',
  otherKey: 'groupId'
});

Message.belongsTo(Group, { foreignKey: 'groupId' });
Group.hasMany(Message, { as: 'Messages', foreignKey: 'groupId' });

const syncDB = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synchronized');
  } catch (error) {
    console.error('Sync error:', error);
  }
};

module.exports = { User, Message, FriendRequest, Group, GroupMember, syncDB };
