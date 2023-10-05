import {
  Acknowledgement,
  EmptyGame,
  FullRunningGame,
  Gun,
  Player,
  PlayerPosition,
  RematchGame,
  RunningGame,
  TableStatus,
  User,
} from '../config/interfaces.config.js';
import { Socket } from 'socket.io';
import {
  deleteEmptyGame,
  deleteInitialGun,
  deletePlayer,
  deleteRunningGame,
  getEmptyGame,
  getFullRunningGame,
  getGun,
  getLastPosition,
  getPlayer,
  getRematchGame,
  getRematchSlug,
  getRunningGame,
  getUser,
  setEmptyGame,
  setFullRunningGame,
  setInitialGun,
  setPlayer,
  setRematchGame,
  setRunningGame,
  setUser,
} from '../helpers/redis.helper.js';
import {
  UDPData,
  addMinutes,
  expiredGamesCached,
  findAndRemove,
  generateEmptyGameId,
  generatePlayerId,
  generateUniquePort,
  generateUserId,
  getRandomArbitrary,
  makeResponse,
  sendNewPlayerJoined,
  startSendingActionEvent,
  startSpwaningGuns,
  startSpwaningHealthKit,
} from '../helpers/utils.helper.js';
import { v4 } from 'uuid';
import { CONSTANTS } from '../config/constants.config.js';
import { IO } from '../services/socket.service.js';
import { redisClient } from '../services/redis.service.js';
import {
  ExpireGameQueueStart,
  getExpireGameQueue,
} from '../bull/queues/expire-game.queue.js';
import {
  ExpireSoonGameQueueStart,
  getExpireSoonGameQueue,
} from '../bull/queues/expire-soon-game.queue.js';
import {
  WaitingPlayerQueueEnd,
} from '../bull/queues/waiting-player.queue.js';
import { debugging, showError } from '../helpers/logger.helper.js';
import { DisconnectQueueEnd } from '../bull/queues/disconnect.queue.js';
import { RematchExpireQueueEnd } from '../bull/queues/rematch.queue.js';
import { waitingGameQueueStart } from '../bull/queues/waiting-game.queue.js';
import { GUNS_ARRAY, gunsFireRate } from '../config/gunsArray.config.js';
import crypto from 'crypto';
import { Lock } from '../helpers/lock.helper.js';
import { ingameScore } from './player.handler.js';
import { SpawnPlayerQueueStart } from '../bull/queues/spawn-player.queue.js';
import { startNewUdpServer } from '../services/udp.service.js';

export const newPlayerPlayGame = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (
        !('deviceId' in data) ||
        !('isRematch' in data) ||
        !('rematchSlug' in data)
      ) {
        global.logger.error('invalid request payload');
        global.logger.info(data);
        resolve();
        return;
      } else {
        /**
         * get random gun for new player.
         */
        const randomIndex = getRandomArbitrary(0, 5);
        const gun: Gun = await getGun(randomIndex);
        if (!gun) throw new Error('gun is not available, for new player.');

        /**
         * create new player
         */
        var address = socket.handshake.address;
        var regex = /(\d+)\.(\d+)\.(\d+)\.(\d+)/;
        var match = address.match(regex);

        

        let player: Player = {
          port: generateUniquePort(),
          ip: data.ip,
          id: generatePlayerId(),
          userId: data.deviceId,
          userName: data.userName,
          socketId: socket.id,
          gameId: data.rematchSlug,
          isWaiting: true,
          isRejoin: false,
          deadCount: 0,
          killCount: 0,
          health: 100,
          gunAmmoCount: GUNS_ARRAY[2].ammoCount,
          gunMaxAmmoCount: GUNS_ARRAY[2].ammoCount,
          gunFireRate: GUNS_ARRAY[2].fireRate,
          gunDamageRate: GUNS_ARRAY[2].damageRate,
          magazine: GUNS_ARRAY[2].magazine,

          gunSAmmoCount: GUNS_ARRAY[1].ammoCount,
          gunSMaxAmmoCount: GUNS_ARRAY[1].ammoCount,
          gunSFireRate: GUNS_ARRAY[1].fireRate,
          gunSDamageRate: GUNS_ARRAY[1].damageRate,
          sMagazine: GUNS_ARRAY[1].magazine,

          isRematch: data.isRematch === true ? true : false,
          playerPosition: null,
          playerCloth: null,
          curGun: GUNS_ARRAY[2].index,
          curAmmo: GUNS_ARRAY[2].ammoCount,
          curSAmmo: GUNS_ARRAY[1].ammoCount,
          
          playerGun: GUNS_ARRAY[2].index,
          playerGunId: crypto.randomBytes(CONSTANTS.GAME.UNIQUE_ID_LENGTH).toString("hex"),
          playerSGun: GUNS_ARRAY[1].index,
          playerSGunId: crypto.randomBytes(CONSTANTS.GAME.UNIQUE_ID_LENGTH).toString("hex"),
          match_slug: v4(),
          inFull: false,
          grenades: CONSTANTS.GAME.DEFAULT_GRENADES,
          winAmount: 300,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastPosition: 'none',
          isKill: false,
          magCount: GUNS_ARRAY[2].ammoCount / GUNS_ARRAY[2].magazine,
          sMegCount: GUNS_ARRAY[1].ammoCount / GUNS_ARRAY[1].magazine,
          recievedBoard: true
        };

        let initialGun = await setInitialGun(player);
        if (!initialGun) {
          console.log(':::::::::: failed setting up initial gun on player creation :::::::::');
          resolve();
          return;
        }

        socket.handshake.auth.playerId = player.userId;
        if (player.isRematch === true) {
          socket.handshake.auth.gameId = data.rematchSlug;
          const gameId = data.rematchSlug;

          const rematchSlug = await getRematchSlug(gameId);
          if (!rematchSlug) {
            acknowledgement(
              makeResponse({
                msg: 'not a valid rematch',
                en: eventName,
              }),
            );
            resolve();
            return;
          } else {

            let rematchGame = await getRematchGame(data.rematchSlug);
            if (rematchGame) {
              console.log('::::::::::: found game :::::::::::', rematchGame);

              /**
               * setup unique position
               */
              let positions = [...rematchGame.uniqueThings.player_positions];
              let cloths = [...rematchGame.uniqueThings.cloths];

              const randomPositionIndex = getRandomArbitrary(
                0,
                positions.length,
              );
              const randomClothIndex = getRandomArbitrary(0, cloths.length);

              player.playerPosition = positions[randomPositionIndex];
              player.playerCloth = cloths[randomClothIndex];

              console.log('randomPositionIndex :: ', randomPositionIndex);
              console.log('randomClothIndex', randomClothIndex);

              rematchGame.uniqueThings.player_positions = findAndRemove(
                positions,
                player.playerPosition,
              );
              rematchGame.uniqueThings.cloths = findAndRemove(
                cloths,
                player.playerCloth,
              );
              /**
               * create new player with found gameId
               */
              if (!rematchGame.players.includes(player.userId)) {
                rematchGame.players.push(player.userId);
                rematchGame.UDP[player.userId] = {
                  IP: player.ip,
                  Port: player.port
                }
              }
              player.gameId = rematchGame.gameId;
              player = await setPlayer(player);
              if (!player)
                console.log(
                  ':::::::::: failed creating new player while connecting with other game',
                );

              rematchGame = await setRematchGame(rematchGame);
              if (!rematchGame) {
                console.log('failed updating rematch game');
              }

              if (
                rematchGame.players.length >=
                CONSTANTS.GAME.MINIMUM_PLAYERS_TO_START
              ) {
                player.gameId = rematchGame.gameId;
                player.isWaiting = false;
                player = await setPlayer(player);
                if (!player) {
                  console.log(
                    'failed updating player on rematch -> isWaiting = false',
                  );
                }

                console.log(
                  ':::::: found more than minimum to start :::::::::::::::',
                );
                
                const expireTime: Date = addMinutes(new Date(rematchGame.createdAt), CONSTANTS.GAME.START_IN_AFTER());
                const now: Date = new Date();
                var leftTimeToExpire = expireTime.getTime() - now.getTime();
                leftTimeToExpire = leftTimeToExpire / 1000;

                // TODO: confusion
                acknowledgement(
                  makeResponse({
                    startIn: 0,
                    ...player,
                    en: eventName,
                  }),
                );

                for (let i = 0; i < rematchGame.players.length; i++) {
                  let foundPlayer = await getPlayer(rematchGame.players[i]);
                  foundPlayer.isWaiting = false;
                  foundPlayer = await setPlayer(foundPlayer);
                  if (foundPlayer && foundPlayer.socketId !== null) {
                    IO.to(foundPlayer.socketId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME, makeResponse({
                      gameId: rematchGame.gameId,
                      msg: '',
                      port: rematchGame.UDPPort,
                      en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                    }));
                  }
                }
                resolve();
                return;
              } else {
                player.gameId = rematchGame.gameId;
                player.isWaiting = false;
                player = await setPlayer(player);
                if (!player) {
                  console.log(
                    'failed updating player on rematch -> isWaiting = false',
                  );
                }

                console.log(
                  ':::::: found less than minimum to start :::::::::::::::',
                );

                const expireTime: Date = addMinutes(new Date(rematchGame.createdAt), 0.33);
                const now: Date = new Date();
                var leftTimeToExpire = expireTime.getTime() - now.getTime();
                leftTimeToExpire = leftTimeToExpire / 1000;

                acknowledgement(
                  makeResponse({
                    startIn: 0,
                    ...player,
                    en: eventName,
                  }),
                );

                console.log('REMATCH GAME ::::: ', rematchGame);
                if (
                  rematchGame.players.length ===
                  CONSTANTS.GAME.MINIMUM_PLAYERS_TO_START
                ) {
                  for (let i = 0; i < rematchGame.players.length; i++) {
                    let gotPlayer = await getPlayer(rematchGame.players[i]);
                    if (gotPlayer) {
                      console.log('GOT PLAYER ::: ', gotPlayer);

                      gotPlayer.isWaiting = false;
                      gotPlayer = await setPlayer(gotPlayer);
                      if (gotPlayer) {
                        IO.to(gotPlayer.socketId).emit(
                          CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                          makeResponse({
                            gameId: rematchGame.gameId,
                            port: rematchGame.UDPPort,
                            msg: "",
                            en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                          }),
                        );
                      }
                    }
                  }
                }
                resolve();
                return;
              }
            } else {
              /**
               * create player
               */
              player.gameId = gameId;

              /**
               * setup unique position
               */
              let positions = [...CONSTANTS.GAME.PLAYER_POSITIONS];
              let cloths = [...CONSTANTS.GAME.PLAYER_CLOTHS];

              const randomPositionIndex = getRandomArbitrary(
                0,
                positions.length,
              );
              const randomClothIndex = getRandomArbitrary(0, cloths.length);

              player.playerPosition = positions.at(randomPositionIndex);
              player.playerCloth = cloths.at(randomClothIndex);

              player = await setPlayer(player);
              if (!player)
                console.log(':::::::::: failed updating player :::::::::');

              console.log('::: created player :::: ', player);

              let rematchGame: RematchGame = {
                id: data.rematchSlug,
                gameId: data.rematchSlug,
                players: [player.userId],
                expired: false,
                expiredAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                rematchTime: 0,
                tableStatus: 0,
                droppedGuns: [],
                spawned: [],
                uniqueThings: {
                  player_positions: findAndRemove(
                    positions,
                    player.playerPosition,
                  ),
                  cloths: findAndRemove(cloths, player.playerCloth),
                },
                started: false,
                UDP: {
                  [player.userId]: {
                    IP: player.ip,
                    Port: player.port
                  }
                },
                UDPPort: generateUniquePort()
              };

              rematchGame = await setRematchGame(rematchGame);
              if (!rematchGame) {
                console.log(
                  ':::::::::::: failed creating rematchGame ::::::::::::::',
                );
                resolve();
                return;
              }

              const expireTime: Date = addMinutes(new Date(rematchGame.createdAt), 0.33);
              const now: Date = new Date();
              var leftTimeToExpire = expireTime.getTime() - now.getTime();
              leftTimeToExpire = leftTimeToExpire / 1000;

              acknowledgement(
                makeResponse({
                  startIn: leftTimeToExpire,
                  ...player,
                  en: eventName,
                }),
              );

              // await waitingGameQueueStart({ gameId: rematchGame.gameId });
              resolve();
              return;
            }
          }
        } else {
          /**
           * check for runningGame to start playing for new player
           */
          let game = await getRunningGame();
          game = !game ? await getEmptyGame() : game;

          if (game) {
            socket.handshake.auth.gameId = game.gameId;
            console.log('::::::::::: found game :::::::::::', game);

            /**
             * setup unique position
             */
            let positions = [...game.uniqueThings.player_positions];
            let cloths = [...game.uniqueThings.cloths];

            const randomPositionIndex = getRandomArbitrary(0, positions.length);
            const randomClothIndex = getRandomArbitrary(0, cloths.length);

            player.playerPosition = positions.at(randomPositionIndex);
            player.playerCloth = cloths.at(randomClothIndex);

            console.log('randomPositionIndex :: ', randomPositionIndex);
            console.log('randomClothIndex', randomClothIndex);

            /**
             * create new player with found gameId
             */
            player.gameId = game.gameId;
            player = await setPlayer(player);
            if (!player)
              console.log(
                ':::::::::: failed creating new player while connecting with other game',
              );

            console.log('::::: created player ::::: ', player);

            if (game.players.length < CONSTANTS.GAME.MINIMUM_PLAYERS_TO_START) {
              // its emptyGame

              if (!game.players.includes(player.userId)) {
                game.players.push(player.userId);
                game.UDP[player.userId] = {
                  IP: player.ip,
                  Port: player.port
                }

                UDPData[game.gameId] = game.UDP;
              }

              if (
                game.players.length >= CONSTANTS.GAME.MINIMUM_PLAYERS_TO_START &&
                game.players.length >= CONSTANTS.GAME.MAX_PLAYER_PER_GAME &&
                CONSTANTS.GAME.MINIMUM_PLAYERS_TO_START ===
                  CONSTANTS.GAME.MAX_PLAYER_PER_GAME
              ) {
                game = await deleteEmptyGame(game);
                if (!game)
                  console.log(
                    ':::::::::: failed deleting emptyGame :::::::::::::',
                  );

                /**
                 * convert emptyGame to fullRunningGame
                 */
                if (!game.players.includes(player.userId)) {
                  game.players.push(player.userId);
                  game.UDP[player.userId] = {
                    IP: player.ip,
                    Port: player.port
                  }

                  UDPData[game.gameId] = game.UDP;
                }

                game.uniqueThings.player_positions = findAndRemove(
                  positions,
                  player.playerPosition,
                );
                game.uniqueThings.cloths = findAndRemove(
                  cloths,
                  player.playerCloth,
                );
                game = await setFullRunningGame(game);
                if (!game)
                  console.log(
                    '::::::::: failed updating existing runningGame with new Player.',
                  );

                console.log(
                  '::::::::::: created fullRunningGame ::::::::::',
                  game,
                );
                
                const expireTime: Date = addMinutes(new Date(game.createdAt), CONSTANTS.GAME.START_IN_AFTER());
                const now: Date = new Date();
                var leftTimeToExpire = expireTime.getTime() - now.getTime();
                leftTimeToExpire = leftTimeToExpire / 1000;

                player.isWaiting = false;
                acknowledgement(
                  makeResponse({
                    startIn: leftTimeToExpire,
                    ...player,
                    en: eventName,
                  }),
                );

                for (let i = 0; i < game.players.length; i++) {
                  let findPlayer = await getPlayer(game.players[i]);
                  console.log(
                    '::: fullRuningGame -> findPlayer ::: ',
                    findPlayer,
                  );

                  if (findPlayer) {
                    findPlayer.inFull = true;
                    findPlayer.isWaiting = false;
                    findPlayer = await setPlayer(findPlayer);
                    if (!findPlayer)
                      console.log(
                        ':::::::::::: failed updating player in emptyGame -> fullRunningGame transformation :::::::::::',
                      );
                  }
                }
                console.log("check 1::");
                await sendNewPlayerJoined(game);

                resolve();
                return;
              } else if (
                game.players.length >= CONSTANTS.GAME.MINIMUM_PLAYERS_TO_START
              ) {
                game = await deleteEmptyGame(game);
                if (!game)
                  console.log(
                    ':::::::::::::: failed deleting emptyGame :::::::::::::',
                  );

                if (!game.players.includes(player.userId)) {
                  UDPData[game.gameId] = game.UDP;
                  game.players.push(player.userId);
                  game.UDP[player.userId] = {
                    IP: player.ip,
                    Port: player.port
                  }
                }

                /**
                 * convert emptyGame to runningGame
                 */
                game.uniqueThings.player_positions = findAndRemove(
                  positions,
                  player.playerPosition,
                );
                game.uniqueThings.cloths = findAndRemove(
                  cloths,
                  player.playerCloth,
                );
                game = await setRunningGame(game);
                if (!game)
                  console.log(
                    '::::::::: failed updating existing runningGame with new Player.',
                  );

                console.log(':::::::: created runningGame :::::::', game);

                const expireTime: Date = addMinutes(new Date(game.createdAt), CONSTANTS.GAME.START_IN_AFTER());
                const now: Date = new Date();
                var leftTimeToExpire = expireTime.getTime() - now.getTime();
                leftTimeToExpire = leftTimeToExpire / 1000;

                player.isWaiting = false;
                acknowledgement(
                  makeResponse({
                    startIn: leftTimeToExpire,
                    ...player,
                    en: eventName,
                  }),
                );

                for (let i = 0; i < game.players.length; i++) {
                  let findPlayer = await getPlayer(game.players[i]);

                  console.log('::::: runningGame -> findPlayer ::::', findPlayer);
                  if (findPlayer) {
                    findPlayer.isWaiting = false;
                    findPlayer = await setPlayer(findPlayer);
                    if (!findPlayer)
                      console.log(
                        ':::::::::::: failed updating player in emptyGame -> runningGame transformation :::::::::::',
                      );

                    // IO.to(findPlayer.socketId).emit(
                    //   CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                    //   makeResponse({
                    //     gameId: findPlayer.gameId,
                    //     en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                    //   }),
                    // );
                  }
                }

                console.log("check 2::");
                await sendNewPlayerJoined(game);
                resolve();
                return;
              } else {
                if (!game.players.includes(player.userId))
                {
                  game.players.push(player.userId);
                  game.UDP[player.userId] = {
                    IP: player.ip,
                    Port: player.port
                  }
                  UDPData[game.gameId] = game.UDP;
                }

                game.uniqueThings.player_positions = findAndRemove(
                  positions,
                  player.playerPosition,
                );
                game.uniqueThings.cloths = findAndRemove(
                  cloths,
                  player.playerCloth,
                );
                game = await setEmptyGame(game);
                if (!game)
                  console.log(
                    ':::::::::: failed updating emptyGame with new user.',
                  );

                console.log(':::::: updating emptyGame :::::::::', game);


                const expireTime: Date = addMinutes(new Date(game.createdAt), CONSTANTS.GAME.START_IN_AFTER());
                const now: Date = new Date();
                var leftTimeToExpire = expireTime.getTime() - now.getTime();
                leftTimeToExpire = leftTimeToExpire / 1000;

                /**
                 * just update the emptyGame and return with default new player response.
                 */
                acknowledgement(
                  makeResponse({
                    startIn: leftTimeToExpire,
                    ...player,
                    en: eventName,
                  }),
                );

                console.log("check 3::");
                await sendNewPlayerJoined(game);

                resolve();
                return;
              }
            } else {
              // its runningGame

              if (!game.players.includes(player.userId)) {
                game.players.push(player.userId);
                game.UDP[player.userId] = {
                  IP: player.ip,
                  Port: player.port
                }
                UDPData[game.gameId] = game.UDP;
              }
              if (game.players.length === CONSTANTS.GAME.MAX_PLAYER_PER_GAME) {
                game = await deleteRunningGame(game);
                if (!game) console.log('::::: failed deleting runningGame :::::');

                if (!game.players.includes(player.userId))
                  game.players.push(player.userId);

                game.uniqueThings.player_positions = findAndRemove(
                  positions,
                  player.playerPosition,
                );
                game.uniqueThings.cloths = findAndRemove(
                  cloths,
                  player.playerCloth,
                );
                game = await setFullRunningGame(game);
                if (!game)
                  console.log(
                    '::::::::: failed creating fullRunningGame while creating new player.',
                  );

                console.log(':::: created fullRunningGame :::: ', game);

                const expireTime: Date = addMinutes(new Date(game.createdAt), CONSTANTS.GAME.START_IN_AFTER());
                const now: Date = new Date();
                var leftTimeToExpire = expireTime.getTime() - now.getTime();
                leftTimeToExpire = leftTimeToExpire / 1000;

                acknowledgement(
                  makeResponse({
                    startIn: leftTimeToExpire,
                    ...player,
                    en: eventName,
                  }),
                );

                player.inFull = true;
                player.isWaiting = false;
                player = await setPlayer(player);
                if (!player)
                  console.log(
                    ':::::::::: failed updating player while transforming runningGame to fullRunningGame ::::::::::',
                  );

                  console.log("check 4::");
                  await sendNewPlayerJoined(game);

                // socket.emit(
                //   CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                //   makeResponse({
                //     gameId: player.gameId,
                //     en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                //   }),
                // );
                resolve();
                return;
              } else {
                player.isWaiting = false;
                player = await setPlayer(player);
                if (!player) console.log('failed creating new player');

                if (!game.players.includes(player.userId))
                  game.players.push(player.userId);

                game.uniqueThings.player_positions = findAndRemove(
                  positions,
                  player.playerPosition,
                );
                game.uniqueThings.cloths = findAndRemove(
                  cloths,
                  player.playerCloth,
                );
                game = await setRunningGame(game);
                if (!game) console.log('failed updating new runningGame');

                console.log(':::: updated runningGame :::::', game);

                const expireTime: Date = addMinutes(new Date(game.createdAt), CONSTANTS.GAME.START_IN_AFTER());
                const now: Date = new Date();
                var leftTimeToExpire = expireTime.getTime() - now.getTime();
                leftTimeToExpire = leftTimeToExpire / 1000;

                acknowledgement(
                  makeResponse({
                    startIn: leftTimeToExpire,
                    ...player,
                    en: eventName,
                  }),
                );
                console.log("check 5::");
                await sendNewPlayerJoined(game);

                // socket.emit(
                //   CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                //   makeResponse({
                //     gameId: player.gameId,
                //     en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                //   }),
                // );
                resolve();
                return;
              }
            }
          } else {
            const gameId = `G_${v4()}`;

            socket.handshake.auth.gameId = gameId;

            /**
             * create player
             */
            player.gameId = gameId;

            /**
             * setup unique position
             */
            let positions = [...CONSTANTS.GAME.PLAYER_POSITIONS];
            let cloths = [...CONSTANTS.GAME.PLAYER_CLOTHS];

            const randomPositionIndex = getRandomArbitrary(0, positions.length);
            const randomClothIndex = getRandomArbitrary(0, cloths.length);

            player.playerPosition = positions.at(randomPositionIndex);
            player.playerCloth = cloths.at(randomClothIndex);

            player = await setPlayer(player);
            if (!player)
              console.log(':::::::::: failed updating player :::::::::');

            console.log('::: created player :::: ', player);

            /**
             * create new empty game and return with new player response
             */
            let emptyGame: EmptyGame = {
              id: generateEmptyGameId(),
              gameId: gameId,
              players: [player.userId],
              createdAt: new Date(),
              updatedAt: new Date(),
              expired: false,
              expiredAt: null,
              rematchTime: null,
              tableStatus: TableStatus.emptyGame,
              droppedGuns: [],
              uniqueThings: {
                player_positions: findAndRemove(positions, player.playerPosition),
                cloths: findAndRemove(cloths, player.playerCloth),
              },
              spawned: [],
              started: false,
              UDP: {
                [player.userId]: {
                  IP: player.ip,
                  Port: player.port
                }
              },
              UDPPort: generateUniquePort()
            };

            UDPData[emptyGame.gameId] = emptyGame.UDP;

            emptyGame = await setEmptyGame(emptyGame);
            if (!emptyGame)
              console.log(':::::::::: failed creating EmptyGame :::::::::');

            console.log('created emptyGame :: ', emptyGame);

            const expireTime: Date = addMinutes(new Date(emptyGame.createdAt), CONSTANTS.GAME.START_IN_AFTER());
            const now: Date = new Date();
            var leftTimeToExpire = expireTime.getTime() - now.getTime();
            leftTimeToExpire = leftTimeToExpire / 1000;

            acknowledgement(
              makeResponse({
                startIn: leftTimeToExpire,
                ...player,
                en: eventName,
              }),
            );
            
            await waitingGameQueueStart({ gameId: emptyGame.gameId });
            console.log("check 6::");
            await sendNewPlayerJoined(emptyGame);

            resolve();
            return;
          }
        }

      }
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};

export const playGame = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const lock = await Lock.getLock().acquire([`LOCK:PLAY_GAME:${socket.handshake.auth.gameId}`], 2000);
    try {
      /**
       * check user is exist or not
       */
      let user: User = await getUser(data.deviceId);
      if (!user) {
        /**
         * pick unique username
         */
        let uniqueAvailableNames = await redisClient.get(
          CONSTANTS.REDIS.UNIQUE_NAMES,
        );
        if (uniqueAvailableNames)
          uniqueAvailableNames = JSON.parse(uniqueAvailableNames);

        const allKeys = Object.keys(uniqueAvailableNames);
        const randomIndex = getRandomArbitrary(0, allKeys.length);
        const randomKey = allKeys[randomIndex];
        const randomName = uniqueAvailableNames[randomKey];

        delete uniqueAvailableNames[randomKey];

        await redisClient.set(
          CONSTANTS.REDIS.UNIQUE_NAMES,
          JSON.stringify(uniqueAvailableNames),
        );

        user = await setUser({
          id: generateUserId(),
          deviceId: data.deviceId,
          userName: randomName,
          purchasedGun: [],
          purchasedCloths: [],
        });
        if (!user) {
          reject(new Error('failed creating new user on redis db.'));
          throw new Error('failed creating new user on redis db.');
        }
      }

      data['userName'] = user.userName;

      /**
       * check if player profile exist of [user].
       */
      let player = await getPlayer(user.deviceId);

      console.log("reconnection :::: ", player);
        
      debugging("player not found in isRemach -> true reconnection :::");

      if (player) {
        socket.handshake.auth.playerId = player.userId;
        socket.handshake.auth.gameId = player.gameId;

        if (player.health <= 0) player.health = 100;
        player.isRejoin = true;
        player.socketId = socket.id;// FIXME: confusion -> needs to be cleared
        player = await setPlayer(player);
        if (!player) {
          console.log("failed updating player's socketId on reconnect.");
        }

        if (player.isRematch === true) {

          console.log("************** rematch reconnection :: player.isRematch **************", player.isRematch, player.userId);
          let rematchGame = await getRematchGame(player.gameId);
          if (rematchGame) {
            console.log("************** rematch reconnection :: rematchGame.gameId **************", rematchGame.gameId, player.userId);

            socket.handshake.auth.gameId = rematchGame.gameId;
            acknowledgement(
              makeResponse({
                startIn: 0,
                ...player,
                en: eventName,
              }),
            );

            console.log("emitted play_game", eventName);
            console.log("player is waiting ", player.isWaiting);

            if (player.isWaiting === false) {
              socket.emit(
                CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                makeResponse({
                  gameId: player.gameId,
                  msg: "",
                  port: rematchGame.UDPPort,
                  en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                }),
              );
              console.log("emited join_game", CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME);
            }
            resolve();
            return;
          } else {

            if (expiredGamesCached[player.gameId]) {
              const endTime = (new Date(expiredGamesCached[player.gameId].rematchEndTime).getTime() - new Date().getTime()) / 1000;
              delete expiredGamesCached[player.gameId].rematchEndTime;

              expiredGamesCached[player.gameId].rematchTime = endTime && endTime <= 0 ? '0' : endTime.toString();

              socket.emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED, makeResponse({
                ...expiredGamesCached[player.gameId],
                userId: player.userId
              }));
              await deletePlayer(player);
              resolve();
              return;
            }
            // const expiredGameKey = `${CONSTANTS.REDIS.EXPIRED_GAME}:${player.gameId}`;
            // let expireGame = await redisClient.get(expiredGameKey);
            // if (expireGame) {
            //   expireGame = JSON.parse(expireGame);

            //   await showExpiredGameScoreBoard(expireGame, socket);
            // } else {
              
            // }

            const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${player.gameId}:${player.userId}`;
            await redisClient.del(KEY);

            await deleteInitialGun(player.userId);

            player = await deletePlayer(player);
            if (!player) {
              console.log(new Error('failed deleting player.'));
            }

            acknowledgement(
              makeResponse({
                msg: 'your last game is finished',
                code: 'LAST_GAME_FINISHED',
                en: eventName,
              }),
            );
            resolve();
            return;
          }
        } else if (player.inFull === true) {
          /**
           * get fullRunningGame
           */
          const fullRunningGame: FullRunningGame = await getFullRunningGame(
            player.gameId,
          );
          if (!fullRunningGame) {
            if (expiredGamesCached[player.gameId]) {
              const endTime = (new Date(expiredGamesCached[player.gameId].rematchEndTime).getTime() - new Date().getTime()) / 1000;
              delete expiredGamesCached[player.gameId].rematchEndTime;

              expiredGamesCached[player.gameId].rematchTime = endTime && endTime <= 0 ? '0' : endTime.toString();
              socket.emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.GAME_EXPIRED, makeResponse({
                ...expiredGamesCached[player.gameId],
                userId: player.userId
              }));
              await deletePlayer(player);
              resolve();
              return;
            }
            // const expiredGameKey = `${CONSTANTS.REDIS.EXPIRED_GAME}:${player.gameId}`;
            // let expireGame = await redisClient.get(expiredGameKey);

            // console.log("expiredGame ::", expireGame, player);
            // if (expireGame) {
            //   console.log(":::::::::::::::::: found expired game ::::::::::::::::::");
            //   expireGame = JSON.parse(expireGame);

            //   await showExpiredGameScoreBoard(expireGame, socket);
            // } else {
              
            // }

            console.log(":::::::::::::::::: not found expired game ::::::::::::::::::");
            const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${player.gameId}:${player.userId}`;
            await redisClient.del(KEY);

            await deleteInitialGun(player.userId);

            player = await deletePlayer(player);
            if (!player) {
              console.log(new Error('failed deleting player.'));
            }

            acknowledgement(
              makeResponse({
                msg: 'your last game is finished',
                code: 'LAST_GAME_FINISHED',
                en: eventName,
              }),
            ); 
            resolve();
            return;
          }

          acknowledgement(
            makeResponse({
              startIn: 0,
              ...player,
              en: eventName,
            }),
          );
          socket.emit(
            CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
            makeResponse({
              gameId: fullRunningGame.gameId,
              msg: '',
              port: fullRunningGame.UDPPort,
              en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
            }),
          );

          
          console.log("check 7::");
          // await sendNewPlayerJoined(fullRunningGame);
          resolve();
          return;
        } else {
          let runningGame: RunningGame = await getRunningGame();
          if (runningGame && runningGame.gameId === player.gameId) {
            acknowledgement(
              makeResponse({
                startIn: 0,
                ...player,
                en: eventName,
              }),
            );

            if (player.isWaiting === false) {
              socket.emit(
                CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                makeResponse({
                  gameId: player.gameId,
                  msg: "",
                  port: runningGame.UDPPort,
                  en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME,
                }),
              );
            }

            resolve();
            return;
          } else {
            let emptyGame: EmptyGame = await getEmptyGame();
            if (emptyGame && emptyGame.gameId === player.gameId) {

              const expireTime: Date = addMinutes(new Date(emptyGame.createdAt), CONSTANTS.GAME.START_IN_AFTER());
              const now: Date = new Date();
              var leftTimeToExpire = expireTime.getTime() - now.getTime();
              leftTimeToExpire = leftTimeToExpire / 1000;

              acknowledgement(
                makeResponse({
                  startIn: leftTimeToExpire,
                  ...player,
                  en: eventName,
                }),
              );
              console.log("check 8::");
              // await sendNewPlayerJoined(emptyGame);
              resolve();
              return;
            } else {
              const KEY = `${CONSTANTS.REDIS.PLAYER_POSITION}:${player.gameId}:${player.userId}`;
              await redisClient.del(KEY);

              await deleteInitialGun(player.userId);

              player = await deletePlayer(player);
              if (!player) {
                console.log(new Error('failed deleting player.'));
              }

              acknowledgement(
                makeResponse({
                  msg: 'your last game is finished',
                  code: 'LAST_GAME_FINISHED',
                  en: eventName,
                }),
              );
              resolve();
              return;

              // await newPlayerPlayGame(data, acknowledgement, socket, eventName);
              // resolve();
              // return;
            }
          }
        }
      } else {
        /**
         * a function that create new player and put it on to waiting or in a game,
         */
        await newPlayerPlayGame(data, acknowledgement, socket, eventName);
      }
    } catch (e) {
      console.error(e);
      reject(e);
    } finally {
      await Lock.getLock().release(lock);
    }
  });
};

export const joinGame = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
): Promise<void> => { 
  return new Promise(async (resolve, reject) => {
    const lock = await Lock.getLock().acquire([`LOCK:JOIN_GAME:${socket.handshake.auth.gameId}`], 2000);
    try {
      /**
       * find which type of the game user is trying to join
       * 1. get player detailes
       */
      data.playerId = socket.handshake.auth.playerId;
      data.gameId = !data.gameId ? socket.handshake.auth.gameId : data.gameId;
      socket.join(data.gameId);

      // FIXME: in future this will global timer, will need customization...
      await WaitingPlayerQueueEnd(data.playerId);

      /**
       * stop disconnect player timer
       */
      await DisconnectQueueEnd(data.playerId);

      let player = await getPlayer(data.playerId);
      if (!player) {
        console.log(
          ':::::::::::::: player not found in joinGame :::::::::::::::::::',
          player,
          socket.handshake.auth.playerId,
        );
        resolve();
        return;
      }

      /**
       * find game details of the player
       */
      let game =
        player.inFull === true
          ? await getFullRunningGame(player.gameId)
          : player.isRematch
          ? await getRematchGame(player.gameId)
          : await getRunningGame();
      if (!game || (game && game.gameId !== player.gameId)) {
        console.log(
          ':::::::::::::::: game details not found in joinGame :::::::::::::::::',
        );
        resolve();
        return;
      }

      let playersList = [];
      for (let i = 0; i < game.players.length; i++) {
        const foundPlayer = await getPlayer(game.players[i]);
        let PING = await redisClient.get(`${CONSTANTS.REDIS.PING}:${game.players[i]}`);
        const socket = IO.sockets.sockets.get(player?.socketId);
        if (foundPlayer && PING) {
          playersList.push(foundPlayer);
        } else if (foundPlayer && foundPlayer.socketId !== null) {
          playersList.push(foundPlayer);
        } else if (socket) {
          playersList.push(foundPlayer);
        }
      }

      if (!game.expiredAt) {
        const totalTime = addMinutes(
          new Date(),
          CONSTANTS.GAME.GAME_TIME_LIMIT,
        );
        game.expiredAt = totalTime;

        if (player.inFull === true && player.isRematch === false) await setFullRunningGame(game);
        else if (player.isRematch === true) await setRematchGame(game);
        else await setRunningGame(game);

        startNewUdpServer("15.206.228.239", game.UDPPort);
      }

      const expireTime: Date = new Date(game.expiredAt);
      const now: Date = new Date();
      var leftTimeToExpire = expireTime.getTime() - now.getTime();
      leftTimeToExpire = leftTimeToExpire / 1000;

      console.log(
        'Time Calculation ::: ',
        leftTimeToExpire,
        game.expiredAt,
        new Date(),
      );

      for (let i = 0; i < playersList.length; i++) {
        if (player.userId === playersList[i].userId) {
          if (player.curGun !== playersList[i].playerGun) {
            const magazine = playersList[i].magazine;
            const playerGun = playersList[i].playerGun;
            const playerGunId = playersList[i].playerGunId;
            const gunAmmoCount = playersList[i].gunAmmoCount;
            const gunMaxAmmoCount = playersList[i].gunMaxAmmoCount;
            const gunFireRate = playersList[i].gunFireRate;
            const gunDamageRate = playersList[i].gunDamageRate;

            if (playersList[i].curGun === playersList[i].playerSGun) {
              playersList[i].magazine = playersList[i].sMagazine;
              playersList[i].playerGun = playersList[i].playerSGun;
              playersList[i].playerGunId = playersList[i].playerSGunId;
              playersList[i].gunAmmoCount = playersList[i].gunSAmmoCount;
              playersList[i].gunMaxAmmoCount = playersList[i].gunSMaxAmmoCount;
              playersList[i].gunFireRate = playersList[i].gunSFireRate;
              playersList[i].gunDamageRate = playersList[i].gunSDamageRate;

              playersList[i].sMagazine = magazine;
              playersList[i].playerSGun = playerGun;
              playersList[i].playerSGunId = playerGunId;
              playersList[i].gunSAmmoCount = gunAmmoCount;
              playersList[i].gunSMaxAmmoCount = gunMaxAmmoCount;
              playersList[i].gunSFireRate = gunFireRate;
              playersList[i].gunSDamageRate = gunDamageRate;
            }

          }
        }
      }

      let gameMaid = {
        playerPosition: player.playerPosition,
        playerCloth: player.playerCloth,
        curGun: player.curGun,
        megCount: player.magCount,
        sMegCount: player.sMegCount,
        curAmmo: player.curAmmo,
        curSAmmo: player.curSAmmo,
        playerGun: player.playerGun,
        gunAmmoCount: player.gunAmmoCount,
        gunSAmmoCount: player.gunSAmmoCount,
        playerGunId: player.playerGunId,
        playerSGun: player.playerSGun,
        playerSGunId: player.playerSGunId,
        gameId: game.gameId,
        playerId: player.userId,
        grenades: player.grenades,
        playersList: playersList,
        expiredAt: leftTimeToExpire,
        isRejoin: player.isRejoin,
        isRematch: player.isRematch,
        droppedGuns: game.droppedGuns,
        isKill: player.isKill,
        gunsRate: [...gunsFireRate]
      };

      /**
       * get latest last_position
       */ 
      const playerPosition: PlayerPosition = await getLastPosition(
        game.gameId,
        player.userId,
      );
      if (playerPosition) {
        gameMaid['lastPosition'] = playerPosition.position;
      }
      else gameMaid['lastPosition'] = 'none';

      await RematchExpireQueueEnd(player.gameId);

      await startSpwaningHealthKit(
        game.gameId,
        CONSTANTS.GAME.HEALTH_KIT_TIME,
        socket.id
      );
      await startSpwaningGuns(game.gameId, CONSTANTS.GAME.GUN_TIME, socket.id);

      /**
       * start the game expire timer
       */
      const gameExpireJob = await getExpireGameQueue.getJob(game.gameId);
      if (!gameExpireJob) await ExpireGameQueueStart({ gameId: game.gameId });

      /**
       * start the game expire soon timer
       */
      const gameExpireSoonJob = await getExpireSoonGameQueue.getJob(
        game.gameId,
      );
      if (!gameExpireSoonJob)
        await ExpireSoonGameQueueStart({ gameId: game.gameId });

      

      /**
       * latest gun fired data
       */
      const KEY = `${CONSTANTS.REDIS.GUN_FIRED}:${game.gameId}:${player.userId}`;
      let gunData = await redisClient.get(KEY);
      if (gunData) {
        gunData = JSON.parse(gunData);
        gameMaid['fireCount'] = gunData.value.fireCount;
        gameMaid['bulletLeft'] = gunData.value.bulletLeft;
        gameMaid['totalBullet'] = gunData.value.totalBullet;
      } else {
        gameMaid['fireCount'] = 0;
        gameMaid['bulletLeft'] = CONSTANTS.GAME.BULLETS_PER_GUN;
        gameMaid['totalBullet'] = CONSTANTS.GAME.BULLETS_PER_GUN;
      }

      console.log("emitted join game success");

      socket.emit(
        CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME_SUCCESS,
        makeResponse({
          ...gameMaid,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME_SUCCESS,
        }),
      );

      console.log(" ******************* emmited -< JOIN_GAME_SUCCESS >- *******************", gameMaid);

      acknowledgement(
        makeResponse({
          ...gameMaid,
          en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME_SUCCESS,
        }),
      ); 

      if (
        game &&
        game.spawned.includes(player.userId) &&
        player.isKill === true && 
        player.recievedBoard === false
      ) {
        player = await setPlayer(player);
        
        if (player.recievedBoard === false) {
          await ingameScore(
            {
              playerId: player.userId,
              gameId: socket.handshake.auth.gameId
            },
            acknowledgement,
            socket,
            CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE,
          );
          player.recievedBoard = true;
          player = await setPlayer(player);

          await SpawnPlayerQueueStart({
            playerId: player.userId,
            gameId: socket.handshake.auth.gameId,
            delay: CONSTANTS.GAME.SPAWN_PLAYER_AFTER_KILL - 3000
          });
        } else {
          await startSendingActionEvent(player);
        }
        
        //await startSendingActionEvent(player);

      } else {
        console.log('::::::::::: nothing to spawned GAME::', game);
        console.log('::::::::::: nothing to spawned PLAYER ::', player);
        resolve();
        return;
      }
    } catch (e) {
      console.log('failed in joinGame :::: ', e.message);
      console.error(e);
      reject(e);
      return;
    } finally {
      await Lock.getLock().release(lock);
      resolve();
      return;
    }
  });
};
