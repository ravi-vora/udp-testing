import { CONSTANTS } from '../../config/constants.config.js';
import { showError } from '../../helpers/logger.helper.js';
import {
  deletePlayer,
  deleteRematchGame,
  getPlayer,
  getRematchGame,
} from '../../helpers/redis.helper.js';
import { LOG, makeResponse } from '../../helpers/utils.helper.js';
import { redisClient } from '../../services/redis.service.js';
import { IO } from '../../services/socket.service.js';
import { DisconnectQueueEnd } from '../queues/disconnect.queue.js';
import { WaitingPlayerQueueEnd } from '../queues/waiting-player.queue.js';

export const rematchJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Rematch job executing >>>>> ', job.data);

      const KEY = `${CONSTANTS.REDIS.REMATCH_GAME_SLOT}:${job.data.gameId}`;
      await redisClient.del(KEY);

      const rematchGame = await getRematchGame(job.data.gameId);
      if (rematchGame) {
        for (let i = 0; i < rematchGame.players.length; i++) {
          let player = await getPlayer(rematchGame.players[i]);
          if (player) {
            await WaitingPlayerQueueEnd(player.userId);
            await DisconnectQueueEnd(player.userId);
            if (player.socketId) {
              console.log('DELETING rematch player -> ', player);
              await deletePlayer(player);

              IO.to(player.socketId).emit(
                CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
                makeResponse({
                  gameId: player.gameId,
                  player: player.userId,
                  en: CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
                }),
              );
            }
          }
        }

        await deleteRematchGame(rematchGame);
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
