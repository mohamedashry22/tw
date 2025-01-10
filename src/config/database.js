import { Sequelize } from 'sequelize';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://mvp_data_twitter_x_user:hajVDJ8WzpfyW2CMeZcBOHVKDN7h6AAF@dpg-cu0ncq5svqrc73e1nvig-a/mvp_data_twitter_x';

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres', // Explicitly set the dialect
  logging: false, // Disable logging or set to true for debugging
});

export const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

export default sequelize;