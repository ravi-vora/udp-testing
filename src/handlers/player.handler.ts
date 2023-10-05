import { Socket } from 'socket.io';
import {
  Acknowledgement,
  GameStatus,
} from '../config/interfaces.config.js';
import {
  deleteEmptyGame,
  deleteFullRunningGame,
  deleteInitialGun,
  deletePlayer,
  deleteRematchGame,
  deleteRunningGame,
  getEmptyGame,
  getFullRunningGame,
  getInitialGun,
  getPlayer,
  getRematchGame,
  getRunningGame,
  setEmptyGame,
  setFullRunningGame,
  setPlayer,
  setRematchGame,
  setRunningGame,
} from '../helpers/redis.helper.js';
import { CONSTANTS } from '../config/constants.config.js';
import {
  clearSpwaningGun,
  clearSpwaningHealth,
  expiredGames,
  findAndRemove,
  getRandomArbitrary,
  makeResponse,
  stopSendingActionEvent,
} from '../helpers/utils.helper.js';
import { IO } from '../services/socket.service.js';
import { WaitingPlayerQueueEnd } from '../bull/queues/waiting-player.queue.js';
import { ExpireGameQueueEnd } from '../bull/queues/expire-game.queue.js';
import { debugging, showError } from '../helpers/logger.helper.js';
import { ExpireSoonGameQueueEnd } from '../bull/queues/expire-soon-game.queue.js';
import {
  redisClient,
  redisSetKeyValue,
} from '../services/redis.service.js';
import {
  DisconnectQueueEnd,
  DisconnectQueueStart,
} from '../bull/queues/disconnect.queue.js';
import {
  validateGrenadeThrowPayload_V1,
  validateGunDropPayload_V1,
  validateGunPickupPayload_V1,
  validateHealthPayloadV1,
  validateInGamePayload_V1,
  validateKilledPayload_V1,
} from '../middleware/player.middleware.js';
import { SpawnPlayerQueueEnd, SpawnPlayerQueueStart } from '../bull/queues/spawn-player.queue.js';
import { Lock } from '../helpers/lock.helper.js';
import crypto from 'crypto';
import { GUNS_ARRAY } from '../config/gunsArray.config.js';
import { GunDestroyQueueEnd, GunDestroyQueueStart } from '../bull/queues/gun-destroy.queue.js';

export const healthUpdate = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const lock = await Lock.getLock().acquire([`LOCK:HEALTH_UPDATE:${socket.handshake.auth.gameId}`], 2000);
    try {
      console.log("HEALTH UPDATE ============> ", data);
      data = !data ? {} : data;
      data.playerId = data.playerId
        ? data.playerId
        : socket.handshake.auth.playerId;
      data.gameId = data.gameId ? data.gameId : socket.handshake.auth.gameId;

      // console.log('HEALTH UPDATE ###### REQUEST  ##### ', data);
      const isValid = validateHealthPayloadV1(data);

      data.health =
        data.health === '' || data.health < 0 ? 0 : Number(data.health);

      if (!isValid.valid) {
        console.log("HEALTH UPDATE ::: invalid data :: ", data);
        socket.emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.HEALTH_UPDATE_FAIL,
          makeResponse({
            ...isValid.errors,
            en: eventName,
          }),
        );
        resolve();
        return;
      } else {

        let player = await getPlayer(data.dead);
        if (player) {
          if (player.isKill === true) {
            resolve();
            return;
          }

          player.health = data.health <= 0 ? 100 : data.health;
          player = await setPlayer(player);
          if (!player)
            global.logger.error(
              new Error('failed updating player with new health.'),
            );

          let game = player.inFull && player.isRematch === false ? await getFullRunningGame(data.gameId) : player.isRematch === true ? await getRematchGame(data.gameId) : await getRunningGame();


          // let game = await getRunningGame();
          // game =
          //   !game || game.gameId !== data.gameId
          //     ? await getFullRunningGame(data.gameId)
          //     : game;
          // game = !game ? await getRematchGame(data.gameId) : game;

          if (!game) {
            console.log("HEALTH UPDATE ::: (game not found) ::", game);
            resolve();
            return;
          }
        } else {
          console.log("HEALTH UPDATE ::: (player not found) ::", player);
          resolve();
          return;
        }

        IO.to(data.gameId).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.HEALTH_UPDATE_SUCCESS_V1,
          makeResponse({
            gameId: data.gameId,
            playerId: data.dead,
            newHealth: data.health,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.HEALTH_UPDATE_SUCCESS_V1,
          }),
        );

        console.log("HEALTH UPDATE ===========> OUTGOING :|HEALTH_UPDATE_SUCCESS|:", {
          gameId: data.gameId,
          playerId: data.dead,
          newHealth: data.health,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.HEALTH_UPDATE_SUCCESS_V1,
        })

        if (parseInt(data.health) <= 0) {
          console.log(
            '::::::::::::::::: passing to the kill event process ::::::::::::::::::::',
            data,
          );
          await playerKill(data, acknowledgement, socket, eventName);
        }

        resolve();
        return;
      }
    } catch (e) {
      console.log('failed ::::::::: healthUpdate ', e.message);
      console.trace(e);
      global.logger.error(e);
      socket.emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAYER_MOVE_FAIL,
        makeResponse({
          msg: `something went wrong : ${e.message}`,
          en: eventName,
        }),
      );
      reject(e);
      return;
    } finally {
      await Lock.getLock().release(lock);
    }
  });
};

export const playerKill = async (
  data,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("PLAYER KILL ===========> INCOMING :::", data);
      socket.handshake.auth.pendingSpawn = true;
      /**
       * Validate the payload
       *  - gameId, dead, killedBy, deadPosition, randomizePosition
       */
      data.gameId = data.gameId ? data.gameId : socket.handshake.auth.gameId;
      data.playerId = data.playerId ? data.playerId : socket.handshake.auth.playerId;

      const isValid = validateKilledPayload_V1(data);
      if (isValid.valid) {

        let deadPlayer = await getPlayer(data.dead);
        let killByPlayer = await getPlayer(data.killedBy);

        if (deadPlayer && deadPlayer.isKill === true) {
          resolve();
          return;
        }

        let game =
          deadPlayer.inFull === true && deadPlayer.isRematch === false
            ? await getFullRunningGame(deadPlayer.gameId)
            : deadPlayer.isRematch === true
              ? await getRematchGame(deadPlayer.gameId)
              : await getRunningGame();

        const playersPosition = game.uniqueThings;

        let playerPositions = playersPosition.player_positions;
        let playerCloths = playersPosition.cloths;

        let choosedNewPlayerPositionIndex = getRandomArbitrary(
          0,
          playerPositions.length,
        );
        // let choosedNewPlayerClothIndex = getRandomArbitrary(0, playerCloths.length);

        let choosedNewPlayerPosition =
          playerPositions[choosedNewPlayerPositionIndex];
        // let choosedNewPlayerCloth = playerCloths[choosedNewPlayerClothIndex];

        game.uniqueThings.player_positions = findAndRemove(
          playerPositions,
          choosedNewPlayerPosition,
        );

        if (!game.uniqueThings.player_positions.includes(data.randomizePosition)) {
          game.uniqueThings.player_positions.push(data.randomizePosition);
        }

        if (data.dead !== data.killedBy) {
          deadPlayer.deadCount += 1;
          killByPlayer.killCount += 1;
        }

        deadPlayer.isKill = true;
        deadPlayer.playerPosition = choosedNewPlayerPosition;
        deadPlayer.recievedBoard = false;
        deadPlayer = await setPlayer(deadPlayer);
        if (!deadPlayer)
          global.logger.error(
            new Error('failed updating deadPlayer in killPlayer_redis'),
          );

        if (data.dead !== data.killedBy) {
          killByPlayer = await setPlayer(killByPlayer);
          if (!killByPlayer)
            global.logger.error(
              new Error('failed updating killByPlayer in killPlayer_redis'),
            );
        }

        if (
          deadPlayer.gameId !== data.gameId ||
          killByPlayer.gameId !== data.gameId
        ) {
          console.info(
            'invalid gameId, players are associated properly.',
          );
          acknowledgement(
            makeResponse({
              msg: ['invalid gameId, players are associated properly.'],
            }),
          );
          resolve();
        }

        const gunId = deadPlayer.playerGun;
        const gunSId = deadPlayer.playerSGun;
        const gameId = data.gameId;
        const playerId = deadPlayer.userId;
        const ammoCount = deadPlayer.gunAmmoCount;
        const position = data.deadPosition;

        /**
         * update game with spawned player;
         */
        if (socket.handshake.auth.pendingSpawn === true) {
          game.spawned.push(deadPlayer.userId);
        }
        if (deadPlayer.inFull === true && deadPlayer.isRematch === false) {
          // game = await getFullRunningGame(data.gameId);
          // if (!game.spawned.includes(deadPlayer.userId)) {

          // }
          game = await setFullRunningGame(game);
        } else if (deadPlayer.isRematch === true) {
          // game = await getRematchGame(data.gameId);
          // if (!game.spawned.includes(deadPlayer.userId)) {
          //   game.spawned.push(deadPlayer.userId);
          // }
          game = await setRematchGame(game);
        } else {
          const findGame = await getRunningGame();
          if (findGame.gameId === data.gameId.trim()) {
            // game = findGame;
            // if (!game.spawned.includes(deadPlayer.userId)) {
            //   game.spawned.push(deadPlayer.userId);
            // }
            game = await setRunningGame(game);
          } else {
            console.log('!!!!!!!!!!!game not found at all in playerKill_redis');
            resolve();
            return;
          }
        }

        await gunDrop(
          {
            gunSId,
            gunId,
            gameId,
            playerId,
            ammoCount,
            position,
            isKill: true,
          },
          acknowledgement,
          socket,
          eventName,
        );

        console.log('playerKill_redis deadPlayer.socketId : ', deadPlayer);

        setTimeout(async () => {
          await ingameScore(
            {
              playerId: deadPlayer.userId,
              gameId: socket.handshake.auth.gameId
            },
            acknowledgement,
            socket,
            CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE,
          );
        }, 2000);
        /**
         * take acknowledgement
         */
        await SpawnPlayerQueueStart({
          playerId: deadPlayer.userId,
          gameId: deadPlayer.gameId,
          delay: (CONSTANTS.GAME.SPAWN_PLAYER_AFTER_KILL - 2000)
        });
        // if (deadPlayer.socketId) {
        //   console.log(
        //     '::::::::::::::::::::::::::::::::::::: sended ACTION Event to : <' +
        //     deadPlayer.socketId +
        //     '> ::::::::::::::::::::::::::::::::::::::::',
        //     deadPlayer.userId,
        //   );


        // } else console.log(':::::::::: deadPlayer is not connected');
        resolve();
      } else {
        acknowledgement(
          makeResponse({
            ...isValid.errors,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAYER_KILL_FAIL_V1,
          }),
        );
        resolve();
      }
    } catch (e) {
      console.log('failed ::::::::: ', e.message);
      console.trace(e);
      reject(e);
    }
  });
};

export const ingameScore = async (
  data,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('INGAME SCORE ###### REQUEST  ##### ', data);

      /**
       * validate the required payload
       */
      //  data.playerId = (data.playerId) ? data.playerId :socket.playerId;
      //  data.gameId = (data.gameId) ? data.gameId :socket.gameId;
      const isValid = validateInGamePayload_V1(data);

      if (!isValid.valid) {
        IO.to(socket.id).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE_FAIL_V1,
          makeResponse({
            ...isValid.errors,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE_FAIL_V1,
          }),
        );
        resolve();
      } else {
        let game = await getRunningGame();
        game =
          !game || game.gameId !== data.gameId
            ? await getFullRunningGame(data.gameId)
            : game;
        game =
          !game || game.gameId !== data.gameId
            ? await getRematchGame(data.gameId)
            : game;

        if (!game) {
          console.log("INGAME SCORE ::: (gameId is invalid, game not found.)");
          acknowledgement(
            makeResponse({
              msg: ['gameId is invalid, game not found.'],
            }),
          );
        } else {
          function comparekill(a, b) {
            if (a.killCount > b.killCount) {
              return -1;
            }
            if (a.killCount < b.killCount) {
              return 1;
            }
            return 0;
          }

          let players = [];
          for (let i = 0; i < game.players.length; i++) {
            const gotPlayer = await getPlayer(game.players[i]);
            if (!gotPlayer)
              global.logger.error(
                new Error('failed getting player in ingame score board'),
              );
            else {
              players.push(gotPlayer);
            }
          }
          players = players.sort(comparekill);

          console.log("INGAME SCORE ::: sorted playersList ::: ", players);

          if (game) {
            console.log("INGAME SCORE ::: sending response :: ");

            const player = await getPlayer(data.playerId);

            console.log('INGAME SCORE ###### RESPONSE  ##### ', {
              scoreBoard: players,
              en: CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE,
            });
            await stopSendingActionEvent(socket.handshake.auth.playerId);
            IO.to(player.socketId).emit(
              CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE,
              makeResponse({
                isBack: "isBack" in data && data?.isBack === true ? data.isBack : false,
                scoreBoard: players,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE,
              }),
            );
            console.log('INGAME_SCORE ***** emitted *****', CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE);

            // await SpawnPlayerQueueStart({
            //   gameId: data.gameId,
            //   playerId: data.playerId,
            // });

            resolve();
          } else {
            console.log("SENDing InGame score.... 0000000");

            IO.to(socket.id).emit(
              CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE_FAIL_V1,
              makeResponse({
                gameId: ['gameId not found!'],
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE_FAIL_V1,
              }),
            );
            console.log('INGAME_SCORE ***** emitted *****', CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE_FAIL_V1);
            // acknowledgement(makeResponse({
            //   gameId: ["gameId not found!"],
            //   en: eventName
            // }))
            resolve();
          }
        }
      }
    } catch (e) {
      console.log('failed ::::::::: in inGameScore', e.message);
      console.trace(e);
      IO.to(socket.id).emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE_FAIL_V1,
        makeResponse({
          msg: `something went wrong : ${e.message}`,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE_FAIL_V1,
        }),
      );
      reject(e);
    }
  });
};

export const action = async (
  data,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const lock = await Lock.getLock().acquire([`LOCK:ACTION:${socket.handshake.auth.gameId}`], 2000);

    try {

      data = {};
      data.playerId = socket.playerId
        ? socket.playerId
        : socket.handshake.auth.playerId;
      data.gameId = socket.gameId
        ? socket.gameId
        : socket.handshake.auth.gameId;

      if (data.playerId && data.gameId) {
        let player = await getPlayer(data.playerId);
        let game = null;
        if (player) { 
          game = player && player.inFull === true && player.isRematch === false
            ? await getFullRunningGame(data.gameId)
            : player.isRematch === true
              ? await getRematchGame(data.gameId)
              : await getRunningGame();
        } else {
          await Lock.getLock().release(lock);
          console.log("ACTION :: player not found ::", player);
          resolve();
          return;
        }

        if (game) {
          debugging("ACTION" + socket.handshake.auth.playerId);
          if (
            game &&
            game.gameId === player.gameId
          ) {
            console.log(
              '::::::::: removing player from spawned ::: ',
              player,
              game.spawned,
            );

            game.spawned = findAndRemove(game.spawned, player.userId);

            game =
              player.inFull === true && player.isRematch === false
                ? await setFullRunningGame(game)
                : player.isRematch === true
                  ? await setRematchGame(game)
                  : await setRunningGame(game);

            const initialGun: { gunId: number } = await getInitialGun(player.userId);
            if (initialGun) {
              player.playerGun = initialGun.gunId;
              player.curGun = initialGun.gunId;
            } else console.log(":::::::::::::: failed getting initial gun data on ____ ACTION ____ ::::::::::::::")


            player.playerGunId = crypto.randomBytes(CONSTANTS.GAME.UNIQUE_ID_LENGTH).toString("hex");
            player.gunAmmoCount = GUNS_ARRAY[2].ammoCount;
            player.gunMaxAmmoCount = GUNS_ARRAY[2].ammoCount;
            player.magazine = GUNS_ARRAY[2].magazine;
            player.curAmmo = GUNS_ARRAY[2].ammoCount;
            player.magCount = GUNS_ARRAY[2].ammoCount / GUNS_ARRAY[2].magazine;

            player.playerSGunId = crypto.randomBytes(CONSTANTS.GAME.UNIQUE_ID_LENGTH).toString("hex");
            player.playerSGun = GUNS_ARRAY[1].index;
            player.gunSAmmoCount = GUNS_ARRAY[1].ammoCount;
            player.gunSMaxAmmoCount = GUNS_ARRAY[1].ammoCount;
            player.sMagazine = GUNS_ARRAY[1].magazine;
            player.curSAmmo = GUNS_ARRAY[1].ammoCount;
            player.sMegCount = GUNS_ARRAY[1].ammoCount / GUNS_ARRAY[1].magazine;

            player.health = 100;
            player.grenades = CONSTANTS.GAME.DEFAULT_GRENADES;
            // player.isKill = false;
            player = await setPlayer(player);
            if (!player)
              console.error(
                new Error(
                  'failed setting player in respawn player after killed.',
                ),
              );
              
              console.log("Updated Spawn player :: ", player);

            IO.to(game.gameId).emit(
              CONSTANTS.SOCKET.EVENTS.CUSTOM.SPAWN_AGAIN,
              makeResponse({
                gameId: game.gameId,
                ...player,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.SPAWN_AGAIN,
              }),
            );
            //await ReleaseSpawnQueueStart({ gameId: game.gameId, playerId: player.userId});
            socket.handshake.auth.pendingSpawn === false;

            player.isKill = false;
            player = await setPlayer(player);

            const foundSocket = IO.sockets.sockets.get(player.socketId);
            if (foundSocket) {
              await stopSendingActionEvent(player.userId);
              console.log(":::::::::::::: found socket ::::::::::::::::");
            }
            debugging("SPAWN AGAIN ::: " + player.userId);
            await Lock.getLock().release(lock);
            resolve();
            return;
          } else {
            console.log(
              ':::::::::::::::: did not found player in game spawned array',
            );
            console.log(':::::::::::: player', player);
            console.log(':::::::::::: game ', game);
          }
          await Lock.getLock().release(lock);
          resolve();
          return;
        } else {
          await Lock.getLock().release(lock);
          console.log("ACTION :: game not found ::", game);
          resolve();
          return;
        }


      } else {

        console.log(
          '!!!!!!!!!!!!!!! FAILED getting playerId and gameId in ACTION ',
        );
        await Lock.getLock().release(lock);
        resolve();
        return;
      }
    } catch (e) {
      console.log('failed ::::::::: in Action :', e.message);
      console.trace(e);
      await Lock.getLock().release(lock);
      reject(e);
      return;
    } finally {
      await Lock.getLock().release(lock);
    }
  });
};

export const gunPickup = async (
  data,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const lock = await Lock.getLock().acquire([`LOCK:GUN_PICKUP:${socket.handshake.auth.gameId}`], 2000);
    try {
      console.log('GUN PICKUP ==============> INCOMING |:::|', data);
      await GunDestroyQueueEnd(data.id);
      /**
       * validation: is it a primary gun pickup or secondary
       */
      data.playerId = data.playerId
        ? data.playerId
        : socket.handshake.auth.playerId;
      data.gameId = data.gameId ? data.gameId : socket.handshake.auth.gameId;
      const isValid = await validateGunPickupPayload_V1(data);
      if (!isValid.valid) {
        console.log("GUN PICKUP ::: Invalid data ::", data);
        console.error(isValid.errors);
        resolve();
        return;
      } else {
        let player = await getPlayer(data.playerId);
        if (!player) console.log("Player not found ::: ", player);

        // console.log("Player current gun status :::", {
        //   playerGun: player.playerGun,
        //   playerGunId: player.playerGunId,
        //   playerSGun: player.playerSGun,
        //   playerSGunId: player.playerSGunId
        // });

        let game = await getRunningGame();
        game =
          !game || game.gameId !== data.gameId
            ? await getFullRunningGame(data.gameId)
            : game;
        game = !game ? await getRematchGame(data.gameId) : game;

        if (!game) {
          console.log("Game not found ::: ", game, " gameId ::", data.gameId);
          resolve();
          return;
        }

        // let pickingUpGun = data.gunId;
        // let pickingUpGunId = data.id;

        let foundGun = game.droppedGuns.findIndex(gunObj => gunObj.gun === data.gunId && gunObj.gunId === data.id);
        let droppedGun = null;
        let droppedGunId = null;
        let pickedUpDetails : any = {};

        if (foundGun !== -1) {

          /**
           * setup new pickedup details
           */
          pickedUpDetails['gunId'] = game.droppedGuns[foundGun].gunId;
          pickedUpDetails['gun'] = game.droppedGuns[foundGun].gun;
          pickedUpDetails['ammoCount'] = game.droppedGuns[foundGun].ammoCount;
          pickedUpDetails['maxAmmoCount'] = game.droppedGuns[foundGun].maxAmmoCount;
          pickedUpDetails['fireRate'] = game.droppedGuns[foundGun].fireRate;
          pickedUpDetails['damageRate'] = game.droppedGuns[foundGun].damageRate;
          pickedUpDetails['magazine'] = game.droppedGuns[foundGun].magazine;
          pickedUpDetails['curAmmo'] = game.droppedGuns[foundGun].curAmmo;
          pickedUpDetails['magCount'] = game.droppedGuns[foundGun].magCount;

          console.log("Picked up gun detailes 1 :: ", pickedUpDetails);

          game.droppedGuns[foundGun]['gunId'] = player.playerGunId;
          game.droppedGuns[foundGun]['gun'] = player.playerGun;
          game.droppedGuns[foundGun]['position'] = data.position;
          game.droppedGuns[foundGun]['ammoCount'] = data.ammoCount;
          game.droppedGuns[foundGun]['maxAmmoCount'] = player.gunMaxAmmoCount;
          game.droppedGuns[foundGun]['damageRate'] = player.gunDamageRate;
          game.droppedGuns[foundGun]['fireRate'] = player.gunFireRate;
          game.droppedGuns[foundGun]['magazine'] = player.magazine;
          game.droppedGuns[foundGun]['curAmmo'] = data.curAmmo;
          game.droppedGuns[foundGun]['magCount'] = data.magCount;

          droppedGun = player.playerGun;
          droppedGunId = player.playerGunId;
          

          // console.log("Dropped gun detailes 1 :: ", game.droppedGuns[foundGun]);

          /**
           * update the player with new pickedup gun details
           */
          player.curGun = pickedUpDetails.gun;
          player.playerGun = pickedUpDetails.gun;
          player.playerGunId = pickedUpDetails.gunId;
          player.gunAmmoCount = pickedUpDetails.ammoCount;
          player.gunMaxAmmoCount = pickedUpDetails.maxAmmoCount;
          player.gunFireRate = pickedUpDetails.fireRate;
          player.gunDamageRate = pickedUpDetails.damageRate;
          player.magazine = pickedUpDetails.magazine;
          player.curAmmo = pickedUpDetails.curAmmo;
          player.magCount = pickedUpDetails.magCount;

          player = await setPlayer(player);
          if (!player) {
            console.log("!!!!!!!!! Failed updating player with new gun details :: ", player);
            resolve();
            return;
          }

          /**
           * update the game with new dropped gun detailes
           */
          if (player.inFull === true && player.isRematch === false) {
            game = await setFullRunningGame(game);
            if (!game)
              global.logger.error(
                new Error('failed updating full running game.'),
              );
          } else if (player.isRematch === true) {
            game = await setRematchGame(game);
            if (!game)
              global.logger.error(
                new Error('failed updating rematch game.'),
              );
          } else {
            console.log('setRunningGame 22:::::::: gunpickup', game);
            game = await setRunningGame(game);
            if (!game)
              global.logger.error(
                new Error('failed updating running game.'),
              );
          }

        } else {
          const gunKey = `${CONSTANTS.REDIS.GUNS}:${data.gunId}`;
          let gunDetails = await redisClient.get(gunKey);
          if (!gunDetails) {
            console.log("!!!!!!!!!!!!!!!!! Failed getting gun details :::", gunDetails, " key ::", gunKey);
            resolve();
            return;
          }
          gunDetails = JSON.parse(gunDetails);

          // console.log("new gun details :: ", gunDetails);

          /**
           * setup new pickedup details
           */
          pickedUpDetails['gunId'] = data.id;
          pickedUpDetails['gun'] = data.gunId;
          pickedUpDetails['ammoCount'] = gunDetails.ammoCount;
          pickedUpDetails['maxAmmoCount'] = gunDetails.ammoCount;
          pickedUpDetails['fireRate'] = gunDetails.fireRate;
          pickedUpDetails['damageRate'] = gunDetails.damageRate;
          pickedUpDetails['magazine'] = gunDetails.magazine;
          pickedUpDetails['curAmmo'] = gunDetails.ammoCount;
          pickedUpDetails['magCount'] = gunDetails.ammoCount / gunDetails.magazine;

          console.log("Picked up gun detailes 2 :: ", pickedUpDetails);

          /**
           * setup dropped gun
           */
          game.droppedGuns.push({
            gunId: player.playerGunId,
            gun: player.playerGun,
            position: data.position,
            ammoCount: data.ammoCount,
            maxAmmoCount: player.gunMaxAmmoCount,
            damageRate: player.gunDamageRate,
            fireRate: player.gunFireRate,
            magazine: player.magazine,
            curAmmo: data.curAmmo,
            magCount: data.magCount
          })

          console.log("Dropped gun detailes 2 :: ", {
            gunId: player.playerGunId,
            gun: player.playerGun,
            position: data.position,
            ammoCount: data.ammoCount,
            maxAmmoCount: player.gunMaxAmmoCount,
            damageRate: player.gunDamageRate,
            fireRate: player.gunFireRate,
            magazine: player.magazine
          });

          droppedGun = player.playerGun;
          droppedGunId = player.playerGunId;

          player.curGun = pickedUpDetails.gun;
          player.playerGun = pickedUpDetails.gun;
          player.playerGunId = pickedUpDetails.gunId;
          player.gunAmmoCount = pickedUpDetails.ammoCount;
          player.gunMaxAmmoCount = pickedUpDetails.maxAmmoCount;
          player.gunFireRate = pickedUpDetails.fireRate;
          player.gunDamageRate = pickedUpDetails.damageRate;
          player.magazine = pickedUpDetails.magazine;
          player.curAmmo = pickedUpDetails.curAmmo;
          player.magCount = pickedUpDetails.magCount;

          player = await setPlayer(player);
          if (!player) {
            console.log("!!!!!!!!! Failed updating player with new gun details :: ", player);
            resolve();
            return;
          }

          /**
           * update the game with new dropped gun detailes
           */
          if (player.inFull === true && player.isRematch === false) {
            game = await setFullRunningGame(game);
            if (!game)
              global.logger.error(
                new Error('failed updating full running game.'),
              );
          } else if (player.isRematch === true) {
            game = await setRematchGame(game);
            if (!game)
              global.logger.error(
                new Error('failed updating rematch game.'),
              );
          } else {
            console.log('setRunningGame 22:::::::: gunpickup', game);
            game = await setRunningGame(game);
            if (!game)
              global.logger.error(
                new Error('failed updating running game.'),
              );
          }

        }

        IO.to(data.gameId).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_PICKUP_SUCCESS_V1,
          makeResponse({
            id: data.id,
            gameId: data.gameId,
            playerId: data.playerId,
            pickedUp: data.gunId,
            magazine: pickedUpDetails.magazine,
            ammoCount: pickedUpDetails.ammoCount,
            maxAmmoCount: pickedUpDetails.maxAmmoCount,
            fireRate: pickedUpDetails.fireRate,
            damageRate: pickedUpDetails.damageRate,
            position: data.position,
            curAmmo: pickedUpDetails.curAmmo,
            magCount: pickedUpDetails.magCount,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_PICKUP_SUCCESS_V1,
          }),
        );

        console.log('GUN PICKUP ==============> OUTGOING [GUN_PICKUP_SUCCESS] |:::|', {
          id: data.id,
          gameId: data.gameId,
          playerId: data.playerId,
          pickedUp: data.gunId,
          magazine: pickedUpDetails.magazine,
          ammoCount: pickedUpDetails.ammoCount,
          maxAmmoCount: pickedUpDetails.maxAmmoCount,
          fireRate: pickedUpDetails.fireRate,
          damageRate: pickedUpDetails.damageRate,
          position: data.position,
          curAmmo: pickedUpDetails.curAmmo,
          magCount: pickedUpDetails.magCount,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_PICKUP_SUCCESS_V1,
        });

        IO.to(data.gameId).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DROP_SUCCESS_V1,
          makeResponse({
            gameId: data.gameId,
            playerId: data.playerId,
            dropedGun: droppedGunId,
            position: data.position,
            isKill: false,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DROP_SUCCESS_V1,
          }),
        );

        console.log('GUN PICKUP ==============> OUTGOING [GUN_DROP_SUCCESS] |:::|', {
          gameId: data.gameId,
          playerId: data.playerId,
          dropedGun: droppedGunId,
          position: data.position,
          isKill: false,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DROP_SUCCESS_V1,
        });

        await GunDestroyQueueStart({
          playerId: player.userId,
          gunUId: droppedGunId
        });

      }
    } catch (e) {
      console.log('?#####? GUN PICKUP :: FAILED ?#########?', e.message);
      console.trace(e);
      console.error(e);
      reject(e);
      return;
    } finally {
      await Lock.getLock().release(lock);
    }
  });
};

export const gunDrop = async (
  data: any,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      /**
       * validate the payload
       * required: gameId, playerId, gunId
       */
      data.playerId = data.playerId
        ? data.playerId
        : socket.handshake.auth.playerId;
      data.gameId = data.gameId ? data.gameId : socket.handshake.auth.gameId;
      
      console.log('GUN DROP ==============> INCOMING |:::|', data);
      const isValid = validateGunDropPayload_V1(data);
      if (!isValid.valid) {
        console.error(new Error("invalid gun drop ::"));
        console.log(data);
        acknowledgement(
          makeResponse({
            ...isValid.errors,
            en: eventName,
          }),
        );
        socket.emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DROP_FAIL_V1,
          makeResponse({
            ...isValid.errors,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DROP_FAIL_V1,
          }),
        );
        debugging(isValid.errors);
        resolve();
        return;
      } else {
        const uniquePlayerGun = getRandomArbitrary(
          CONSTANTS.GAME.PLAYER_GUNS[0],
          CONSTANTS.GAME.PLAYER_GUNS.at(-1),
        );

        // console.log('GUN DROPPED ::: unique player gun index :::::: ', uniquePlayerGun);

        let playerData = await getPlayer(data.playerId);
        if (!playerData)
          global.logger.error(new Error('failed getting player.'));
        else {
          playerData.gunAmmoCount = data.ammoCount;
          playerData = await setPlayer(playerData);
          if (!playerData)
            global.logger.error(new Error('failed updating player'));
        }

        let newGame = playerData.inFull === true && playerData.isRematch === false ? await getFullRunningGame(data.gameId) : playerData.isRematch === true ? await getRematchGame(data.gameId) : await getRunningGame();

        newGame.droppedGuns.push({
          gunId: playerData.playerGunId,
          gun: playerData.playerGun,
          position: data.position,
          ammoCount: data.ammoCount,
          maxAmmoCount: playerData.gunMaxAmmoCount,
          damageRate: playerData.gunDamageRate,
          fireRate: playerData.gunFireRate,
          magazine: playerData.magazine,
          curAmmo: playerData.curAmmo,
          magCount: playerData.magCount
        })

        newGame.droppedGuns = newGame.droppedGuns;

        if (playerData.inFull === true && playerData.isRematch === false) {
          newGame = await setFullRunningGame(newGame);
          if (!newGame)
            global.logger.error(
              new Error('failed updating full running newGame.'),
            );
        } else if (playerData.isRematch === true) {
          newGame = await setRematchGame(newGame);
          if (!newGame)
            global.logger.error(
              new Error('failed updating rematch newGame.'),
            );
        } else {
          newGame = await setRunningGame(newGame);
          if (!newGame)
            global.logger.error(
              new Error('failed updating running newGame.'),
            );
        }

        IO.to(data.gameId).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DROP_SUCCESS_V1,
          makeResponse({
            gameId: data.gameId,
            playerId: data.playerId,
            dropedGun: playerData.playerGunId,
            position: data.position,
            isKill: data.isKill ? data.isKill : false,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DROP_SUCCESS_V1,
          }),
        );

        console.log('GUN DROP ==============> OUTGOING |GUN_DROP_SUCCESS|', {
          gameId: data.gameId,
          playerId: data.playerId,
          dropedGun: playerData.playerGunId,
          position: data.position,
          isKill: data.isKill ? data.isKill : false,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_DROP_SUCCESS_V1,
        });
        await GunDestroyQueueStart({
          playerId: playerData.userId,
          gunUId: playerData.playerGunId
        });
        resolve();
        return;
      }
    } catch (e) {
      console.log('?######? GUN DROPPED :: FAILED ?######?', e.message);
      console.trace(e);
      console.error(e);
      global.logger.error(e);
      reject(e);
      return;
    }
  });
};

export const grenadeThrow = async (
  data: any,
  acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return await new Promise(async (resolve, reject) => {
    try {
      data.playerId = data.playerId
        ? data.playerId
        : socket.handshake.auth.playerId;
      const isValid = await validateGrenadeThrowPayload_V1(data);

      if (!isValid.valid) {
        acknowledgement(
          makeResponse({
            ...isValid.errors,
            en: eventName,
          }),
        );

        socket.emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.GRENADE_THROW_FAIL_V1,
          makeResponse({
            ...isValid.errors,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GRENADE_THROW_FAIL_V1,
          }),
        );
        resolve();
      } else {
        console.log("data.playerId :: ", data.playerId);

        let player = await getPlayer(data.playerId);

        console.log("Player ::: ", player);
        if (player) {
          player.grenades = player.grenades - 1;
          player = await setPlayer(player);
          if (!player)
            global.logger.error(new Error('failed updating player.'));

          let game = player.inFull === true && player.isRematch === false ? await getFullRunningGame(player.gameId) : player.isRematch === true ? await getRematchGame(player.gameId) : await getRunningGame();

          // let game = await getRunningGame();
          // game =
          //   !game || game.gameId !== player.gameId
          //     ? await getFullRunningGame(player.gameId)
          //     : game;
          // game = !game ? await getRematchGame(player.gameId) : game;

          if (game) {
            console.log("emitting grenades throw ::: ", game, player);

            IO.to(game.gameId).emit(
              CONSTANTS.SOCKET.EVENTS.CUSTOM.GRENADE_THROW_SUCCESS_V1,
              makeResponse({
                player,
                throwDirection: data.throwDirection,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GRENADE_THROW_SUCCESS_V1,
              }),
            );
            resolve();
          } else {
            acknowledgement(
              makeResponse({
                msg: `player's game not found`,
                en: eventName,
              }),
            );
          }
        } else {
          console.log("player not found ::::::: Grenades throw");
          acknowledgement(
            makeResponse({
              msg: 'something went wrong',
              en: eventName,
            }),
          );

          socket.emit(
            CONSTANTS.SOCKET.EVENTS.CUSTOM.GRENADE_THROW_FAIL_V1,
            makeResponse({
              msg: 'something went wrong : invalid playerId',
              en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GRENADE_THROW_FAIL_V1,
            }),
          );
          resolve();
        }
      }
    } catch (e) {
      console.log('failed ::::::::: gunThrow ', e.message);
      console.trace(e);
      global.logger.error(e);
      acknowledgement(
        makeResponse({
          msg: `something went wrong + ${e.message}`,
          en: eventName,
        }),
      );
      reject(e);
    }
  });
};

export const disconnectPlayer = async (socket: Socket): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const { playerId, gameId } = socket.handshake.auth;

      await stopSendingActionEvent(playerId);

      let player = await getPlayer(playerId);
      if (player) {
        const socket = IO.sockets.sockets.get(player.socketId);
        if (socket) {
          resolve();
          return;
        }
        socket?.disconnect();

        player.socketId = null;
        player = await setPlayer(player);

        let game = null;
        let gameStatus : GameStatus = null;
        if (player.isWaiting === true) {
          game = await getEmptyGame();
          gameStatus = GameStatus.EmptyGame;
        } else if (player.inFull === true && player.isRematch === false) {
          game = await getFullRunningGame(player.gameId)
          gameStatus = GameStatus.FullRunningGame;
        } else if (player.isRematch === true) {
          game = await getRematchGame(player.gameId)
          gameStatus = GameStatus.RematchGame;
        } else {
          game = await getRunningGame();
          gameStatus = GameStatus.RunningGame;
        }

        if (!game) {
          debugging("failed getting game data at all in ____ disconnect ____");
        } else if (game.started === true) {
          await DisconnectQueueStart({ playerId: player.userId });
        } 
        // else {
          
        //   game.player = findAndRemove(game.players, player.userId);
        //   if (gameStatus === GameStatus.FullRunningGame) {
        //     game = await setFullRunningGame(game);
        //   } else if (gameStatus === GameStatus.RematchGame) {
        //     game = await setRematchGame(game);
        //   } else if (gameStatus === GameStatus.RunningGame) {
        //     game = await setRunningGame(game);
        //   } else if (gameStatus === GameStatus.EmptyGame) {
        //     game = await setEmptyGame(game);
        //   } else {
        //     debugging("failed indentifying gameStatus in disconnect");
        //     resolve();
        //     return;
        //   }
        //   let allPlayersSocketIds = [];
        //   for (let i = 0; i < game.player.length; i++) {
        //     let gotPlayer = await getPlayer(game.player[i]);
        //     if (gotPlayer && gotPlayer.socketId !== null) {
        //       allPlayersSocketIds.push(gotPlayer.socketId);
        //     }
        //   }

        //   IO.sockets.to(allPlayersSocketIds).emit(
        //     CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
        //     makeResponse({
        //       gameId: game.gameId,
        //       player: player.userId,
        //       en: CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
        //     }),
        //   );

        //   await deleteInitialGun(player.userId);
        //   player = await deletePlayer(player);

        // }
        // await leaveGame(
        //   { playerId, gameId },
        //   () => {},
        //   socket,
        //   CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
        // );
        resolve();
        return;
      } else {
        debugging('failed getting player on disconnect....');
        resolve();
        return;
      }
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};

// export const leaveGame = (
//   data: any,
//   acknowledgement: Acknowledgement,
//   socket: Socket,
//   eventName: string,
// ): Promise<void> => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       const { playerId, gameId } = data
//         ? data
//         : socket
//         ? socket.handshake.auth
//         : { playerId: '', gameId: '' };

//       /**
//        * get player and game details
//        */
//       let player = await getPlayer(playerId);
//       if (!player) {
//         console.log(
//           '::::::::::::::: failed getting player detail ___ LEAVE_GAME ___',
//           player,
//           playerId,
//         );
//         resolve();
//         return;
//       }

//       let game =
//         player.inFull === true
//           ? await getFullRunningGame(player.gameId)
//           : player.isRematch === true
//           ? await getRematchGame(player.gameId)
//           : await getRunningGame();

//       if (!game && player.isWaiting === true) {
//         game = await getEmptyGame();
//         if (!game || (game && game.gameId !== player.gameId)) {
//           console.log(
//             ":::::::::::::: failed getting player's game details ___ LEAVE_GAME ___ ::::::::::::::::",
//             game,
//             gameId,
//           );
//           resolve();
//           return;
//         }
//       }

//       if (game && game.gameId !== player.gameId) {
//         console.log(
//           ":::::::::::::: failed getting player's game details ___ LEAVE_GAME ___ ::::::::::::::::",
//           game,
//           gameId,
//         );
//         resolve();
//         return;
//       } else if (!game) {
//         resolve();
//         return;
//       }

//       if (player.isWaiting === true) {
//         // TODO: in future this will global timer, will need customization...
//         // await WaitingPlayerQueueEnd(player.userId);

//         let allPlayersSocketIds = [];
//         for (let i = 0; i < game.players.length; i++) {
//           const gotPlayer = await getPlayer(game.players[i]);
//           if (gotPlayer && gotPlayer.socketId)
//             allPlayersSocketIds.push(gotPlayer.socketId);
//         }

//         await deletePlayer(player);

//         IO.sockets.to(allPlayersSocketIds).emit(
//           CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
//           makeResponse({
//             gameId: game.gameId,
//             player: player.userId,
//             isWaiting: player.isWaiting,
//             en: CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
//           }),
//         );

//         game.players = findAndRemove(game.players, player.userId);
//         game = await setEmptyGame(game);
//         if (!game) {
//           console.log(
//             ':::::::::::::: failed updating emptyGame on ____ LEAVE_TABLE ____',
//             game,
//             player.gameId,
//           );
//           resolve();
//           return;
//         }

//         const emptyGame = await getEmptyGame();
//         if (player.gameId === emptyGame.gameId) {
//           await deleteEmptyGame(emptyGame);
//         }

//         // if (allPlayersSocketIds.length <= 1) {

//         // }

//         resolve();
//         return;
//       } else {
//         let allPlayersSocketIds = [];
//         let leftPlayers = [];
//         let allPlayers = [];

//         for (let i = 0; i < game.players.length; i++) {
//           const foundPlayer = await getPlayer(game.players[i]);
//           if (foundPlayer) {

//             /**
//              * calculate KD ratio
//              * FORMULA: Kills / Deaths 
//              * Example -> 
//              *           Kills = 10, Deaths = 2
//              *           KD = 10 / 2;
//              *           winningAmount = KD * 100
//              * after API integration winningAmount calculationcan differ from current one.
//              */
//             foundPlayer.winAmount = (foundPlayer.killCount / foundPlayer.deadCount === 0 ? 1 : foundPlayer.deadCount) * 100;
//             foundPlayer.winAmount = foundPlayer.winAmount !== null ? foundPlayer.winAmount : 0;

//             allPlayers.push(foundPlayer);
//             if (foundPlayer.socketId)
//               allPlayersSocketIds.push(foundPlayer.socketId);
//             if (foundPlayer.userId !== player.userId)
//               leftPlayers.push(foundPlayer);
//           }
//         }

//         IO.sockets.to(allPlayersSocketIds).emit(
//           CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
//           makeResponse({
//             gameId: game.gameId,
//             player: player.userId,
//             isWaiting: player.isWaiting,
//             en: CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
//           }),
//         );

//         /**
//          * remove player from db from every corner.
//          */
//         if (!game.uniqueThings.cloths.includes(player.playerCloth)) {
//           game.uniqueThings.cloths.push(player.playerCloth);
//         }
//         if (
//           !game.uniqueThings.player_positions.includes(player.playerPosition)
//         ) {
//           game.uniqueThings.player_positions.push(player.playerPosition);
//         }
//         game.players = findAndRemove(game.players, player.userId);

//         if (player.inFull === true) await setFullRunningGame(game);
//         else if (player.isRematch === true) await setRematchGame(game);
//         else {
//           let runningGame = await getRunningGame();
//           if (runningGame.gameId === game.gameId) {
//             await setRunningGame(game);
//           }
//         }

//         if (player.socketId !== null) {
//           await deleteInitialGun(player.userId);
//           player = await deletePlayer(player);
//           if (!player) {
//             console.log(
//               '::::::::::::::: failed deleting player on ___ LEAVE_TABLE ___ ',
//               player,
//               playerId,
//             );
//             resolve();
//             return;
//           }
//         }

//         if (socket && socket.leave) socket.leave(game.gameId);

//         if (leftPlayers.length === 1) {
//           console.log(
//             '::::::::::: only one player has left :::::::::::::::',
//             game,
//           );

//           await clearSpwaningHealth(game.gameId);
//           await clearSpwaningGun(game.gameId);

//           /**
//            * stop all timer
//            */
//           await ExpireGameQueueEnd(game.gameId);
//           await ExpireSoonGameQueueEnd(game.gameId);

//           game.tableStatus = 0;
//           game.rematchTime = 0;

//           function comparekill(a, b) {
//             if (a.winAmount > b.winAmount) {
//               return -1;
//             }
//             if (a.winAmount < b.winAmount) {
//               return 1;
//             }
//             return 0;
//           }

//           allPlayers = allPlayers.sort(comparekill);

//           const gunSpawedKey = `${CONSTANTS.REDIS.SPAWNED_GUN}:${game.gameId}`;
//           const itemSpawedKey = `${CONSTANTS.REDIS.SPAWNED_ITEM}:${game.gameId}`;

//           await redisClient.del(gunSpawedKey);
//           await redisClient.del(itemSpawedKey);

//           IO.sockets.to(allPlayersSocketIds).emit(
//             CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED,
//             makeResponse({
//               msg: 'Game over',
//               scoreBoard: allPlayers,
//               gameId: game.gameId,
//               rematchSlug: '',
//               rematchTime: 0,
//               en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED,
//             }),
//           );

//           for (let i = 0; i < game.players.length; i++) {
//             await stopSendingActionEvent(game.players[i]);

//             const gotPlayer = await getPlayer(game.players[i]);

//             const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${game.gameId}:${gotPlayer.userId}`;
//             await redisClient.del(KEY);

//             if (gotPlayer && gotPlayer.socketId !== null) {
//               await deleteInitialGun(gotPlayer.userId);
//               console.log("DELETTING :::::::::::::: PLAYER :::::::::::::: ", gotPlayer, gotPlayer.socketId);

//               await deletePlayer(gotPlayer);
//             }

//             if (gotPlayer.isWaiting === true) await WaitingPlayerQueueEnd(game.players[i]);
//             if (game.spawned.includes(game.players[i])) await SpawnPlayerQueueEnd(game.players[i]);
//           }

//           if (player.inFull === true) await deleteFullRunningGame(game);
//           else if (player.isRematch === true) {
//             const KEY = `${CONSTANTS.REDIS.REMATCH_GAME_SLOT}:${game.gameId}`;
//             await redisClient.del(KEY);
//             await deleteRematchGame(game);
//           } else {
//             let runningGame = await getRunningGame();
//             if (runningGame.gameId === game.gameId) {
//               await deleteRunningGame(game);
//             }
//           }
//           resolve();
//           return;
//         } else {
//           const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${player.gameId}:${player.userId}`;
//           await redisClient.del(KEY);

//           /**
//            * remove player in db from every corner
//            */
//           if (player.socketId !== null) {
//             console.log("deleting player ::::: ", player, player.socketId);

//             player = await deletePlayer(player);
//             if (!player) {
//               console.log(
//                 '::::::::::: failed deleting player on ___ LEAVE_GAME ___',
//                 player,
//                 playerId,
//               );
//             }
//           }
//           resolve();
//           return;
//         }
//       }
//     } catch (e) {
//       showError(e);
//       reject(e);
//       return;
//     }
//   });
// };

export const leaveGame = (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const { playerId, gameId } = data
        ? data
        : socket
          ? socket.handshake.auth
          : { playerId: '', gameId: '' };  

      /**
       * get player and game details
       */
      let player = await getPlayer(playerId);
      if (!player) {
        console.log(
          '::::::::::::::: failed getting player detail ___ LEAVE_GAME ___',
          player,
          playerId,
        ); 
        resolve();
        return;
      }

      // const playerSocket = IO.sockets.sockets.get(player.socketId);
      // if (playerSocket) {
      //   resolve();
      //   return;
      // }

      console.log("::::::::::::::::: LEAVE GAME ::::::::::::: ")
      debugging(player);

      let game =
        player.inFull === true && player.isRematch === false
          ? await getFullRunningGame(player.gameId)
          : player.isRematch === true
            ? await getRematchGame(player.gameId)
            : await getRunningGame();

      if (!game && player.isWaiting === true) {
        game = await getEmptyGame();
        if (!game || (game && game.gameId !== player.gameId)) {
          console.log(
            ":::::::::::::: failed getting player's game details ___ LEAVE_GAME ___ ::::::::::::::::",
            game,
            gameId,
          );
          resolve();
          return;
        }
      }

      if (game && game.gameId !== player.gameId) {
        console.log(
          ":::::::::::::: failed getting player's game details ___ LEAVE_GAME ___ ::::::::::::::::",
          game,
          gameId,
        );
        resolve();
        return;
      } else if (!game) {
        resolve();
        return;
      }

      if (player.isWaiting === true) {
        // TODO: in future this will global timer, will need customization...
        // await WaitingPlayerQueueEnd(player.userId);

        let allPlayersSocketIds = [];
        for (let i = 0; i < game.players.length; i++) {
          const gotPlayer = await getPlayer(game.players[i]);
          if (gotPlayer && gotPlayer.socketId)
            allPlayersSocketIds.push(gotPlayer.socketId);
        }

        await deletePlayer(player);

        IO.sockets.to(allPlayersSocketIds).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
          makeResponse({
            gameId: game.gameId,
            player: player.userId,
            isWaiting: player.isWaiting,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
          }),
        );

        game.players = findAndRemove(game.players, player.userId);
        game = await setEmptyGame(game);
        if (!game) {
          console.log(
            ':::::::::::::: failed updating emptyGame on ____ LEAVE_TABLE ____',
            game,
            player.gameId,
          );
          resolve();
          return;
        }

        const emptyGame = await getEmptyGame();
        if (player.gameId === emptyGame.gameId) {
          await deleteEmptyGame(emptyGame);
        }

        // if (allPlayersSocketIds.length <= 1) {

        // }
        resolve();
        return;
      } else {
        let allPlayersSocketIds = [];
        let leftPlayers = [];
        let allPlayers = [];

        for (let i = 0; i < game.players.length; i++) {
          const foundPlayer = await getPlayer(game.players[i]);
          if (foundPlayer) {
            await GunDestroyQueueEnd(foundPlayer.playerGunId);
            allPlayers.push(foundPlayer);
            if (foundPlayer.socketId)
              allPlayersSocketIds.push(foundPlayer.socketId);
            if (foundPlayer.userId !== player.userId)
              leftPlayers.push(foundPlayer);
          }
        }
        console.log("AllPlayersSocketIds :::::: ", allPlayersSocketIds);
        IO.sockets.to(allPlayersSocketIds).emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
          makeResponse({
            gameId: game.gameId,
            player: player.userId,
            isWaiting: player.isWaiting,
            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE,
          }),
        );

        /**
         * remove player from db from every corner.
         */
        if (!game.uniqueThings.cloths.includes(player.playerCloth)) {
          game.uniqueThings.cloths.push(player.playerCloth);
        }
        if (
          !game.uniqueThings.player_positions.includes(player.playerPosition)
        ) {
          game.uniqueThings.player_positions.push(player.playerPosition);
        }
        game.players = findAndRemove(game.players, player.userId);

        if (player.inFull === true && player.isRematch === false) await setFullRunningGame(game);
        else if (player.isRematch === true) await setRematchGame(game);
        else {
          let runningGame = await getRunningGame();
          if (runningGame.gameId === game.gameId) {
            await setRunningGame(game);
          }
        }

        const foundSocket = IO.sockets.sockets.get(player.socketId);
        if (player.socketId !== null && !foundSocket) {
          console.log("LEAVE GAME :::: socket not found ", player.socketId, foundSocket);
          await deleteInitialGun(player.userId);
          player = await deletePlayer(player);
          if (!player) {
            console.log(
              '::::::::::::::: failed deleting player on ___ LEAVE_TABLE ___ ',
              player,
              playerId,
            );
          }
        }

        if (socket && socket.leave) socket.leave(game.gameId);
        console.log("leftPlayers ::::: ", leftPlayers);
        if (leftPlayers.length === 1) {
          console.log(
            '::::::::::: only one player has left :::::::::::::::',
            game,
          );

          await clearSpwaningHealth(game.gameId);
          await clearSpwaningGun(game.gameId);

          /**
           * stop all timer
           */
          await ExpireGameQueueEnd(game.gameId);
          await ExpireSoonGameQueueEnd(game.gameId);

          game.tableStatus = 0;
          game.rematchTime = 0;

          function comparekill(a, b) {
            if (a.killCount > b.killCount) {
              return -1;
            }
            if (a.killCount < b.killCount) {
              return 1;
            }
            return 0;
          }

          console.log("LEAVE TABLE :::::::: 1");

          allPlayers = allPlayers.sort(comparekill);

          console.log("Leave Table all Players :: ", allPlayers);

          const gunSpawedKey = `${CONSTANTS.REDIS.SPAWNED_GUN}:${game.gameId}`;
          const itemSpawedKey = `${CONSTANTS.REDIS.SPAWNED_ITEM}:${game.gameId}`;

          await redisClient.del(gunSpawedKey);
          await redisClient.del(itemSpawedKey);

          console.log("LEAVE TABLE :::::::: 2");

          IO.sockets.to(allPlayersSocketIds).emit(
            CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED,
            makeResponse({
              msg: 'Game over',
              scoreBoard: allPlayers,
              gameId: game.gameId,
              rematchSlug: '',
              rematchTime: '0',
              en: CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED,
            }),
          );

          console.log("LEAVE TABLE :::::::: 3");

          expiredGames[game.gameId] = true;

          for (let i = 0; i < game.players.length; i++) {
            await stopSendingActionEvent(game.players[i]);

            const gotPlayer = await getPlayer(game.players[i]);

            const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${game.gameId}:${gotPlayer.userId}`;
            await redisClient.del(KEY);

            if (gotPlayer && gotPlayer.socketId !== null) {
              await deleteInitialGun(gotPlayer.userId);
              console.log("DELETTING :::::::::::::: PLAYER :::::::::::::: ", gotPlayer, gotPlayer.socketId);
              const playerSocketInstance = IO.sockets.sockets.get(player.socketId);
              if (playerSocketInstance) {
                await deletePlayer(gotPlayer);
              }
            }

            if (gotPlayer.isWaiting === true) await WaitingPlayerQueueEnd(game.players[i]);
            if (game.spawned.includes(game.players[i])) await SpawnPlayerQueueEnd(game.players[i]);
          }

          if (player.inFull === true && player.isRematch === false) await deleteFullRunningGame(game);
          else if (player.isRematch === true) {
            const KEY = `${CONSTANTS.REDIS.REMATCH_GAME_SLOT}:${game.gameId}`;
            await redisClient.del(KEY);

            debugging("deleting rematch game ");
            console.log(game);

            await deleteRematchGame(game);
          } else {
            let runningGame = await getRunningGame();
            if (runningGame.gameId === game.gameId) {
              await deleteRunningGame(game);
            }
          }
          resolve();
          return;
        } else {
          const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${player.gameId}:${player.userId}`;
          await redisClient.del(KEY);

          /**
           * remove player in db from every corner
           */
          if (player.socketId !== null) {
            console.log("deleting player ::::: ", player, player.socketId);

            player = await deletePlayer(player);
            if (!player) {
              console.log(
                '::::::::::: failed deleting player on ___ LEAVE_GAME ___',
                player,
                playerId,
              );
            }
          }
          resolve();
          return;
        }
      }
    } catch (e) {
      showError(e);
      reject(e);
      return;
    }
  });
};

export const playerData = async (
  data,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      data.playerId = data.playerId
        ? data.playerId
        : socket.handshake.auth.playerId;
      data.gameId = data.gameId ? data.gameId : socket.handshake.auth.gameId;

      console.log('PLAYER_DATA :::', data);

      IO.to(data.gameId).emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAYER_DATA_SUCCESS,
        makeResponse({
          ...data,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAYER_DATA_SUCCESS,
        }),
      );

      resolve();
    } catch (e) {
      socket.emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAYER_DATA_FAIL,
        makeResponse({
          msg: `something went wrong : ${e.message}`,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAYER_DATA_FAIL,
        }),
      );
      reject(e);
    }
  });
};

export const byteDataMove = async (
  data,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      // console.log(IO.sockets);
      data.playerId = data.playerId
        ? data.playerId
        : socket.handshake.auth.playerId;
      data.gameId = data.gameId ? data.gameId : socket.handshake.auth.gameId;

      socket.broadcast
        .to(data.gameId)
        .emit(
          CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_MOVE_SUCCESS,
          Buffer.from(data.byteData),
        );

      resolve();
    } catch (e) {
      socket.emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_FAIL,
        makeResponse({
          msg: `something went wrong : ${e.message}`,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_FAIL,
        }),
      );
      reject(e);
    }
  });
};

export const byteDataShoot = async (
  data,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      data.playerId = data.playerId
        ? data.playerId
        : socket.handshake.auth.playerId;
      data.gameId = data.gameId ? data.gameId : socket.handshake.auth.gameId;

      // console.log('::::::::::::::::::::: BDSS :::::::::::::::::', data);

      if (data.byteData && data.byteData.length > 0) {
        // console.log(
        //   ':::::::::::: sending data :::::::::::: ',
        //   Buffer.from(data.byteData),
        // );

        socket.broadcast
          .to(data.gameId)
          .emit(
            CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_SHOOT_SUCCESS,
            Buffer.from(data.byteData),
          );
      }
      resolve();
    } catch (e) {
      socket.emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_FAIL,
        makeResponse({
          msg: `something went wrong : ${e.message}`,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_FAIL,
        }),
      );
      reject(e);
    }
  });
};

export const playerMove = async (
  data,
  acknowledgement,
  socket: any,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const {playerId} = socket.handshake.auth;

      let player = await getPlayer(playerId);
      player.lastPosition = data.position;
      player = await setPlayer(player);
      const playerPositionKey = `${CONSTANTS.REDIS.PLAYER_POSITION}:${data.gameId}:${data.playerId}`;
      await redisSetKeyValue(
        playerPositionKey,
        {
          position: data.position,
        },
        true,
      );
    } catch (e) {
      global.logger.error(e);
      reject(e);
    }
  });
};

var allPings = {}
var leftTrackPings = {}

export const ping = async (
  data,
  acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      socket.handshake.auth.ping = true;

      if (expiredGames[socket.handshake.auth.gameId] === true) {
        socket.emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAY_GAME,
          makeResponse({
            msg: 'your last game is finished',
            code: 'LAST_GAME_FINISHED',
            en: eventName,
          }),
        );
        resolve();
        return;
      }

      await DisconnectQueueEnd(socket.handshake.auth.playerId);

      // console.log("PING Event :: ", data, socket.handshake.auth.playerId, new Date());

      if (socket.handshake.auth.playerId) {
        if (socket.handshake.auth.playerId in allPings) clearTimeout(allPings[socket.handshake.auth.playerId]);
        // if (socket.handshake.auth.playerId in leftTrackPings) clearTimeout(leftTrackPings[socket.handshake.auth.playerId]);

        const KEY = `${CONSTANTS.REDIS.PING}:${socket.handshake.auth.playerId}`;
        await redisClient.set(KEY, JSON.stringify({ id: socket.id }));

        allPings[socket.handshake.auth.playerId] = setTimeout(async () => {
          const KEY = `${CONSTANTS.REDIS.PING}:${socket.handshake.auth.playerId}`;
          await redisClient.del(KEY);
        }, CONSTANTS.GAME.PING_TIMEOUT);
      
      }
      resolve();
      return;

    } catch (e) {
      console.error(e);
      reject(e);
    }
  })
}

export const switchGun = async (
  data,
  acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("switchGun DATA : ", data);
      const playerId = socket.handshake.auth.playerId;

      let player = await getPlayer(playerId);
      if (player) {
        player.curGun = parseInt(data.curGun);
        const playerGun = player.playerGun;
        const playerSGun = player.playerSGun;
        const playerGunId = player.playerGunId;
        const playerSGunId = player.playerSGunId;
        const gunAmmoCount = player.gunAmmoCount;
        const gunSAmmoCount = player.gunSAmmoCount;
        const gunMaxAmmoCount = player.gunMaxAmmoCount;
        const gunSMaxAmmoCount = player.gunSMaxAmmoCount;
        const damageRate = player.gunDamageRate;
        const damageSRate = player.gunSDamageRate;
        const fireRate = player.gunFireRate;
        const fireSRate = player.gunSFireRate;
        const magazine = player.magazine;
        const sMagazine = player.sMagazine;
        const curAmmo = player.curAmmo;
        const curSAmmo = player.curSAmmo;
        const magCount = player.magCount;
        const sMegCount = player.sMegCount;

        if (player.curGun !== player.playerGun) {
          player.playerGun = playerSGun;
          player.playerSGun = playerGun;
          player.playerGunId = playerSGunId;
          player.playerSGunId = playerGunId;
          player.gunAmmoCount = gunSAmmoCount
          player.gunSAmmoCount = gunAmmoCount;
          player.gunMaxAmmoCount = gunSMaxAmmoCount;
          player.gunSMaxAmmoCount = gunMaxAmmoCount;
          player.gunDamageRate = damageSRate;
          player.gunSDamageRate = damageRate;
          player.gunFireRate = fireSRate;
          player.gunSFireRate = fireRate;
          player.magazine = sMagazine;
          player.sMagazine = magazine;
          player.sMegCount = magCount;
          player.magCount = sMegCount;
          player.curAmmo = player.curSAmmo;
          player.curSAmmo = player.curAmmo;
        }
        player = await setPlayer(player);

        IO.sockets.to(player.gameId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.SWITCH_GUN, makeResponse({
          playerId: playerId,
          gameId: player.gameId,
          curGun: player.curGun,
          curGunId: player.curGun === player.playerGun ? player.playerGunId : player.playerSGunId,
          secGun: player.playerSGun === player.curGun ? player.playerGun : player.playerSGun,
          secGunId: player.playerSGun === player.curGun ? player.playerGunId : player.playerSGunId,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.SWITCH_GUN
        }));

        console.log("************** emited SWITCH_GUN *************", {
          playerId: playerId,
          gameId: player.gameId,
          curGun: player.curGun,
          curGunId: player.curGun === player.playerGun ? player.playerGunId : player.playerSGunId,
          secGun: player.playerSGun === player.curGun ? player.playerGun : player.playerSGun,
          secGunId: player.playerSGun === player.curGun ? player.playerGunId : player.playerSGunId,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.SWITCH_GUN
        });
        resolve();
        return;

      } else {
        debugging("player not fond in SWITCH_GUN");
        resolve();
        return;
      }

    } catch (e) {
      console.error(e);
      reject(e);
    }
  })
}

export const cached = async (
  data,
  acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("cached recieved : ", data);
      const {playerId} = data;

      let player = await getPlayer(playerId);
      if (!player) {
        console.log("######################### Player not found in cached #########################");
        resolve();
        return;
      }

      if (player.curGun !== data.curGunID) {
        const gunId = player.playerGunId;
        const gunSId = player.playerSGunId;

        player.curGun = data.curGunID;
        player.playerGunId = gunSId;
        player.playerGun = data.curGunID;

        player.playerSGun = data.sGunID;
        player.playerSGunId = gunId;
      }
      player.sMegCount = data.s_magCount;
      player.curSAmmo = data.s_ammoCount;
      player.gunSAmmoCount = data.s_maxAmmoCount;
      player.magCount = data.magCount;
      player.gunAmmoCount = data.maxAmmoCount;
      player.curAmmo = data.ammoCount;

      player = await setPlayer(player);

    } catch (e) {
      console.error(e);
      reject(e);
    }
  })
}

export const recievedExpired = async (
  data,
  acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("recievedExpired data : ", data);
      const {playerId} = data;

      let player = await getPlayer(playerId);
      if (!player) {
        console.log("######################### Player not found in cached #########################");
        resolve();
        return;
      }

      await deletePlayer(player);

    } catch (e) {
      console.error(e);
      reject(e);
    }
  })
}