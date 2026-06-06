const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const FeatureFlag = sequelize.define('FeatureFlag', {
  key: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    allowNull: false
  },
  value: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  timestamps: true
});

module.exports = FeatureFlag;
