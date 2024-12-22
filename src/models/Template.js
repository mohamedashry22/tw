import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Template = sequelize.define(
  'Template',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'templates',
    timestamps: true,
  }
);

export default Template;