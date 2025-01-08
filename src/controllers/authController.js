import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import createError from 'http-errors';
import { Op } from 'sequelize';

const router = express.Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    console.log('signup Trace',username, email, password, role )
    const user = await User.create({
      username,
      email,
      passwordHash: password,
      role: role || 'admin',
    });

    res.json({
      message: 'Signup successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.log('error in signup', error);
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password , username} = req.body;

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // const user = await User.findOne({ where: { email } });


    const query = {};
    if (isEmail) {
      query.email = email;
    } else {
      query.username = email;
    }

    const user = await User.findOne({
      where: {
        [Op.or]: Object.keys(query).map(key => ({ [key]: query[key] }))
      }
    });
    

    if (!user || !(await user.validatePassword(password))) {
      throw createError(401, 'Invalid email or password');
    }
    
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '90d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '180d' }
    );

    const thirtyDaysInMilliseconds = 90 * 24 * 60 * 60 * 1000;
    const nintyDaysInMilliseconds = 180 * 24 * 60 * 60 * 1000;

    console.log('domain: process.env.FRONTEND_URL authController', process.env.FRONTEND_URL);

    res
  .status(200)
  .cookie("accessToken", accessToken, {
    httpOnly: true, 
    secure: true,
    sameSite: "None",
    maxAge: thirtyDaysInMilliseconds,
    expires: new Date(Date.now() + thirtyDaysInMilliseconds), 
    domain: process.env.FRONTEND_URL
      ? new URL(process.env.FRONTEND_URL).hostname
      : undefined,
  })
  .cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: nintyDaysInMilliseconds,
    expires: new Date(Date.now() + nintyDaysInMilliseconds),
    domain: "twitter-mvp-dashboard.onrender.com",
  })
  .json({
    message: "Login successful",
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
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

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, payload) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(createError(401, 'Refresh token expired'));
        } else {
          return next(createError(401, 'Invalid refresh token'));
        }
      }

      const user = await User.findByPk(payload.userId);
      if (!user) {
        return next(createError(401, 'User not found'));
      }

      const newAccessToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '90d' }
      );

      const newRefreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '180d' }
      );

      res
        .cookie('accessToken', newAccessToken, { httpOnly: true })
        .cookie('refreshToken', newRefreshToken, { httpOnly: true })
        .json({ message: 'Token refreshed successfully' });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res) => {
  res
    .clearCookie('accessToken')
    .clearCookie('refreshToken')
    .json({ message: 'Logout successful' });
});

export default router;
