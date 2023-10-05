import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { showError } from '../../helpers/logger.helper.js';
import { disconnectJob } from '../jobs/disconnect.job.js';
import { LOG } from '../../helpers/utils.helper.js';

var redisConfiguration: Bull.QueueOptions = {
  redis: {
    port: parseInt(redisConfig.port),
    host: redisConfig.host,
    password: redisConfig.password,
    db: parseInt(redisConfig.database_number),
  },
};

const disconnectQueue = new Bull(
  CONSTANTS.BULL.DISCONNECTION_TIMER,
  redisConfiguration,
);

disconnectQueue.process(disconnectJob);

export const getDisconnectQueue = Bull(
  CONSTANTS.BULL.DISCONNECTION_TIMER,
  redisConfiguration,
);

export const DisconnectQueueStart = async (data: {
  playerId: string;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Started DisconnectQueue :: (',
        new Date() + ') for gameId :: [' + data.playerId + ']',
      );

      const options: Bull.JobOptions = {
        jobId: data.playerId,
        delay: CONSTANTS.GAME.DISCONNETION_TIMER_IN_SECOND * 1000,
        backoff: CONSTANTS.GAME.DISCONNETION_TIMER_IN_SECOND * 1000,
        attempts: 0,
        removeOnComplete: true,
      };
      await disconnectQueue.add(data, options);
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const DisconnectQueueEnd = async (playerId: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      // console.log(
      //   'Ended DisconnectQueue :: (',
      //   new Date() + ') for gameId :: [' + playerId + ']',
      // );

      let job = await getDisconnectQueue.getJob(playerId);
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

disconnectQueue.on('completed', (job, result) => {
  console.log('Disconnect timer job completed :: ', job.data);
});

disconnectQueue.on('failed', (job, err) => {
  console.log('Disconnect job failed :: ', err.message);
  console.error(err);
});
