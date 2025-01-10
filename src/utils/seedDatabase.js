import User from '../models/User.js';
import Configuration from '../models/Configuration.js';

export async function seedDatabase() {
  try {

    const count = await User.count();
    if (count > 0) {
      console.log('Database already seeded. Skipping seed operation.');
      return;
    } 
    
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      await User.create({
        username: 'admin',
        email: 'admin@admin.com',
        passwordHash: 'admin',
        role: 'admin',
      });
      console.log('Admin user created');
    }

    const normalUser = await User.findOne({ where: { username: 'user' } });
    if (!normalUser) {
      await User.create({
        username: 'user',
        email: 'user@user.com',
        passwordHash: 'user',
        role: 'user',
      });
      console.log('Normal user created');
    }
  } catch (error) {
    console.error('Error during database seeding:', error);
    throw error;
  }
}