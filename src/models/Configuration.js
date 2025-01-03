import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Configuration = sequelize.define(
  'Configuration',
  {
    id: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'configurations',
    timestamps: true,
  }
);

export default Configuration;