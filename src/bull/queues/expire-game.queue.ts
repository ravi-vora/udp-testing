import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { showError } from '../../helpers/logger.helper.js';
import { expireGameJob } from '../jobs/expire-game.job.js';
import { LOG } from '../../helpers/utils.helper.js';

var redisConfiguration: Bull.QueueOptions = {
  redis: {
    port: parseInt(redisConfig.port),
    host: redisConfig.host,
    password: redisConfig.password,
    db: parseInt(redisConfig.database_number),
  },
};

const expireGameQueue = new Bull(
  CONSTANTS.BULL.GAME_OVER_TIMER,
  redisConfiguration,
);

expireGameQueue.process(expireGameJob);

export const getExpireGameQueue = Bull(
  CONSTANTS.BULL.GAME_OVER_TIMER,
  redisConfiguration,
);

export const ExpireGameQueueStart = async (data: {
  gameId: string;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Started ExpireGameQueue :: (',
        new Date() + ') for gameId :: [' + data.gameId + ']',
      );

      const options: Bull.JobOptions = {
        jobId: data.gameId,
        delay: CONSTANTS.GAME.GAME_TIME_LIMIT * 60 * 1000,
        backoff: CONSTANTS.GAME.GAME_TIME_LIMIT * 60 * 1000,
        attempts: 0,
        removeOnComplete: true
      };
      await expireGameQueue.add(data, options);
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const ExpireGameQueueEnd = async (gameId: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Ended ExpireGameQueue :: (',
        new Date() + ') for gameId :: [' + gameId + ']',
      );

      let job = await getExpireGameQueue.getJob(gameId);
      if (job) {
        console.log('found and ended - runningGameTimer');
        await job.remove();
      } else {
        console.log(
          '????????????????? did not found and ended - runningGameTimer',
        );
      }
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};

expireGameQueue.on('completed', (job, result) => {
  console.log('Expire Game timer job completed :: ', job.data);
});

expireGameQueue.on('failed', (job, err) => {
  console.log('Expire Game job failed :: ', err.message);
  console.error(err);
});
