import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { waitingGameJob } from '../jobs/waiting-game.job.js';
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

const waitingGameQueue = new Bull(
  CONSTANTS.BULL.GAME_JOIN_WAITING_TIMER,
  redisConfiguration,
);

waitingGameQueue.process(waitingGameJob);

export const getWaitingPlayerQueue = Bull(
  CONSTANTS.BULL.GAME_JOIN_WAITING_TIMER,
  redisConfiguration,
);

export const waitingGameQueueStart = async (data: {
  gameId: string;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Started WaitingGameQueue :: ' + new Date());

      const options: Bull.JobOptions = {
        jobId: data.gameId,
        delay: CONSTANTS.GAME.WAITING_GAME_TIMER_IN_SECOND * 1000,
        backoff: CONSTANTS.GAME.WAITING_GAME_TIMER_IN_SECOND * 1000,
        attempts: 0,
        removeOnComplete: true
        // ...data.options,
      };

      const job = await waitingGameQueue.getJob(data.gameId);
      if (!job) {
        await waitingGameQueue.add(data, options);
      }
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const WaitingGameQueueEnd = async (
  gameId: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Ending Waiting timer :: (' +
          new Date() +
          ') for gameId :: [' +
          gameId +
          ']',
      );

      const job = await getWaitingPlayerQueue.getJob(gameId);
      if (job) {
        console.log('found and ended - GameWaitingTimer');
        await job.remove();
        resolve();
        return;
      } else {
        console.log(
          '???????????????? did not found and ended - GameWaitingTimer',
        );
        resolve();
        return;
      }
    } catch (e) {
      console.log(':::::: failed remove GameWaiting ::::::');
      showError(e);
      reject(e);
    }
  });
};

waitingGameQueue.on('completed', (job, result) => {
  console.log('Waiting Game timer job completed :: ', job.data);
});

waitingGameQueue.on('failed', (job, err) => {
  console.log('Waiting Game timer job failed :: ', err.message);
  console.error(err);
});