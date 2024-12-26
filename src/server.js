import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import sequelize from './config/database.js';
import twitterService from './services/twitterService.js';
import { seedDatabase } from './utils/seedDatabase.js';

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await sequelize.sync({ force: false });

    await seedDatabase();

    await twitterService.initialize();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error during initialization:', error);
  }
})();
