import Bull from 'bull';
import { CONSTANTS } from '../../config/constants.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { showError } from '../../helpers/logger.helper.js';
import { spawnPlayerJob } from '../jobs/spawn-player.job.js';
import { LOG } from '../../helpers/utils.helper.js';

var redisConfiguration: Bull.QueueOptions = {
  redis: {
    port: parseInt(redisConfig.port),
    host: redisConfig.host,
    password: redisConfig.password,
    db: parseInt(redisConfig.database_number),
  },
};

const spawnPlayerQueue = new Bull(
  CONSTANTS.BULL.NEW_PLAYER_SPAWN,
  redisConfiguration,
);

spawnPlayerQueue.process(spawnPlayerJob);

export const getSpawnPlayerQueue = Bull(
  CONSTANTS.BULL.NEW_PLAYER_SPAWN,
  redisConfiguration,
);

export const SpawnPlayerQueueStart = async (data: {
  playerId: string;
  gameId: string;
  delay: number;
}): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Started SpawnPlayerQueue :: (',
        new Date() + ') for gameId :: [' + data.playerId + ']',
      );

      const options: Bull.JobOptions = {
        jobId: data.playerId,
        delay: data.delay,
        backoff: data.delay,
        attempts: 0,
        removeOnComplete: true
      };
      await spawnPlayerQueue.add(data, options);
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const SpawnPlayerQueueEnd = async (playerId: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        'Ended SpawnPlayerQueue :: (',
        new Date() + ') for gameId :: [' + playerId + ']',
      );

      let job = await getSpawnPlayerQueue.getJob(playerId);
      if (job) {
        console.log('found and ended - SpawnPlayerTimer');
        await job.remove();
      } else {
        console.log(
          '????????????????? did not found and ended - SpawnPlayerTimer',
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

spawnPlayerQueue.on('completed', (job, result) => {
  console.log('Spawn Player timer job completed :: ', job.data);
});

spawnPlayerQueue.on('failed', (job, err) => {
  console.log('Spawn Player job failed :: ', err.message);
  console.error(err);
});
