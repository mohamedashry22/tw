import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';

// Special handling for Render.com
const isRender = process.env.RENDER === 'true';
console.log('isRender-ENV', isRender)
const dbPath = isRender 
  ? '/data/database.sqlite'
  : process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace('sqlite:', '')
    : path.resolve('../../database.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

export const initializeDatabase = async () => {
  try {
    // Ensure the data directory exists with correct permissions
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      if (isRender) {
        fs.chmodSync(dbDir, '777');
      }
    }

    // Check if database file exists
    const dbExists = fs.existsSync(dbPath);
    console.log(`Database ${dbExists ? 'exists' : 'does not exist'} at ${dbPath}`);

    if (!dbExists) {
      console.log('Database does not exist. Creating and running migrations...');
      // Create empty file to ensure proper permissions
      fs.writeFileSync(dbPath, '', { flag: 'w' });
      if (isRender) {
        fs.chmodSync(dbPath, '777');
      }
      
      // Force sync to create all tables
      await sequelize.sync({ force: true });
      return { needsSeeding: true };
    }

    // Database exists, just authenticate and run migrations
    try {
      await sequelize.authenticate();
      await sequelize.sync({ alter: true });
      console.log('Database initialized successfully');
      return { needsSeeding: false };
    } catch (error) {
      console.error('Error accessing existing database:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default sequelize;