import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('sqlite:', '')
  : path.resolve('../../database.sqlite');

const databaseExists = fs.existsSync(dbPath);

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

export const initializeDatabase = async () => {
  try {
    if (databaseExists) {
      console.log('Database already exists. Skipping migrations.');
      await sequelize.authenticate(); 
    } else {
      console.log('Database does not exist. Creating and running migrations...');
      await sequelize.sync({ force: false });
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default sequelize;