import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { showError } from '../../helpers/logger.helper.js';
import { expireSoonGameJob } from '../jobs/expire-soon-game.job.js';
import { LOG } from '../../helpers/utils.helper.js';

var redisConfiguration: Bull.QueueOptions = {
  redis: {
    port: parseInt(redisConfig.port),
    host: redisConfig.host,
    password: redisConfig.password,
    db: parseInt(redisConfig.database_number),
  },
};

const expireSoonGameQueue = new Bull(
  CONSTANTS.BULL.GAME_EXPIRED_SOON_TIMER,
  redisConfiguration,
);

expireSoonGameQueue.process(expireSoonGameJob);

export const getExpireSoonGameQueue = Bull(
  CONSTANTS.BULL.GAME_EXPIRED_SOON_TIMER,
  redisConfiguration,
);

export const ExpireSoonGameQueueStart = async (data: {
  gameId: string;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Started ExpireSoonGameQueue :: (',
        new Date() + ') for gameId :: [' + data.gameId + ']',
      );

      const options: Bull.JobOptions = {
        jobId: data.gameId,
        delay: CONSTANTS.GAME.GAME_TIME_LIMIT * 60 * 1000 - 35000,
        backoff: CONSTANTS.GAME.GAME_TIME_LIMIT * 60 * 1000 - 35000,
        attempts: 0,
        removeOnComplete: true
      };
      await expireSoonGameQueue.add(data, options);
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const ExpireSoonGameQueueEnd = async (gameId: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Ended ExpireSoonGameQueue :: (',
        new Date() + ') for gameId :: [' + gameId + ']',
      );

      let job = await getExpireSoonGameQueue.getJob(gameId);
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

expireSoonGameQueue.on('completed', (job, result) => {
  console.log('Expire Soon Game timer job completed :: ', job.data);
});

expireSoonGameQueue.on('failed', (job, err) => {
  console.log('Expire Soon Game job failed :: ', err.message);
  console.error(err);
});
