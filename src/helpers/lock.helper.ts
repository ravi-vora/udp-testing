import {Redis} from 'ioredis';
import Redlock from 'redlock';
import { redisConfig } from '../config/redis.config.js';
import { LOG } from './utils.helper.js';

let redlock: any;

const registerRedlockError = (): void => {
    redlock.on("error", (error: Error) => {
        // Ignore cases where a resource is explicitly marked as locked on a client.
        // if (error instanceof ResourceLockedError) {
        //     return;
        // }

        // LOG all other errors.
        // console.log('REDIS_LOCK_ERROR', error);
    });
}

const initializeRedlock = () => {
    if (redlock) return redlock;
    const redisDetails: any = {
        host: redisConfig.host,
        port: parseInt(redisConfig.port),
        password: redisConfig.password,
        db: parseInt(redisConfig.database_number)
    };
    console.log("redisDetails ::: ", redisDetails);


    const redisClient = new Redis(redisDetails);

    redisClient.on('error', (err) => {
        console.error('Redis Client Lock Error :: ', err.message)
        process.exit(0);
    });

    redlock = new Redlock([redisClient], {
        // The expected clock drift; for more details see:
        driftFactor: 0.01, // multiplied by lock ttl to determine drift time
        // ∞ retries
        retryCount: -1,
        // the time in ms between attempts
        retryDelay: 25, // time in ms
        // the max time in ms randomly added to retries
        // to improve performance under high contention
        retryJitter: 20, // time in ms
        // The minimum remaining time on a lock before an extension is automatically
        // attempted with the using API.
        // automaticExtensionThreshold: 500, // time in ms
    });

    registerRedlockError();
    return redlock;
};

export const Lock = {
    init: initializeRedlock,
    getLock: () => redlock,
}
