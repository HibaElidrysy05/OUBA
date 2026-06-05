const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PushSubscription = sequelize.define('PushSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  auth: {
    type: DataTypes.STRING,
    allowNull: false
  },
  p256dh: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = PushSubscription;
