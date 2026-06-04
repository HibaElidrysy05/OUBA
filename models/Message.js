const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  content: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  fileUrl: {
    type: DataTypes.STRING,
    defaultValue: null
  },
  fileType: {
    type: DataTypes.STRING,
    defaultValue: null
  },
  fileName: {
    type: DataTypes.STRING,
    defaultValue: null
  },
  fileSize: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

module.exports = Message;
