import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Configuration = sequelize.define(
  'Configuration',
  {
    key: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'configurations',
    timestamps: false,
  }
);

export default Configuration;