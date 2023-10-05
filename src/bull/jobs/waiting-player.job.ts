import { CONSTANTS } from '../../config/constants.config.js';
import { leaveGame } from '../../handlers/player.handler.js';
import { showError } from '../../helpers/logger.helper.js';

export const waitingPlayerJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Waiting Player job executing >>>>> ');
      const { playerId, gameId } = job.data;

      await leaveGame(
        { playerId, gameId, waiting: true },
        (data: any) => {},
        null,
        CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
      );

      console.log('Waiting Player job executing end >>>>> ');

      done();
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};
