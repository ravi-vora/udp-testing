import { CONSTANTS } from '../../config/constants.config.js';
import { showError } from '../../helpers/logger.helper.js';
import {
  getFullRunningGame,
  getRematchGame,
  getRunningGame,
} from '../../helpers/redis.helper.js';
import { LOG, makeResponse } from '../../helpers/utils.helper.js';
import { IO } from '../../services/socket.service.js';

export const expireSoonGameJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Expire Soon Game job executing >>>>> ', job.data);

      const { gameId } = job.data;

      let game = await getFullRunningGame(gameId);
      game = !game ? await getRunningGame() : game;
      game = !game ? await getRematchGame(gameId) : game;

      IO.to(gameId).emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED_SOON,
        makeResponse({
          gameId,
          game,
        }),
      );
      done();
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};
