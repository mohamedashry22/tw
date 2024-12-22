import express from 'express';
import User from '../models/User.js';
import createError from 'http-errors';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      throw createError(400, 'Username, email, and password are required');
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw createError(400, 'Email is already registered');
    }

    await User.create({
      username,
      email,
      passwordHash: password,
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw createError(400, 'Email and password are required');
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw createError(400, 'Invalid email or password');
    }

    const isValid = await user.validPassword(password);
    if (!isValid) {
      throw createError(400, 'Invalid email or password');
    }

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '90d' } 
    );

    res
      .cookie('accessToken', accessToken, {
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV === 'production', 
      })
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        maxAge: 90 * 24 * 60 * 60 * 1000, 
        sameSite: 'Strict',
        secure: process.env.NODE_ENV === 'production',
      })
      .json({ message: 'Login successful' });
  } catch (error) {
    next(error);
  }
});


router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      throw createError(401, 'Refresh token not found');
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, payload) => {
      if (err) {
        return next(createError(401, 'Invalid refresh token'));
      }

      const userId = payload.userId;

      const newAccessToken = jwt.sign(
        { userId },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      res
        .cookie('accessToken', newAccessToken, {
          httpOnly: true,
          maxAge: 15 * 60 * 1000,
          sameSite: 'Strict',
          secure: process.env.NODE_ENV === 'production',
        })
        .json({ message: 'Access token refreshed' });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    res
      .clearCookie('accessToken', {
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV === 'production',
      })
      .clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV === 'production',
      })
      .json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;