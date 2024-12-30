import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EventData = sequelize.define(
  'EventData',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    data: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    price: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    eventName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'events',
    timestamps: true,
  }
);

export default EventData;