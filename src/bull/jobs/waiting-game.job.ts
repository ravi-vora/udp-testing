import { CONSTANTS } from '../../config/constants.config.js';
import { GameStatus } from '../../config/interfaces.config.js';
import { debugging, showError } from '../../helpers/logger.helper.js';
import { deleteEmptyGame, deleteFullRunningGame, deleteInitialGun, deletePlayer, deleteRematchGame, deleteRunningGame, getEmptyGame, getFullRunningGame, getPlayer, getRematchGame, getRunningGame, setEmptyGame, setFullRunningGame, setRematchGame } from '../../helpers/redis.helper.js';
import { LOG, findAndRemove, makeResponse } from '../../helpers/utils.helper.js';
import { IO } from '../../services/socket.service.js';
import { startNewUdpServer } from '../../services/udp.service.js';
import { DisconnectQueueEnd } from '../queues/disconnect.queue.js';
import { waitingPlayerQueueStart } from '../queues/waiting-player.queue.js';

export const waitingGameJob = async (job, done): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Waiting Game job executing >>>>> ');
      /**
       * FIXME: all timers should start here, not in joinGame
       */

      const {gameId} = job.data;
      /**
       * check,
       * 1. minimum player are available and online
       * 2. start the game / unable to start the game
       */
      let game = await getFullRunningGame(gameId);
      game = !game ? await getRunningGame() : game;
      game = !game || (game && game?.gameId !== gameId) ? await getRematchGame(gameId) : game;

      if (!game) {
        /**
         * check if the game is still in emptyGame
         */
        game = await getEmptyGame();
        if (game?.gameId === gameId) {

          /**
           * * unable to start the game
           */
          for (let i = 0; i < game.players.length; i++) {
            let gotPlayer = await getPlayer(game.players[i]);
            if (gotPlayer && gotPlayer.socketId !== null) {

              await deleteInitialGun(gotPlayer.userId);
              if (gotPlayer && gotPlayer.socketId === null) await DisconnectQueueEnd(gotPlayer.userId);

              console.log("FAILED MATCH ::: ", {
                gameId: CONSTANTS.GAME.FAILED_MATCH_CODE,
                msg: CONSTANTS.GAME.FAILED_MATCH_MESSAGE,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH
              });

              IO.to(gotPlayer.socketId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH, makeResponse({
                gameId: CONSTANTS.GAME.FAILED_MATCH_CODE,
                msg: CONSTANTS.GAME.FAILED_MATCH_MESSAGE,
                port: 0,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH
              }));
            }
            game.players = findAndRemove(game.players, gotPlayer.userId);
            gotPlayer = await deletePlayer(gotPlayer);
          }

          game = await setEmptyGame(game);
          if (game.players.length <= 1) {
            game = await deleteEmptyGame(game);
          }

        } else {
          debugging("????????????????????? failed getting game at all ?????????????????????");
          done(new Error("????????????????????? failed getting game at all ?????????????????????"));
        }
      } else if (game.players.length >= CONSTANTS.GAME.MINIMUM_PLAYERS_TO_START) {

        let connectedUser = [];
        for (let i = 0; i < game.players.length; i++) {
          let gotPlayer = await getPlayer(game.players[i]);
          if (gotPlayer.socketId) {
            const socket = IO.sockets.sockets.get(gotPlayer?.socketId);
            socket.join(gotPlayer.gameId);
            if (gotPlayer && gotPlayer.socketId !== null && socket) connectedUser.push(gotPlayer);
          }

        } 

        console.log("connectedUser :::::::::::::::::: ", connectedUser);

        if (connectedUser.length >= CONSTANTS.GAME.MINIMUM_PLAYERS_TO_START) {
          let gameStatus : GameStatus = null;
          for (let i = 0; i < connectedUser.length; i++) {
            await waitingPlayerQueueStart({
              playerId: connectedUser[i].userId,
              gameId: connectedUser[i].gameId,
            });
            IO.to(connectedUser[i].socketId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME, makeResponse({
              gameId: connectedUser[i].gameId,
              port: game.UDPPort,
              msg: "",
              en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME
            }))

            console.log("joinGame emitted :: ", {
              gameId: connectedUser[i].gameId,
              port: game.UDPPort,
              msg: "",
              en: CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME
            })
            gameStatus = connectedUser[i].inFull === true ? GameStatus.FullRunningGame : connectedUser[i].isRematch === true ? GameStatus.RematchGame : GameStatus.RunningGame;
          }

          if (gameStatus === GameStatus.RunningGame) {
            game = await deleteRunningGame(game);
            if (!game) {
              debugging("????????????????? failed deleting runningGame !!!!!!!!!!!!!");
            } else {
              game.started = true;
              game = await setFullRunningGame(game);
            }
          } else if (gameStatus === GameStatus.FullRunningGame) {
            game.started = true;
            game = await setFullRunningGame(game);
          } else if (gameStatus === GameStatus.RematchGame) {
            game.started = true;
            game = await setRematchGame(game);
          }
        } else {
          /**
           * * unable to start the game
           */
          let gameStatus : GameStatus = null;
          for (let i = 0; i < game.players.length; i++) {
            let gotPlayer = await getPlayer(game.players[i]);
            
            await deleteInitialGun(gotPlayer.userId);
            if (gotPlayer && gotPlayer.socketId === null) await DisconnectQueueEnd(gotPlayer.userId);
            console.log("failed match making :::: ", game.players);
            if (gotPlayer && gotPlayer.socketId !== null) {
              IO.to(gotPlayer.socketId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH, makeResponse({
                gameId: CONSTANTS.GAME.FAILED_MATCH_CODE,
                msg: CONSTANTS.GAME.FAILED_MATCH_MESSAGE,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH
              }));

              console.log("failed match :: ", {
                gameId: CONSTANTS.GAME.FAILED_MATCH_CODE,
                msg: CONSTANTS.GAME.FAILED_MATCH_MESSAGE,
                en: CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH
              });
            }

            gotPlayer = await deletePlayer(gotPlayer);
            gameStatus = gotPlayer.inFull === true ? GameStatus.FullRunningGame : gotPlayer.isRematch === true ? GameStatus.RematchGame : GameStatus.RunningGame;
          }

          game = gameStatus === GameStatus.FullRunningGame ? await deleteFullRunningGame(game) : gameStatus === GameStatus.RematchGame ? await deleteRematchGame(game) : await deleteRunningGame(game);
        }

      } else {
        /**
         * * unable to start the game
         */
        let gameStatus : GameStatus = null;
        for (let i = 0; i < game.players.length; i++) {
          let gotPlayer = await getPlayer(game.players[i]);

          await deleteInitialGun(gotPlayer.userId);
          if (gotPlayer && gotPlayer.socketId === null) await DisconnectQueueEnd(gotPlayer.userId);

          if (gotPlayer && gotPlayer.socketId !== null) {
            IO.to(gotPlayer.socketId).emit(CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH, makeResponse({
              gameId: CONSTANTS.GAME.FAILED_MATCH_CODE,
              msg: CONSTANTS.GAME.FAILED_MATCH_MESSAGE,
              en: CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH
            }));

            console.log("FAILED MATCH :: ", {
              gameId: CONSTANTS.GAME.FAILED_MATCH_CODE,
              msg: CONSTANTS.GAME.FAILED_MATCH_MESSAGE,
              en: CONSTANTS.SOCKET.EVENTS.CUSTOM.FAILED_MATCH
            });
          }
          gotPlayer = await deletePlayer(gotPlayer);
          gameStatus = gotPlayer.inFull === true ? GameStatus.FullRunningGame : gotPlayer.isRematch === true ? GameStatus.RematchGame : gotPlayer.isWaiting === true ? GameStatus.EmptyGame : GameStatus.RunningGame;
        }

        game = gameStatus === GameStatus.FullRunningGame ? await deleteFullRunningGame(game) : gameStatus === GameStatus.RematchGame ? await deleteRematchGame(game) : gameStatus === GameStatus.EmptyGame ? await deleteEmptyGame(game) : await deleteRunningGame(game);
        
      }

      console.log('Waiting Game job executing end >>>>> '); 

      done();
      resolve();
      return;
    } catch (e) {
      showError(e);
      reject(e);
    }
  });
};
