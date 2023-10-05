import { v4 } from 'uuid';
import {
  redisGetKeyValue,
  redisSetKeyValue,
} from '../services/redis.service.js';
import { CONSTANTS } from '../config/constants.config.js';
import {
  getFullRunningGame,
  getPlayer,
  getRematchGame,
  getRunningGame,
  setPlayer,
} from './redis.helper.js';
import { IO } from '../services/socket.service.js';
import { FullRunningGame, Player, PlayerSortInfo, UDP } from '../config/interfaces.config.js';
import zlib from 'zlib';
import crypto from 'crypto'
import { leaveGame } from '../handlers/player.handler.js';

export const parsePayload = (data: any, byte: boolean) => {
  try {
    if (byte) {
      return zlib.unzipSync(data);
    } else {
      return typeof data === 'object' ? data : JSON.parse(data);
    }
  } catch (e) {
    return data;
  }
};


export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

export const getRandomArbitrary = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

export const findAndRemove = (arr: Array<any>, removeElement: any) => {
  const index = arr.indexOf(removeElement);
  if (index > -1) {
    // only splice array when item is found
    arr.splice(index, 1); // 2nd parameter means remove one item only
  }
  return arr;
};

export const makeResponse = (obj: object) => {
  //return JSON.stringify(obj);
  // return zlib.gzipSync(Buffer.from(JSON.stringify(obj))).toJSON()['data'];
  // return zlib.gzipSync(Buffer.from(JSON.stringify(oj)).toJSON()['data']);
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj))).toJSON()['data'];
};


export const generateUserId = () => `U_${v4()}`;
export const generatePlayerId = () => `P_${v4()}`;
export const generateGameId = () => `G_${v4()}`;
export const generateEmptyGameId = () => `EG_${v4()}`;
export const generateRunningGameId = () => `RG_${v4()}`;
export const generateFullRunningGameId = () => `FRG_${v4()}`;
export const generateRematchGameId = () => `RMG_${v4()}`;

var healthTimers = {};
var gunTimers = {};

export const clearSpwaningHealth = async (gameId: string) => {
  if (healthTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`]) {
    clearInterval(
      healthTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`].id,
    );
    delete healthTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`];
  }
};

export const clearSpwaningGun = async (gameId: string) => {
  if (gunTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`]) {
    clearInterval(
      gunTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`].id,
    );
    delete gunTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`];
  }
};

export const startSpwaningHealthKit = async (
  gameId: string,
  duration: number,
  socketId: string
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('startSpwaningHealthKit : 1 :', gameId, duration);

      let finalPositions = [];
      // let availablePositions = [...CONSTANTS.GAME.HEALTH_POSITIONS];
      let takenPosition = {};
      let healthKitCount = 0;

      let gunStoreKey: string = `${CONSTANTS.REDIS.SPAWNED_ITEM}:${gameId}`;
      let getLastSpawned = await redisGetKeyValue(gunStoreKey, true);
      console.log('startSpwaningHealthKit : 2 :', getLastSpawned.success);
      if (getLastSpawned.success) {
        finalPositions = getLastSpawned.value['items'];
      } else {
        for (let i = 0; i < CONSTANTS.GAME.ITEMS_POSITIONS_MAX; i++) {
          let choosedItemId = null;
          let newRandom = getRandomArbitrary(
            0,
            CONSTANTS.GAME.ITEM_POSITIONS.length,
          );
          let newItemRandom = getRandomArbitrary(
            0,
            CONSTANTS.GAME.ITEM_IDS.length,
          );

          while (takenPosition[newRandom]) {
            newRandom = getRandomArbitrary(
              0,
              CONSTANTS.GAME.ITEM_POSITIONS.length,
            );
          }

          choosedItemId = CONSTANTS.GAME.ITEM_IDS[newItemRandom];

          if (CONSTANTS.GAME.ITEM_IDS[newItemRandom] === 1) healthKitCount++;
          if (healthKitCount > 2) choosedItemId = 0;
          if (i === CONSTANTS.GAME.ITEMS_POSITIONS_MAX - 1 && healthKitCount < CONSTANTS.GAME.MAX_HEALTH_KIT_ALLOWED) choosedItemId = 1;

          finalPositions.push({
            position: CONSTANTS.GAME.ITEM_POSITIONS[newRandom],
            itemId: choosedItemId,
          });

          takenPosition[newRandom] = true;
        }

        await redisSetKeyValue(
          gunStoreKey,
          {
            items: finalPositions,
          },
          true,
        );
      }

      let game = await getRunningGame();
      game =
        !game || game.gameId !== gameId
          ? await getFullRunningGame(gameId)
          : game;
      game =
        !game || game.gameId !== gameId ? await getRematchGame(gameId) : game;

      if (game) {
        IO.to(socketId).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_ITEMS_SPAWN,
          makeResponse({
            items_positions: finalPositions,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_ITEMS_SPAWN,
          }),
        );
      }
      console.log('startSpwaningHealthKit : 4 :');
      if (healthTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`]) {
        resolve();
        return;
      } else {
        console.log('startSpwaningHealthKit : 5 :');
        const intervalId = setInterval(async () => {
          let finalPositions = [];
          // let availablePositions = [...CONSTANTS.GAME.HEALTH_POSITIONS];
          let takenPosition = {};

          let healthKitCount = 0;

          for (let i = 0; i < CONSTANTS.GAME.ITEMS_POSITIONS_MAX; i++) {
            let choosedItemId = null;

            let newRandom = getRandomArbitrary(
              0,
              CONSTANTS.GAME.ITEM_POSITIONS.length,
            );
            let newItemRandom = getRandomArbitrary(
              0,
              CONSTANTS.GAME.ITEM_IDS.length,
            );

            while (takenPosition[newRandom]) {
              newRandom = getRandomArbitrary(
                0,
                CONSTANTS.GAME.ITEM_POSITIONS.length,
              );
            }

            choosedItemId = CONSTANTS.GAME.ITEM_IDS[newItemRandom];

            if (CONSTANTS.GAME.ITEM_IDS[newItemRandom] === 1) healthKitCount++;
            if (healthKitCount > 2) choosedItemId = 0;
            if (i === CONSTANTS.GAME.ITEMS_POSITIONS_MAX - 1 && healthKitCount < CONSTANTS.GAME.MAX_HEALTH_KIT_ALLOWED) choosedItemId = 1;

            finalPositions.push({
              position: CONSTANTS.GAME.ITEM_POSITIONS[newRandom],
              itemId: choosedItemId,
            });

            takenPosition[newRandom] = true;
          }

          await redisSetKeyValue(
            gunStoreKey,
            {
              items: finalPositions,
            },
            true,
          );

          let game = await getRunningGame();
          game =
            !game || game.gameId !== gameId
              ? await getFullRunningGame(gameId)
              : game;
          game =
            !game || game.gameId !== gameId
              ? await getRematchGame(gameId)
              : game;

          if (game) {
            IO.to(gameId).emit(
              CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_ITEMS_SPAWN,
              makeResponse({
                items_positions: finalPositions,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_ITEMS_SPAWN,
              }),
            );
          }
        }, duration * 60 * 1000);

        healthTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`] = {
          id: intervalId,
        };
        resolve();
        return;
      }
    } catch (e) {
      reject(e);
    }
  });
};

export var expiredGames = {}

export const startSpwaningGuns = async (
  gameId: string,
  duration: number,
  socketId: string
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      let finalPositions = [];
      // let availablePositions = [...CONSTANTS.GAME.HEALTH_POSITIONS];
      let takenPosition = {};
      let takenGunId = {};

      let gunStoreKey: string = `${CONSTANTS.REDIS.SPAWNED_GUN}:${gameId}`;
      let getLastSpawned = await redisGetKeyValue(gunStoreKey, true);

      if (getLastSpawned.success) {
        finalPositions = getLastSpawned.value['guns'];
        console.log(':::::::::: found caching... spawned guns :::::::::::');
      } else {
        for (let i = 0; i < CONSTANTS.GAME.GUN_POSITIONS_MAX; i++) {
          let newRandom = getRandomArbitrary(
            0,
            CONSTANTS.GAME.GUN_POSITIONS.length,
          );
          let newGunRandom = getRandomArbitrary(
            0,
            CONSTANTS.GAME.GUN_IDS.length,
          );

          while (takenPosition[newRandom]) {
            newRandom = getRandomArbitrary(
              0,
              CONSTANTS.GAME.GUN_POSITIONS.length,
            );
          }

          while (takenGunId[newGunRandom]) {
            newGunRandom = getRandomArbitrary(0, CONSTANTS.GAME.GUN_IDS.length);
          }

          finalPositions.push({
            id: crypto.randomBytes(CONSTANTS.GAME.UNIQUE_ID_LENGTH).toString("hex"),
            position: CONSTANTS.GAME.GUN_POSITIONS[newRandom],
            gunId: CONSTANTS.GAME.GUN_IDS[newGunRandom],
          });
          takenPosition[newRandom] = true;
          takenGunId[newGunRandom] = true;
        }

        await redisSetKeyValue(
          gunStoreKey,
          {
            guns: finalPositions,
          },
          true,
        );
      }

      let game = await getRunningGame();
      game =
        !game || game.gameId !== gameId
          ? await getFullRunningGame(gameId)
          : game;
      game =
        !game || game.gameId !== gameId ? await getRematchGame(gameId) : game;

      if (game) {
        IO.to(socketId).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_GUNS_SPAWN,
          makeResponse({
            gun_positions: finalPositions,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_GUNS_SPAWN,
          }),
        );
      }

      if (gunTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`]) {
        resolve();
        return;
      } else {
        const intervalId = setInterval(async () => {

          let foundGame = await getRunningGame();
          foundGame = !foundGame || (foundGame && foundGame.gameId !== gameId) ? await getFullRunningGame(gameId) : foundGame;
          foundGame = !foundGame || (foundGame && foundGame.gameId !== gameId) ? await getRematchGame(gameId) : foundGame;

          // FIXME: this should be testing with unit testing setup
          // if (foundGame && new Date(foundGame.expiredAt) < new Date()) {

          //   for (let i = 0; i < foundGame.players.length; i++) {
          //     const foundPlayer = await getPlayer(foundGame.players[i]);
          //     if (foundPlayer) {
          //       await leaveGame(
          //         { playerId: foundPlayer.userId, gameId: gameId },
          //         () => {},
          //         null,
          //         CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
          //       );
          //     }
          //   }

          // }
          if (!foundGame) {
            await clearSpwaningGun(gameId);
            await clearSpwaningHealth(gameId);
          }

          let finalPositions = [];
          // let availablePositions = [...CONSTANTS.GAME.HEALTH_POSITIONS];
          let takenPosition = {};
          let takenGunId = {};

          for (let i = 0; i < CONSTANTS.GAME.GUN_POSITIONS_MAX; i++) {
            let newRandom = getRandomArbitrary(
              0,
              CONSTANTS.GAME.GUN_POSITIONS.length,
            );
            let newGunRandom = getRandomArbitrary(
              0,
              CONSTANTS.GAME.GUN_IDS.length,
            );

            while (takenPosition[newRandom]) {
              newRandom = getRandomArbitrary(
                0,
                CONSTANTS.GAME.GUN_POSITIONS.length,
              );
            }

            while (takenGunId[newGunRandom]) {
              newGunRandom = getRandomArbitrary(
                0,
                CONSTANTS.GAME.GUN_IDS.length,
              );
            }

            finalPositions.push({
              id: crypto.randomBytes(CONSTANTS.GAME.UNIQUE_ID_LENGTH).toString("hex"),
              position: CONSTANTS.GAME.GUN_POSITIONS[newRandom],
              gunId: CONSTANTS.GAME.GUN_IDS[newGunRandom],
            });
            takenPosition[newRandom] = true;
            takenGunId[newGunRandom] = true;
          }

          await redisSetKeyValue(
            gunStoreKey,
            {
              guns: finalPositions,
            },
            true,
          );

          let game = await getRunningGame();
          game =
            !game || game.gameId !== gameId
              ? await getFullRunningGame(gameId)
              : game;
          game =
            !game || game.gameId !== gameId
              ? await getRematchGame(gameId)
              : game;

          if (game) {
            IO.to(gameId).emit(
              CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_GUNS_SPAWN,
              makeResponse({
                gun_positions: finalPositions,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_GUNS_SPAWN,
              }),
            );
          }
        }, duration * 60 * 1000);

        gunTimers[`${CONSTANTS.REDIS.GAME_HEALTHS + '-' + gameId}`] = {
          id: intervalId,
        };
        resolve();
        return;
      }
    } catch (e) {
      reject(e);
    }
  });
};

var emittingEvents = {}

export const startSendingActionEvent = async (player: Player) => {
  IO.to(player.socketId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.ACTION,
    makeResponse({
      gameId: player.gameId,
      playerId: player.userId,
      en: CONSTANTS.SOCKET.EVENTS.CUSTOM.ACTION,
    }));

  let intervalId = setInterval(async function() {
    player = await getPlayer(player.userId);

    if (player) {
      const foundSocket = IO.sockets.sockets.get(player.socketId);
      if (!foundSocket) {
        await stopSendingActionEvent(player.userId);
        console.log('::::::::: not found player socket instance in sendingActionEvent and stoped :::::::::')
      } else {
        IO.to(player.socketId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.ACTION,
          makeResponse({
            gameId: player.gameId,
            playerId: player.userId,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.ACTION,
          }));
          console.log('::::::::: found player in sendingActionEvent :::::::::')
      }
      
    } else console.log('::::::::: not found player in sendingActionEvent ????????????')
  }, CONSTANTS.GAME.SENDING_ACTION_EVENT_INTERVAL);

  if (emittingEvents[player.userId]) {
    clearInterval(emittingEvents[player.userId]);  
  }
  emittingEvents[player.userId] = intervalId;
}

export const stopSendingActionEvent = async (userId: string) => {
  clearInterval(emittingEvents[userId]);
  delete emittingEvents[userId];
}

export const sendNewPlayerJoined = async (game: FullRunningGame) : Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      var joinedPlayers : PlayerSortInfo[] = [];
      var socketIds : string[] = [];
      console.log(game);
      if (game && game?.players.length)
      {
        for (let i = 0; i < game.players.length; i++) 
        {
          let findPlayer = await getPlayer(game.players[i]);
          console.log(
            '::: fullRuningGame -> findPlayer ::: ',
            findPlayer,
          );
  
          if (findPlayer) 
          {
  
            joinedPlayers.push({
              id: findPlayer.userId,
              userName: findPlayer.userName,
              playerCloth: findPlayer.playerCloth
            });
  
            socketIds.push(findPlayer.socketId);
          }
        }
      }
      if (socketIds.length > 0)
      {
        IO.sockets.to(socketIds).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_PLAYER_JOINED, makeResponse({
          players: joinedPlayers,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_PLAYER_JOINED
        }));
      }
      resolve();
      return;
    } catch(e) {
      console.log(`?????????????? failed sending event :: ${CONSTANTS.SOCKET.EVENTS.CUSTOM.NEW_PLAYER_JOINED} :::::::::`)
      reject(e);
    }
  })
}

export var takenPORT = {}

export const generateUniquePort = () => {
  let number = Math.floor(Math.random() * 9000) + 1000;

  while(takenPORT[number]) {
    number = Math.floor(Math.random() * 9000) + 1000;
  }

  takenPORT[number] = true;
  return number;
}

export var UDPData : UDP = {}

export const LOG = {
  log: (...data: any) => {
    return;
  },
  trace: (...data: any) => {
    return;
  },
  error: (...data: any) => {
    return;
  },
  info: (...data: any) => {
    return;
  },
}

export var expiredGamesCached = {}

export const cacheExpiredGame = (response: any) => {
  expiredGamesCached[response['gameId']] = response;
}

export const removeCacheExpiredGame = (gameId) => {
  delete expiredGamesCached[gameId];
}