import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from './redis.service.js';
import { httpServer } from './server.service.js';
import { Server, Socket } from 'socket.io';
import { CONSTANTS } from '../config/constants.config.js';
import { SocketHandler } from '../handlers/socket.handler.js';
import { disconnectPlayer } from '../handlers/player.handler.js';
import { debugging } from '../helpers/logger.helper.js';
import { LOG } from '../helpers/utils.helper.js';
// import { instrument } from "@socket.io/admin-ui";

export let IO: Server = null;
export var SocketBroadCast: any = null;

export const initSocketConnection = async (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      IO = new Server(httpServer, {
        cors: {
          origin: '*',
        },
        transports: ['websocket'],
        allowEIO3: true,
        pingTimeout: 40000, //15000,
        pingInterval: 10000, //8000,
        maxHttpBufferSize: 1e8,
      });
      IO.adapter(createAdapter(pubClient, subClient));

      // instrument(IO, {
      //     auth: false,
      //     readonly: true
      // })

      IO.on(CONSTANTS.SOCKET.EVENTS.CORE.CONNECT, async (socket: Socket) => {
        debugging("New Connection :: " + socket.id);
        socket.on(CONSTANTS.SOCKET.EVENTS.CORE.DISCONNECT, async (reason) => {
          debugging(reason + ' {' + socket.id + '}');
          await disconnectPlayer(socket);
        });

        socket.on('error', (e) => {
          global.logger.error(e);
        });

        SocketBroadCast = socket.broadcast;

        // console.log('_____ NEW_CONNECTION _____ :: ', socket.id);
        // console.log(
        //   '_____ TOTAL_CONNECTIONS _____ :: ',
        //   IO.sockets.adapter.sids,
        // );

        await SocketHandler(socket);
        // socket.use(SocketHandler.bind(socket));
      });
      global.logger.info(
        `Socket connection established successfully ✔ pid : ${process.pid}`,
      );
      resolve();
      return;
    } catch (e) {
      global.logger.error(`socket failed : ${e.message}`);
    }
  });
};
