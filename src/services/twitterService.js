import { TwitterApi } from 'twitter-api-v2';
import { createLogger } from '../utils/logger.js';
import Bottleneck from 'bottleneck';
import Configuration from '../models/Configuration.js';
import sequelize from '../config/database.js';
import Log from '../models/Log.js'

const logger = createLogger('TwitterService');

const limiter = new Bottleneck({
  reservoir: 300,
  reservoirRefreshAmount: 300,
  reservoirRefreshInterval: 15 * 60 * 1000,
  minTime: 1000,
});

class TwitterService {
  constructor() {
    this.twitterClient = null;
  }

  async initialize() {
    try {
      let apiKey = await this.getConfiguration('TWITTER_API_KEY');
      let apiSecret = await this.getConfiguration('TWITTER_API_SECRET');
      let accessToken = await this.getConfiguration('TWITTER_ACCESS_TOKEN');
      let accessSecret = await this.getConfiguration('TWITTER_ACCESS_SECRET');

      const missingKeys = [];

      if (!apiKey) {
        apiKey = process.env.TWITTER_API_KEY;
        if (apiKey) {
          await this.setConfiguration('TWITTER_API_KEY', apiKey);
        } else {
          missingKeys.push('TWITTER_API_KEY');
        }
      }

      if (!apiSecret) {
        apiSecret = process.env.TWITTER_API_SECRET;
        if (apiSecret) {
          await this.setConfiguration('TWITTER_API_SECRET', apiSecret);
        } else {
          missingKeys.push('TWITTER_API_SECRET');
        }
      }

      if (!accessToken) {
        accessToken = process.env.TWITTER_ACCESS_TOKEN;
        if (accessToken) {
          await this.setConfiguration('TWITTER_ACCESS_TOKEN', accessToken);
        } else {
          missingKeys.push('TWITTER_ACCESS_TOKEN');
        }
      }

      if (!accessSecret) {
        accessSecret = process.env.TWITTER_ACCESS_SECRET;
        if (accessSecret) {
          await this.setConfiguration('TWITTER_ACCESS_SECRET', accessSecret);
        } else {
          missingKeys.push('TWITTER_ACCESS_SECRET');
        }
      }

      if (missingKeys.length > 0) {
        throw new Error(`Missing Twitter API credentials: ${missingKeys.join(', ')}`);
      }

      this.twitterClient = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });

      logger.info('Twitter client initialized');
    } catch (error) {
      logger.error('Error initializing Twitter client', error);
      throw error;
    }
  }

  async getConfiguration(key) {
    const config = await Configuration.findOne({ where: { key } });
    return config ? config.value : null;
  }

  async setConfiguration(key, value) {
    await Configuration.upsert({ key, value });
  }

  async postTweet(status, userId, eventData = null) {
    const transaction = await sequelize.transaction();
    try {
      await this.initialize();
      const { data } = await limiter.schedule(() =>
        this.twitterClient.v2.tweet(status)
      );
      await Log.create({
        status,
        type: 'success',
        userId,
        eventData,
        lastAttemptedAt: new Date(),
      }, { transaction });

      await transaction.commit();
      logger.info(`Tweet posted successfully: ${data.id}`);
      return data;
    } catch (error) {
      console.log('ashryLOgerror',error);
      logger.error('Error posting tweet', error);

      await Log.create({
        status,
        type: 'failure',
        errorMessage: error.message,
        errorCode: error.code,
        userId,
        eventData,
        retryCount: 0,
        lastAttemptedAt: new Date(),
      }, { transaction });

      await transaction.commit();

      if (
        error.code === 429 ||
        error.data?.errors?.[0]?.code === 88 ||
        error.message.includes('rate limit')
      ) {
        throw new RateLimitError('Rate limit exceeded', error);
      }

      throw new TwitterApiError(error.message, error);
    }
  }
}

class RateLimitError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'RateLimitError';
    if (originalError) {
      this.code = originalError.code;
      this.status = originalError.data?.status;
      this.headers = originalError.headers;
    }
  }
}

class TwitterApiError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'TwitterApiError';
    if (originalError) {
      this.code = originalError.code;
      this.status = originalError.data?.status;
    }
  }
}

export default new TwitterService();
export { RateLimitError, TwitterApiError };