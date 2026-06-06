const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CommunityPost = sequelize.define('CommunityPost', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING(100),
    defaultValue: ''
  },
  comment: {
    type: DataTypes.STRING(100),
    defaultValue: ''
  }
}, {
  timestamps: true
});

module.exports = CommunityPost;
