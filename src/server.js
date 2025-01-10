import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import sequelize, { initializeDatabase } from './config/database.js';
import twitterService from './services/twitterService.js';
import { seedDatabase } from './utils/seedDatabase.js';

const PORT = process.env.PORT || 6000;

(async () => {
  try {
    console.log('Starting server initialization...');
    
    // Initialize database and check if seeding is needed
    const { needsSeeding } = await initializeDatabase();

    // Only seed if the database was newly created
    if (needsSeeding) {
      console.log('New database detected, running seeds...');
      await seedDatabase();
    }

    await twitterService.initialize();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error during initialization:', error);
    process.exit(1);
  }
})();