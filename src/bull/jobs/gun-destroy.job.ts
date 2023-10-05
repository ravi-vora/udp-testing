import { CONSTANTS } from '../../config/constants.config.js';
import { debugging, showError } from '../../helpers/logger.helper.js';
import { getFullRunningGame, getPlayer, getRematchGame, getRunningGame, setFullRunningGame, setRematchGame } from '../../helpers/redis.helper.js';
import { LOG, makeResponse } from '../../helpers/utils.helper.js';
import { IO } from '../../services/socket.service.js';

export const gunDestroyJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('gunDestroyJob executing >>>>> ', job.data);
      const {gunId, gunUId, playerId} = job.data;
      const player = await getPlayer(playerId);
      if (!player) {
        debugging('failed getting player details on gunDestroyJob execution');
      } else {
        let game = await getFullRunningGame(player.gameId);
        game = !game ? await getRematchGame(player.gameId) : game;

        if (game) {
            const index = game.droppedGuns.findIndex(item => item.gunId === gunUId);
            if (index > -1) {
                // only splice array when item is found
                game.droppedGuns.splice(index, 1); // 2nd parameter means remove one item only
                if (player.inFull === true && player.isRematch === false) {
                    await setFullRunningGame(game);
                } else if (player.isRematch === false) {
                    await setRematchGame(game);
                }
            }
        }

        IO.to(player.gameId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DESTROY, makeResponse({
            gunId: gunUId,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DESTROY
        }))
      }
      done();
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};
