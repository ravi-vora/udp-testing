import * as PinoLOGger from 'pino';
import fs from 'fs';
import { dirname, join } from 'path'
import { fileURLToPath } from 'url';
import { connectToRedis } from "./services/redis.service.js";
import { initializeServer } from "./services/server.service.js";
import { initSocketConnection } from "./services/socket.service.js";
import { Lock } from './helpers/lock.helper.js';
import { initializeUDPServer } from './services/udp.service.js';
import { LOG } from './helpers/utils.helper.js';

process.env.TZ = "Asia/Calcutta";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = PinoLOGger.pino({
  level: process.env.PINO_LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});
global.logger = logger;

connectToRedis().then(() => { 
  initializeUDPServer().then(() => {
    Lock.init();
 
    initializeServer().then(() => {

      initSocketConnection().then().catch(e => {
        console.trace('failed initializing socket connection.' + e.message);
        console.error(e);
      })
    }).catch(e => {
      console.trace('failed initializing http server ' + e.message);
      console.error(e);
    })
  }).catch(e => {
    console.error(e);
    console.trace(e);
  })
}).catch(e => {
  console.trace('failed redis connection ' + e.message);
  console.error(e);
})