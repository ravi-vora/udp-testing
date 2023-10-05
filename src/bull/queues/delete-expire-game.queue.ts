import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { showError } from '../../helpers/logger.helper.js';
import { deleteExpireGameJob } from '../jobs/delete-expire-game.job.js';

var redisConfiguration: Bull.QueueOptions = {
  redis: {
    port: parseInt(redisConfig.port),
    host: redisConfig.host,
    password: redisConfig.password,
    db: parseInt(redisConfig.database_number),
  },
};

const deleteExpireGameQueue = new Bull(
  CONSTANTS.BULL.DELETE_EXPIRE_GAME,
  redisConfiguration,
);

deleteExpireGameQueue.process(deleteExpireGameJob);

export const getDeleteExpireGameQueue = Bull(
  CONSTANTS.BULL.DELETE_EXPIRE_GAME,
  redisConfiguration,
);

export const DeleteExpireGameQueueStart = async (data: {
  gameId: string;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Started DeleteExpireGameQueue :: (',
        new Date() + ') for gameId :: [' + data.gameId + ']',
      );

      const options: Bull.JobOptions = {
        jobId: data.gameId,
        delay: 30 * 1000,
        backoff: 30 * 1000,
        attempts: 0,
        removeOnComplete: true,
      };
      await deleteExpireGameQueue.add(data, options);
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const DeleteExpireGameQueueEnd = async (playerId: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Ended DeleteExpireGameQueue :: (',
        new Date() + ') for gameId :: [' + playerId + ']',
      );

      let job = await getDeleteExpireGameQueue.getJob(playerId);
      if (job) {
        console.log('found and ended - DeleteExpireGameQueue');
        await job.remove();
      }
      resolve();
      return;
    } catch (e) {
      showError(e);
    }
  });
};

deleteExpireGameQueue.on('completed', (job, result) => {
  console.log('DeleteExpireGameQueue timer job completed :: ', job.data);
});

deleteExpireGameQueue.on('failed', (job, err) => {
  console.log('DeleteExpireGameQueue job failed :: ', err.message);
  console.error(err);
});
