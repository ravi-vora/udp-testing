import { showError } from '../../helpers/logger.helper.js';
import {
  getPlayer,
} from '../../helpers/redis.helper.js';
import {LOG, startSendingActionEvent } from '../../helpers/utils.helper.js';

export const spawnPlayerJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Spawn Player job executing >>>>> ');
      const { playerId, gameId } = job.data;

      let player = await getPlayer(playerId);
      if (!player)
        console.log('failed getting player. __ respawn player after killed.');

      console.log('Sending Action Event :::: ', player, gameId);

      await startSendingActionEvent(player);
      
      console.log(
        ':::::::::::: newPlayerSpawnTimer player: EMITTED :::::::::: ',
      );
      done();
      resolve();

      done();
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};
