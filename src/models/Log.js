import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const Log = sequelize.define(
  'Log',
  {
    id: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    status: {
      type: DataTypes.STRING(280),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('success', 'failure'),
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    errorCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastAttemptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'logs',
    timestamps: true,
  }
);

Log.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Log, { foreignKey: 'userId' });

export default Log;