import { TwitterApi } from 'twitter-api-v2';
import { createLogger } from '../utils/logger.js';
import configurationService from './configurationService.js';

const logger = createLogger('TwitterService');

class TwitterService {
  constructor() {
    this.twitterClient = null;
  }

  async initialize() {
    const apiKey = await configurationService.get('TWITTER_API_KEY');
    const apiSecret = await configurationService.get('TWITTER_API_SECRET');
    const accessToken = await configurationService.get('TWITTER_ACCESS_TOKEN');
    const accessSecret = await configurationService.get('TWITTER_ACCESS_SECRET');

    const appKey = apiKey || process.env.TWITTER_API_KEY;
    const appSecret = apiSecret || process.env.TWITTER_API_SECRET;
    const userAccessToken = accessToken || process.env.TWITTER_ACCESS_TOKEN;
    const userAccessSecret = accessSecret || process.env.TWITTER_ACCESS_SECRET;
    console.log('appKey', appKey)
    if (!appKey || !appSecret || !userAccessToken || !userAccessSecret) {
      throw new Error(
        'Twitter API credentials are not set in the database or environment variables.'
      );
    }

    this.twitterClient = new TwitterApi({
      appKey,
      appSecret,
      accessToken: userAccessToken,
      accessSecret: userAccessSecret,
    });

    logger.info('TwitterService initialized.');
  }

  async postTweet(status) {
    if (!this.twitterClient) {
      throw new Error('TwitterService is not initialized.');
    }

    try {
      const { data } = await this.twitterClient.v2.tweet(status);
      logger.info(`Tweet posted successfully: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error posting tweet', error);
      throw error;
    }
  }
}

export default new TwitterService();