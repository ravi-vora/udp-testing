import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { showError } from '../../helpers/logger.helper.js';
import { LOG } from '../../helpers/utils.helper.js';
import { gunDestroyJob } from '../jobs/gun-destroy.job.js';

var redisConfiguration: Bull.QueueOptions = {
  redis: {
    port: parseInt(redisConfig.port),
    host: redisConfig.host,
    password: redisConfig.password,
    db: parseInt(redisConfig.database_number),
  },
};

const gunDestroyQueue = new Bull(
  CONSTANTS.BULL.GUN_DESTROY,
  redisConfiguration,
);

gunDestroyQueue.process(gunDestroyJob);

export const getGunDestroyQueue = Bull(
  CONSTANTS.BULL.GUN_DESTROY,
  redisConfiguration,
);

export const GunDestroyQueueStart = async (data: {
  playerId: string;
  gunUId: string;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Started gunDestroyQueue :: (',
        new Date() + ') for gameId :: [' + data.playerId + ']',
      );

      const options: Bull.JobOptions = {
        jobId: data.gunUId,
        delay: CONSTANTS.GAME.DESTROY_GUN_TIMER_IN_SECOND * 1000,
        backoff: CONSTANTS.GAME.DESTROY_GUN_TIMER_IN_SECOND * 1000,
        attempts: 0,
        removeOnComplete: true,
      };
      await gunDestroyQueue.add(data, options);
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const GunDestroyQueueEnd = async (gunUId: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      // console.log(
      //   'Ended DisconnectQueue :: (',
      //   new Date() + ') for gameId :: [' + playerId + ']',
      // );

      let job = await getGunDestroyQueue.getJob(gunUId);
      if (job) {
        // console.log('found and ended - DisconnectTimer');
        await job.remove();
      }
      resolve();
      return;
    } catch (e) {
      showError(e);
    }
  });
};

gunDestroyQueue.on('completed', (job, result) => {
  console.log('gunDestroyQueue timer job completed :: ', job.data);
});

gunDestroyQueue.on('failed', (job, err) => {
  console.log('gunDestroyQueue job failed :: ', err.message);
  console.error(err);
});
