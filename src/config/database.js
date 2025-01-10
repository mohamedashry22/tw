import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';

const isRender = process.env.RENDER === 'true';
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
    console.log('Starting database initialization...');
    console.log('Database path:', dbPath);

    const dbDir = path.dirname(dbPath);
    console.log('Database directory:', dbDir);

    // Check if database directory exists
    if (!fs.existsSync(dbDir)) {
      console.log(`Directory ${dbDir} does not exist`);
      try {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`Created directory ${dbDir}`);
      } catch (err) {
        console.error(`Failed to create directory: ${err.message}`);
        // If we can't create the directory, try to use a fallback location
        const fallbackDir = path.resolve(process.cwd(), 'data');
        console.log(`Attempting to use fallback directory: ${fallbackDir}`);
        fs.mkdirSync(fallbackDir, { recursive: true });
        sequelize.options.storage = path.join(fallbackDir, 'database.sqlite');
      }
    }

    // Check if we can write to the directory
    try {
      const testFile = path.join(dbDir, '.write-test');
      fs.writeFileSync(testFile, '');
      fs.unlinkSync(testFile);
      console.log('Write permission test passed');
    } catch (err) {
      console.error(`Write permission test failed: ${err.message}`);
      throw new Error('Cannot write to database directory');
    }

    // Database initialization
    const dbExists = fs.existsSync(dbPath);
    console.log(`Database ${dbExists ? 'exists' : 'does not exist'}`);

    await sequelize.authenticate();
    console.log('Database connection authenticated');

    if (!dbExists) {
      console.log('Creating new database...');
      await sequelize.sync({ force: true });
      console.log('Database created successfully');
      return { needsSeeding: true };
    } else {
      console.log('Running migrations...');
      await sequelize.sync({ alter: true });
      console.log('Migrations completed');
      return { needsSeeding: false };
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default sequelize;