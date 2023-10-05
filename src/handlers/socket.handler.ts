import { Socket } from 'socket.io';
import { CONSTANTS } from '../config/constants.config.js';
import { LOG, makeResponse, parsePayload } from '../helpers/utils.helper.js';
import { joinGame, playGame } from './game.handler.js';
import { Acknowledgement } from '../config/interfaces.config.js';
import {
  action,
  byteDataMove,
  byteDataShoot,
  cached,
  grenadeThrow,
  gunPickup,
  healthUpdate,
  ingameScore,
  leaveGame,
  ping,
  playerData,
  playerMove,
  recievedExpired,
  switchGun,
} from './player.handler.js';

import zlib from 'zlib'
import { debugging } from '../helpers/logger.helper.js';

var handlers = {};

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.TEST}`] = async (
  data,
  acknowledgement,
  socket,
  eventName,
) =>
  await (async (data, acknowledgement, socket, eventName) => {
    acknowledgement({
      eventName,
      data,
      socketId: socket.id,
    });
  })(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAY_GAME}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await playGame(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.JOIN_GAME}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await joinGame(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAYER_DATA}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await playerData(data, acknowledgement, socket, eventName);

// handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_MOVE}`] = async (
//   data: any,
//   acknowledgement: Acknowledgement,
//   socket: Socket,
//   eventName: string,
// ) => await byteDataMove(data, acknowledgement, socket, eventName);

// handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_SHOOT}`] = async (
//   data: any,
//   acknowledgement: Acknowledgement,
//   socket: Socket,
//   eventName: string,
// ) => await byteDataShoot(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.HEALTH_UPDATE}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await healthUpdate(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.GUN_PICKUP}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await gunPickup(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.PLAYER_MOVE}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await playerMove(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.ACTION}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await action(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.LEAVE_TABLE}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await leaveGame(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.GRENADE_THROW}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await grenadeThrow(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.INGAME_SCORE}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await ingameScore(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.PING}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await ping(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.SWITCH_GUN}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await switchGun(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.CACHED}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await cached(data, acknowledgement, socket, eventName);

handlers[`${CONSTANTS.SOCKET.EVENTS.CUSTOM.EXPIRED_RECIEVE}`] = async (
  data: any,
  acknowledgement: Acknowledgement,
  socket: Socket,
  eventName: string,
) => await recievedExpired(data, acknowledgement, socket, eventName);

export const SocketHandler = async (socket: Socket): Promise<void> => {
  return new Promise((resolve, reject) => {
    socket.onAny(async (eventName, value, acknowledgement) => {
      // console.log(eventName, value);

      try { 
        // --- START UTF-8 ---
        // value = parsePayload(value, false);
        // --- END UTF-8 ---


        // --- START ENC ---
        if (eventName === 'ACTION') console.log("::::::: ACTION ::::: ", eventName, value);
        const ignoreCompression = [CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_MOVE, CONSTANTS.SOCKET.EVENTS.CUSTOM.BYTE_DATA_SHOOT, CONSTANTS.SOCKET.EVENTS.CUSTOM.ACTION];

        if (value && !ignoreCompression.includes(eventName)) value = JSON.parse(zlib.unzipSync(value).toString('utf8'));
        // --- END ENC ---


        handlers[eventName]
          ? await handlers[eventName](value, (data: any) => {
            socket.emit("ACK", makeResponse(data));
          }, socket, eventName)
          : (async () => {
            debugging('wrong event name');
            console.log("EventName ::: ", eventName);
            console.log("Value ::: ", value);
            socket.emit('wrong', {
              msg: 'wrong event name',
            });
          })();
        resolve();
        return;
      } catch (e) {
        console.log("VALUE::", value);
        global.logger.info('wrong payload again');
        global.logger.error(e.message);
        acknowledgement({
          msg: e.message,
        });
        reject(e);
        return;
      }
    });
  });
};
