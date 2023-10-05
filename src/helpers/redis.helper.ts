import { CONSTANTS } from '../config/constants.config.js';
import {
  EmptyGame,
  FinishedGame,
  FullRunningGame,
  Gun,
  Player,
  PlayerPosition,
  RematchGame,
  RunningGame,
  UniqueThings,
  User,
} from '../config/interfaces.config.js';
import { redisClient } from '../services/redis.service.js';
import { LOG } from './utils.helper.js';

export const getGun = async (gunId: number): Promise<Gun> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.GUNS}:${gunId}`;
      const gun = await redisClient.get(KEY);
      resolve(gun ? JSON.parse(gun) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getInitialGun = async (playerId: string) : Promise<{gunId: number}> => {
  return new Promise(async (resolve, reject) => {
    try {

      const KEY = `${CONSTANTS.REDIS.INITIAL_GUN}:${playerId}`;
      const initialGun = await redisClient.get(KEY);
      resolve(initialGun ? JSON.parse(initialGun) : null);
      return;

    } catch(e) {
      console.log('failed getting initial player\'s gun data');
      console.error(e);
      reject(e);
      return;
    }
  })
}

export const setInitialGun = async (player: Player) : Promise<{gunId: number}> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.INITIAL_GUN}:${player.userId}`;
      const status = await redisClient.set(KEY, JSON.stringify({ gunId: player.playerGun }));

      resolve(status === 'OK' ? { gunId: player.playerGun } : null);
      return;
       
    } catch(e) {
      console.log('::::::::::: failed setting initial player gun data ::::::::')
      console.error(e);
      reject(e);
      return;
    }
  })
}

export const deleteInitialGun = async (playerId: string) : Promise<boolean> => {
  return new Promise(async (resolve, reject) => {
    try {

      const KEY = `${CONSTANTS.REDIS.INITIAL_GUN}:${playerId}`;
      await redisClient.del(KEY);
      resolve(true);
      return;

    } catch(e) {
      console.log("::: failed deleting player's initialGun data :::::");
      console.error(e);
      reject(e);
      return;
    }
  })
}

export const getNewUniqueThings = async (
  gameId: string,
): Promise<UniqueThings> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.UNIQUE_THINGS}:${gameId}`;
      const uniqueThings = await redisClient.get(KEY);
      resolve(uniqueThings ? JSON.parse(uniqueThings) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const setNewUniqueThings = async (
  gameId: string,
  uniqueThings: UniqueThings,
): Promise<UniqueThings> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.UNIQUE_THINGS}:${gameId}`;
      const status = await redisClient.set(KEY, JSON.stringify(uniqueThings));
      resolve(status === 'OK' ? uniqueThings : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const deleteUniqueThings = async (
  gameId: string,
): Promise<UniqueThings> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.UNIQUE_THINGS}:${gameId}`;
      const uniqueThings = await redisClient.get(KEY);
      if (uniqueThings) {
        await redisClient.del(KEY);
        resolve(JSON.parse(uniqueThings));
        return;
      } else {
        global.logger.error(
          new Error('failed getting uniqueThings while deleting it.'),
        );
        throw new Error('failed getting uniqueThings while deleting it.');
      }
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getUser = async (deviceId: string): Promise<User> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.USERS}:${deviceId}`;
      let user = await redisClient.get(KEY);
      resolve(user ? JSON.parse(user) : null);
    } catch (e) {
      global.logger.error(e);
      reject(e);
    }
  });
};

export const setUser = async (user: User): Promise<User> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.USERS}:${user.deviceId}`;
      const status = await redisClient.set(KEY, JSON.stringify(user));
      resolve(status === 'OK' ? user : null);
    } catch (e) {
      global.logger.error(e);
      reject(e);
    }
  });
};

export const getPlayer = async (userId: string): Promise<Player> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.PLAYERS}:${userId}`;
      const player = await redisClient.get(KEY);
      resolve(player ? JSON.parse(player) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const setPlayer = async (player: Player): Promise<Player> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.PLAYERS}:${player.userId}`;
      const status = await redisClient.set(KEY, JSON.stringify(player));

      resolve(status === 'OK' ? player : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const deletePlayer = async (player: Player): Promise<Player> => {
  return new Promise(async (resolve, reject) => {
    try {

      const KEY = `${CONSTANTS.REDIS.PLAYERS}:${player.userId}`;
      await redisClient.del(KEY);
      resolve(player);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getEmptyGame = async (): Promise<EmptyGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.EMPTY_GAME}`;
      const emptyGame = await redisClient.get(KEY);
      resolve(emptyGame ? JSON.parse(emptyGame) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const setEmptyGame = async (game: EmptyGame): Promise<EmptyGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.EMPTY_GAME}`;
      const status = await redisClient.set(KEY, JSON.stringify(game));
      resolve(status === 'OK' ? game : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const deleteEmptyGame = async (game: EmptyGame): Promise<EmptyGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.EMPTY_GAME}`;
      await redisClient.del(KEY);
      resolve(game);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getRunningGame = async (): Promise<RunningGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.RUNNING_GAME}`;
      const runningGame = await redisClient.get(KEY);
      resolve(runningGame ? JSON.parse(runningGame) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const setRunningGame = async (
  game: RunningGame,
): Promise<RunningGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.RUNNING_GAME}`;

      for (let i = 0; i < game.players.length; i++) {
        const gotPlayer = await getPlayer(game.players[i]);
        if (gotPlayer) {
          gotPlayer.isWaiting = false;
          let player = await setPlayer(gotPlayer);
          if (!player)
            reject(new Error('failed updating player isWaiting state'));
        }
      }

      const status = await redisClient.set(KEY, JSON.stringify(game));
      resolve(status === 'OK' ? game : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const deleteRunningGame = async (
  game: RunningGame,
): Promise<RunningGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.RUNNING_GAME}`;

      const runningGamg = await getRunningGame();
      if (runningGamg.gameId !== game.gameId)
        throw new Error(
          'you are trying to delete runningGame that is not player is playing in,',
        );
      else {
        await redisClient.del(KEY);
        resolve(game);
        return;
      }
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getFullRunningGame = async (
  gameId: string,
): Promise<FullRunningGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.FULL_RUNNING_GAME}:${gameId}`;
      let runningGame = await redisClient.get(KEY);

      resolve(runningGame ? JSON.parse(runningGame) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const setFullRunningGame = async (
  game: FullRunningGame,
): Promise<FullRunningGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.FULL_RUNNING_GAME}:${game.gameId}`;

      for (let i = 0; i < game.players.length; i++) {
        const gotPlayer = await getPlayer(game.players[i]);
        if (gotPlayer) {
          gotPlayer.inFull = true;
          let player = await setPlayer(gotPlayer);
          if (!player)
            reject(new Error('failed updating player isWaiting state'));
        }
      }

      const status = await redisClient.set(KEY, JSON.stringify(game));
      resolve(status === 'OK' ? game : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const deleteFullRunningGame = async (
  game: FullRunningGame,
): Promise<FullRunningGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.FULL_RUNNING_GAME}:${game.gameId}`;
      await redisClient.del(KEY);
      resolve(game);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getFinishedGame = async (
  gameId: string,
): Promise<FinishedGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.FINISHED_GAME}:${gameId}`;
      const finishedGame = await redisClient.get(KEY);
      resolve(finishedGame ? JSON.parse(finishedGame) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const setFinishedGame = async (
  game: FinishedGame,
): Promise<FinishedGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      game.expired = true;
      const KEY = `${CONSTANTS.REDIS.FINISHED_GAME}:${game.gameId}`;
      const status = await redisClient.set(KEY, JSON.stringify(game));
      resolve(status === 'OK' ? game : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getLastPosition = async (
  gameId: string,
  playerId: string,
): Promise<PlayerPosition> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${gameId}:${playerId}`;
      const playerPosition = await redisClient.get(KEY);
      resolve(playerPosition ? JSON.parse(playerPosition) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const setLastPosition = async (
  gameId: string,
  playerId: string,
  playerPosition: PlayerPosition,
): Promise<PlayerPosition> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${gameId}:${playerId}`;
      const status = await redisClient.set(KEY, JSON.stringify(playerPosition));
      resolve(status === 'OK' ? playerPosition : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getRematchGame = async (gameId: string): Promise<RematchGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.REMATCH_GAME}:${gameId}`;
      const rematchGame = await redisClient.get(KEY);
      resolve(rematchGame ? JSON.parse(rematchGame) : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const setRematchGame = async (
  game: RematchGame,
): Promise<RematchGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.REMATCH_GAME}:${game.gameId}`;
      const status = await redisClient.set(KEY, JSON.stringify(game));
      resolve(status === 'OK' ? game : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const deleteRematchGame = async (
  game: RematchGame,
): Promise<RematchGame> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.REMATCH_GAME}:${game.gameId}`;
      await redisClient.del(KEY);
      resolve(game);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const getRematchSlug = async (rematchSlug: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const KEY = `${CONSTANTS.REDIS.REMATCH_GAME_SLOT}:${rematchSlug}`;
      const data = await redisClient.get(KEY);
      resolve(data ? data : null);
      return;
    } catch (e) {
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};
