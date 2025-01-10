import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('sqlite:', '')
  : path.resolve('../../database.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

export const initializeDatabase = async () => {
  try {
    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Check if database needs initialization
    const needsInit = !fs.existsSync(dbPath);
    
    if (needsInit) {
      console.log('Database does not exist. Creating and running migrations...');
      await sequelize.sync({ force: true }); // Use force: true only for initial setup
    } else {
      console.log('Database exists. Checking connection...');
      await sequelize.authenticate();
      
      // Optionally run migrations for schema updates
      await sequelize.sync({ alter: true });
    }
    
    return needsInit; // Return whether initialization was needed
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default sequelize;