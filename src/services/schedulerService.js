import cron from 'node-cron';
import twitterService from './twitterService.js';
import Log from '../models/Log.js';

let failedTweetRetryTask = null;
let isCronRunning = false;

export function startCronJob() {
  if (isCronRunning) {
    console.log('Cron job is already running.');
    return;
  }

  failedTweetRetryTask = cron.schedule('0 * * * *', async () => {
    console.log('Running failed tweet retry task');

    try {
      const failedTweets = await Log.findAll({ where: { type: 'failure' } });

      for (const failedTweet of failedTweets) {
        const MAX_RETRIES = 5;
        if (failedTweet.retryCount >= MAX_RETRIES) {
          continue;
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

          console.log(`Successfully retried failed tweet ID: ${failedTweet.id}`);
        } catch (error) {
          await failedTweet.update({
            errorMessage: error.message,
            errorCode: error.code,
            retryCount: failedTweet.retryCount + 1,
            lastAttemptedAt: new Date(),
          });

          console.log(
            `Failed to retry tweet ID: ${failedTweet.id}. Error: ${error.message}`
          );
        }
      }
    } catch (error) {
      console.error('Error during failed tweet retry task', error);
    }
  });

  isCronRunning = true;
  console.log('Cron job started.');
}

export function stopCronJob() {
  if (failedTweetRetryTask) {
    failedTweetRetryTask.stop();
    failedTweetRetryTask = null;
    isCronRunning = false;
    console.log('Cron job stopped.');
  } else {
    console.log('Cron job is not running.');
  }
}

export function isCronJobRunning() {
  return isCronRunning;
}