import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { showError } from '../../helpers/logger.helper.js';
import { rematchJob } from '../jobs/rematch.queue.js';
import { LOG } from '../../helpers/utils.helper.js';

var redisConfiguration: Bull.QueueOptions = {
  redis: {
    port: parseInt(redisConfig.port),
    host: redisConfig.host,
    password: redisConfig.password,
    db: parseInt(redisConfig.database_number),
  },
};

const rematchExpireQueue = new Bull(
  CONSTANTS.BULL.REMATCH_TIMER,
  redisConfiguration,
);

rematchExpireQueue.process(rematchJob);

export const getRematchExpireQueue = Bull(
  CONSTANTS.BULL.REMATCH_TIMER,
  redisConfiguration,
);

export const RematchExpireQueueStart = async (data: {
  gameId: string;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Started RematchExpireQueue :: (',
        new Date() + ') for gameId :: [' + data.gameId + ']',
      );

      const options: Bull.JobOptions = {
        jobId: data.gameId,
        delay: CONSTANTS.GAME.REMATCH_JOB_TIMER_IN_SECOND * 1000,
        backoff: CONSTANTS.GAME.REMATCH_JOB_TIMER_IN_SECOND * 1000,
        attempts: 0,
        removeOnComplete: true
      };
      await rematchExpireQueue.add(data, options);
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const RematchExpireQueueEnd = async (gameId: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Ended RematchExpireQueue :: (',
        new Date() + ') for gameId :: [' + gameId + ']',
      );

      let job = await getRematchExpireQueue.getJob(gameId);
      if (job) {
        console.log('found and ended - rematchExpireTimer');
        await job.remove();
      } else {
        console.log(
          '????????????????? did not found and ended - rematchExpireTimer',
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

rematchExpireQueue.on('completed', (job, result) => {
  console.log('Rematch expire timer job completed :: ', job.data);
});

rematchExpireQueue.on('failed', (job, err) => {
  console.log('Rematch expire job failed :: ', err.message);
  console.error(err);
});
