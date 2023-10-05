import http from 'http';
import https from 'https';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { LOG } from '../helpers/utils.helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export let httpServer: any = null;

export const initializeServer = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const { HTTPS_CERT, HTTPS_KEY } = process.env;

      const KeyPath = HTTPS_KEY ? HTTPS_KEY : '';
      const CertPath = HTTPS_CERT ? HTTPS_CERT : '';

      const port =
        process.env.NODE_ENV === 'production'
          ? process.env.PROD_PORT
          : process.env.DEV_PORT || 3000;

      if (existsSync(KeyPath) && existsSync(CertPath)) {
        global.logger.info(
          `[HTTPs] connection established successfully ✔ pid : ${process.pid}`,
        );
        const KeyData = readFileSync(KeyPath, 'utf-8');
        const CertData = readFileSync(CertPath, 'utf-8');

        const ServerOptions = { key: KeyData, cert: CertData };

        httpServer = https.createServer(ServerOptions);

        httpServer.listen(port, () => {
          console.log(`Server listening on port : ${port} !`);
        });
      } else {
        global.logger.info(
          `[HTTP] connection established successfully ✔ pid : ${process.pid}`,
        );

        httpServer = http.createServer();

        httpServer.listen(port, () => {
          console.log(`Server listening on port : ${port} !`);
        });
      }
      resolve();
      return;
    } catch (e) {
      reject(e);
    }
  });
};
