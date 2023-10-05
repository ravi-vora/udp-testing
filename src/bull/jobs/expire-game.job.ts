import { CONSTANTS } from '../../config/constants.config.js';
import { debugging, showError } from '../../helpers/logger.helper.js';
import {
  deleteInitialGun,
  deletePlayer,
  getFullRunningGame,
  getPlayer,
  getRematchGame,
  getRunningGame,
} from '../../helpers/redis.helper.js';
import {
  addMinutes,
  cacheExpiredGame,
  clearSpwaningGun,
  clearSpwaningHealth,
  expiredGames,
  makeResponse,
  stopSendingActionEvent,
} from '../../helpers/utils.helper.js';
import { redisClient } from '../../services/redis.service.js';
import { IO } from '../../services/socket.service.js';
import { DisconnectQueueEnd } from '../queues/disconnect.queue.js';
import { v4 } from 'uuid';
import {
  RematchExpireQueueStart,
  getRematchExpireQueue,
} from '../queues/rematch.queue.js';
import { SpawnPlayerQueueEnd } from '../queues/spawn-player.queue.js';
import { WaitingPlayerQueueEnd } from '../queues/waiting-player.queue.js';
import { DeleteExpireGameQueueStart } from '../queues/delete-expire-game.queue.js';
import { GunDestroyQueueEnd } from '../queues/gun-destroy.queue.js';

export const expireGameJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Expire Game job executing >>>>> ', job.data);

      const { gameId } = job.data;

      let game = await getRunningGame();
      game = !game ? await getFullRunningGame(gameId) : game;
      game = !game ? await getRematchGame(gameId) : game;

      if (!game || (game && game.gameId !== gameId)) {
        debugging('game not found in Expire game execution ' + gameId);
        resolve();
        return;
      }

      let allPlayers = [];
      let allPlayersSocketIds = [];
      
      for (let i = 0; i < game.players.length; i++) {
        const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${game.gameId}:${game.players[i]}`;
        await redisClient.del(KEY);
        await deleteInitialGun(game.players[i]);

        const gotPlayer = await getPlayer(game.players[i]);
        const socket = IO.sockets.sockets.get(gotPlayer.socketId);
        if (socket && socket.leave) socket.leave(gotPlayer.gameId);
        if (gotPlayer) {
          await GunDestroyQueueEnd(gotPlayer.playerGunId);
          await SpawnPlayerQueueEnd(game.players[i]);
          await stopSendingActionEvent(gotPlayer.userId);
          allPlayers.push(gotPlayer);
          if (gotPlayer.socketId) {
            const findSocket = IO.sockets.sockets.get(gotPlayer.socketId);
            findSocket?.leave(game.gameId);

            allPlayersSocketIds.push(gotPlayer.socketId);
            // if (findSocket) await deletePlayer(gotPlayer);
          } else {
            await DisconnectQueueEnd(gotPlayer.userId);
          }

          if (gotPlayer.isWaiting === true) await WaitingPlayerQueueEnd(game.players[i]);
        }
        if (game.spawned.includes(game.players[i])) await SpawnPlayerQueueEnd(game.players[i]);
      }

      await clearSpwaningHealth(game.gameId);
      await clearSpwaningGun(game.gameId);

      function comparekill(a, b) {
        if (a.killCount > b.killCount) {
          return -1;
        }
        if (a.killCount < b.killCount) {
          return 1;
        }
        return 0;
      }

      allPlayers = allPlayers.sort(comparekill);

      const gunSpawedKey = `${CONSTANTS.REDIS.SPAWNED_GUN}:${game.gameId}`;
      const itemSpawedKey = `${CONSTANTS.REDIS.SPAWNED_ITEM}:${game.gameId}`;

      await redisClient.del(gunSpawedKey);
      await redisClient.del(itemSpawedKey);

      const rematchSlug = `RMG_${v4()}`;

      debugging(`[${gameId}] expired and responded with rematchSlug = [${rematchSlug}]`);

      const KEY = `${CONSTANTS.REDIS.REMATCH_GAME_SLOT}:${rematchSlug}`;
      await redisClient.set(KEY, 1);

      /**
       * start rematch expire timer.
       */
      let rematchJob = await getRematchExpireQueue.getJob(rematchSlug);
      if (!rematchJob) await RematchExpireQueueStart({ gameId: rematchSlug });

      IO.sockets.to(allPlayersSocketIds).emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED,
        makeResponse({
          msg: 'Game over',
          scoreBoard: allPlayers,
          gameId: game.gameId,
          rematchSlug: rematchSlug,
          rematchTime: '20',
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED,
        }),
      );

      cacheExpiredGame({
        msg: 'Game over',
        scoreBoard: allPlayers,
        gameId: game.gameId,
        rematchSlug: rematchSlug,
        rematchTime: '20',
        rematchEndTime: addMinutes(new Date(), 0.33),
        en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED,
      })

      await DeleteExpireGameQueueStart({
        gameId: game.gameId
      });

      expiredGames[game.gameId] = true;

      console.log({
        msg: 'Game over',
        scoreBoard: allPlayers,
        gameId: game.gameId,
        rematchSlug: rematchSlug,
        rematchTime: '20',
        en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED,
      });

      // await startSendingExpireGame(game, {
      //   msg: 'Game over',
      //   scoreBoard: allPlayers,
      //   gameId: game.gameId,
      //   rematchSlug: rematchSlug,
      //   rematchTime: CONSTANTS.GAME.REMATCH_JOB_TIMER_IN_SECOND,
      //   en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED
      // });

      let GAME_KEY = `${CONSTANTS.REDIS.FULL_RUNNING_GAME}:${gameId}`;
      await redisClient.del(GAME_KEY);
      GAME_KEY = `${CONSTANTS.REDIS.REMATCH_GAME}:${gameId}`
      await redisClient.del(GAME_KEY);
      GAME_KEY = `${CONSTANTS.REDIS.RUNNING_GAME}:${gameId}`
      await redisClient.del(GAME_KEY);

      let expiredGame : any = game;
      expiredGame.player = allPlayers;

      // const EXPIRED_GAME_KEY = `${CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED}:${game.gameId}`;
      // await redisClient.set(EXPIRED_GAME_KEY, JSON.stringify(game));

      // await DeleteExpireGameQueueStart({gameId: gameId});

      if (gameId.split("_")[0] === "RMG") {
        const KEY = `${CONSTANTS.REDIS.REMATCH_GAME_SLOT}:${gameId}`;
        await redisClient.del(KEY);
        
      } 
      // else if (allPlayers[0].inFull === true) {
      //   await deleteFullRunningGame(game);
      // } else {
      //   let runningGame = await getRunningGame();
      //   if (runningGame.gameId === game.gameId) {
      //     await deleteRunningGame(game);
      //   }
      // }

      expiredGames[game.gameId] = true;

      // if (allPlayers[0].inFull === true) await deleteFullRunningGame(game);
      // else if (allPlayers[0].isRematch === true) {
      //   const KEY = `${CONSTANTS.REDIS.REMATCH_GAME_SLOT}:${game.gameId}`;
      //   await redisClient.del(KEY);

      //   await deleteRematchGame(game);
      // } else {
      //   let runningGame = await getRunningGame();
      //   if (runningGame.gameId === game.gameId) {
      //     await deleteRunningGame(game);
      //   }
      // }
      done();
      resolve();
      return;
      return;
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};
