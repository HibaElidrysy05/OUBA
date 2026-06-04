const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const FriendRequest = sequelize.define('FriendRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'pending'
  }
}, {
  timestamps: true
});

module.exports = FriendRequest;
