import { CONSTANTS } from '../../config/constants.config.js';
import { leaveGame } from '../../handlers/player.handler.js';
import { debugging, showError } from '../../helpers/logger.helper.js';
import { getPlayer } from '../../helpers/redis.helper.js';
import { LOG } from '../../helpers/utils.helper.js';

export const disconnectJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Disconnect job executing >>>>> ', job.data);

      const player = await getPlayer(job.data.playerId);
      if (!player) {
        debugging('failed getting player details on disconnect execution');
      } else {
        await leaveGame(
          { playerId: player.userId, gameId: player.gameId },
          () => {},
          null,
          CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
        );
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
