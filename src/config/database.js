import { Sequelize } from 'sequelize';

const isRender = process.env.RENDER === 'true';

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Disable logging for cleaner output
  dialectOptions: {
    ssl: isRender // Enable SSL only on Render
      ? { require: true, rejectUnauthorized: false }
      : false,
  },
});

export const initializeDatabase = async () => {
  try {
    console.log('Starting database initialization...');
    await sequelize.authenticate();
    console.log('Database connection authenticated');

    // Synchronize models with the database
    await sequelize.sync({ alter: true });
    console.log('Database synchronization completed');

    return { needsSeeding: false }; // Adjust as needed
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default sequelize;