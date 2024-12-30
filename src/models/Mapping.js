import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Mapping = sequelize.define(
  'Mapping',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    webhookId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    templateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mappingJson: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    alert: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    alertToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'mappings',
    timestamps: true,
  }
);

export default Mapping;