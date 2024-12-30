import express from 'express';
import createError from 'http-errors';
import twitterService, { RateLimitError, TwitterApiError } from '../services/twitterService.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import Log from '../models/Log.js';
import sequelize from '../config/database.js';
import {
  startCronJob,
  stopCronJob,
  isCronJobRunning,
} from '../services/schedulerService.js';

const router = express.Router();

function calculateWaitTime(retryCount) {
  const base = 1000; // 1 second
  const maxWait = 15 * 60 * 1000; // 15 minutes
  const waitTime = Math.min(base * Math.pow(2, retryCount), maxWait);
  return waitTime;
}

router.post('/tweet', authMiddleware, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || status.length === 0) {
      throw createError(400, 'Status is required');
    }

    try {
      const tweetData = await twitterService.postTweet(status, req.user.id, { testing : true , isPostTweetModal: true});

      res.json({
        message: 'Tweet posted successfully',
        tweetData,
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to post tweet. It has been saved for retry.',
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/retry-failed-tweets', authMiddleware, async (req, res, next) => {
  try {
    console.log('retry-failed-tweet enter method');
    const userId = req.user.id;

    const failedTweets = await Log.findAll({
      where: {  type: 'failure' },
    });

    const results = [];
    console.log('retry-failed-tweet-count' ,failedTweets.length);
    for (const failedTweet of failedTweets) {
      const MAX_RETRIES = 5;
      // if (failedTweet.retryCount >= MAX_RETRIES) {
      //   continue;
      // }

      try {
        const tweetData = await twitterService.postTweet(failedTweet.status);

        await failedTweet.update({
          type: 'success',
          errorMessage: null,
          errorCode: null,
          retryCount: failedTweet.retryCount + 1,
          lastAttemptedAt: new Date(),
        });

        results.push({
          status: 'success',
          tweetId: tweetData.id,
          logId: failedTweet.id,
        });
      } catch (error) {
        console.log('error upd', error);
        await failedTweet.update({
          errorMessage: error.message,
          errorCode: error.code,
          retryCount: failedTweet.retryCount + 1,
          lastAttemptedAt: new Date(),
        });

        results.push({
          status: 'failed',
          logId: failedTweet.id,
          error: error.message,
        });
      }
    }

    res.json({
      message: 'Retry operation completed',
      results,
    });
  } catch (error) {
    console.log('ashryError', error);
    next(error);
  }
});

router.post('/retry-failed-tweet/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const logId = req.params.id;

    const failedTweet = await Log.findOne({
      where: { id: logId, userId, type: 'failure' },
    });

    if (!failedTweet) {
      return res.status(404).json({ message: 'Failed tweet not found' });
    }

    const MAX_RETRIES = 5;
    if (failedTweet.retryCount >= MAX_RETRIES) {
      return res.status(400).json({ message: 'Max retries exceeded' });
    }

    try {
      const tweetData = await twitterService.postTweet(failedTweet.status);

      await failedTweet.update({
        type: 'success',
        errorMessage: null,
        errorCode: null,
        retryCount: failedTweet.retryCount + 1,
        lastAttemptedAt: new Date(),
      });

      res.json({
        message: 'Failed tweet retried successfully',
        tweetData,
      });
    } catch (error) {
      await failedTweet.update({
        errorMessage: error.message,
        errorCode: error.code,
        retryCount: failedTweet.retryCount + 1,
        lastAttemptedAt: new Date(),
      });

      res.status(500).json({
        message: 'Retry failed',
        error: error.message,
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/resend-successful-tweet/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const logId = req.params.id;
    console.log('ashrylogid',logId );
    const successfulTweet = await Log.findOne({
      where: { id: logId, type: 'success' },
    });


    if (!successfulTweet) {
      return res.status(404).json({ message: 'Successful tweet not found' });
    }

    try {
      console.log('successfulTweetashrysuccessfulTweet.status',successfulTweet.status );
      const tweetData = await twitterService.postTweet(successfulTweet.status);

      await Log.create({
        status: successfulTweet.status,
        type: 'success',
        userId,
        lastAttemptedAt: new Date(),
      });

      res.json({
        message: 'Tweet resent successfully',
        tweetData,
      });
    } catch (error) {

      console.log(error);
      res.status(500).json({
        message: 'Failed to resend tweet',
        error: error.message,
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/successful-tweets', authMiddleware, async (req, res, next) => {
  try {
    // const userId = req.user.id;

    const successfulTweets = await Log.findAll({
      // where: { userId, type: 'success' },
      where: { type: 'success' },
    });

    res.json(successfulTweets);
  } catch (error) {
    next(error);
  }
});

router.get('/failed-tweets', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const failedTweets = await Log.findAll({
      where: { userId, type: 'failure' },
    });

    res.json(failedTweets);
  } catch (error) {
    next(error);
  }
});

router.post('/start-cron', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    startCronJob();
    res.json({ message: 'Cron job started.' });
  } catch (error) {
    next(error);
  }
});

router.post('/stop-cron', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    stopCronJob();
    res.json({ message: 'Cron job stopped.' });
  } catch (error) {
    next(error);
  }
});

router.get('/cron-status', authMiddleware, async (req, res, next) => {
  try {
    const status = isCronJobRunning();
    res.json({ cronRunning: status });
  } catch (error) {
    next(error);
  }
});

export default router;