import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const FailedTweet = sequelize.define(
  'FailedTweet',
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
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
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
    tableName: 'failed_tweets',
    timestamps: true,
  }
);

FailedTweet.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(FailedTweet, { foreignKey: 'userId' });

export default FailedTweet;