import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { waitingPlayerJob } from '../jobs/waiting-player.job.js';
import { showError } from '../../helpers/logger.helper.js';
import { LOG } from '../../helpers/utils.helper.js';

var redisConfiguration: Bull.QueueOptions = {
  redis: {
    port: parseInt(redisConfig.port),
    host: redisConfig.host,
    password: redisConfig.password,
    db: parseInt(redisConfig.database_number),
  },
};

const waitingPlayerQueue = new Bull(
  CONSTANTS.BULL.WAITING_STATE_TIMTER,
  redisConfiguration,
);

waitingPlayerQueue.process(waitingPlayerJob);

export const getWaitingPlayerQueue = Bull(
  CONSTANTS.BULL.WAITING_STATE_TIMTER,
  redisConfiguration,
);

export const waitingPlayerQueueStart = async (data: {
  playerId: string;
  gameId: string;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Started WaitingPlayerQueue :: ' + new Date());

      const options: Bull.JobOptions = {
        jobId: data.playerId,
        delay: CONSTANTS.GAME.WAITING_STATE_TIMER_IN_SECOND * 1000,
        backoff: CONSTANTS.GAME.WAITING_STATE_TIMER_IN_SECOND * 1000,
        attempts: 0,
        removeOnComplete: true
        // ...data.options,
      };
      await waitingPlayerQueue.add(data, options);
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const WaitingPlayerQueueEnd = async (
  playerId: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Ending Waiting timer :: (' +
          new Date() +
          ') for playerId :: [' +
          playerId +
          ']',
      );

      const job = await getWaitingPlayerQueue.getJob(playerId);
      if (job) {
        console.log('found and ended - playerWaitingTimer');
        await job.remove();
        resolve();
        return;
      } else {
        console.log(
          '???????????????? did not found and ended - playerWaitingTimer',
        );
        resolve();
        return;
      }
    } catch (e) {
      console.log(':::::: failed remove waiting ::::::');
      showError(e);
      reject(e);
    }
  });
};

waitingPlayerQueue.on('completed', (job, result) => {
  console.log('Waiting timer job completed :: ', job.data);
});

waitingPlayerQueue.on('failed', (job, err) => {
  console.log('Waiting timer job failed :: ', err.message);
  console.error(err);
});
