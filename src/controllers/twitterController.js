import express from 'express';
import createError from 'http-errors';
import twitterService from '../services/twitterService.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/tweet', authMiddleware, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || status.length === 0) {
      throw createError(400, 'Status is required');
    }

    const tweetData = await twitterService.postTweet(status);
    res.json({
      message: 'Tweet posted successfully',
      tweetData,
    });
  } catch (error) {
    next(error);
  }
});

export default router;