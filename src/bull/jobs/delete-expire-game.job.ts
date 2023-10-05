import { CONSTANTS } from '../../config/constants.config.js';
import { showError } from '../../helpers/logger.helper.js';
import { removeCacheExpiredGame } from '../../helpers/utils.helper.js';
import { redisClient } from '../../services/redis.service.js';

export const deleteExpireGameJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Delete expire game job executing >>>>> ', job.data);
      const {gameId} = job.data;
        
      removeCacheExpiredGame(gameId);

      done();
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};