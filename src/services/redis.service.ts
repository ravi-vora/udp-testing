import { createClient, RedisClientOptions } from 'redis';
import { getRedis, redisConfig, setRedis } from '../config/redis.config.js';
import { GUNS_ARRAY } from '../config/gunsArray.config.js';
import { CONSTANTS } from '../config/constants.config.js';
import { playerNames } from '../config/names.config.js';

export var redisClient: any = null;
export var pubClient: any = null;
export var subClient: any = null;

export const connectToRedis = () => {
    return new Promise( async (resolve, reject) => { 

        var redisConfiguration : RedisClientOptions = {
            socket: {
                host: redisConfig.host,
                port: parseInt(redisConfig.port)
            },
            database: parseInt(redisConfig.database_number),
            password: redisConfig.password
        }

        // if (process.env.NODE_ENV !== 'test') {
        //     redisConfiguration['password'] = redisConfig.password
        //     redisConfiguration['database'] = parseInt(redisConfig.database_number)
        // }

        const client = createClient(redisConfiguration);
        const subClientI = client.duplicate();
        
        subClientI.on('error', (err) => {
            global.logger.error('Redis Client Error', err.message)
            reject(err);
            process.exit(0);
        })
        client.on('error', (err) => {
            global.logger.error('Redis Client Error', err.message)
            reject(err);
            process.exit(0);
        });
        
        // connect 
        await client.connect();
        await subClientI.connect();


        redisClient = client;
        pubClient = client;
        subClient = subClientI;
        global.logger.info(`Redis connection established successfully ✔ pid : ${process.pid}`)

        GUNS_ARRAY.forEach(async gun => {
           let gunData = await redisGetKeyValue(`${CONSTANTS.REDIS.GUNS}:${gun.index}`);
           if(!gunData.success){
            await redisSetKeyValue(`${CONSTANTS.REDIS.GUNS}:${gun.index}`, gun, true, false);
           }
        });

        await redisClient.set(CONSTANTS.REDIS.UNIQUE_NAMES, JSON.stringify(playerNames));

        resolve(true);
        return;
    })
}

export const redisSetKeyValue = async (key: string, value: any, isJson: boolean = false, isExpire:boolean=true) : Promise<setRedis> => {
    return new Promise(async (resolve, reject) => {
        try {
            value = isJson ? JSON.stringify(value) : value;
            
            let stored = await redisClient.set(key, value)

            if (stored === 'OK') {
                resolve({
                    success: true,
                    stored: isJson ? JSON.parse(value) : value
                })
                return;
            } else {
                resolve({
                    success: false,
                    message: 'failed storing value on redis server'
                })
                return;
            }
        } catch(e) {
            resolve({
                success: false,
                message: e.message
            })
            return;
        }
    })
}

export const redisGetKeyValue = async (key: string, isJson: boolean = false) : Promise<getRedis> => {
    return new Promise(async (resolve, reject) => {
        try {
            var value = await redisClient.get(key)

            if (value) {
                if (isJson) value = JSON.parse(value)

                resolve({
                    success: true,
                    value
                })
                return;
            } else {
                resolve({
                    success: false,
                    message: 'not found'
                })
                return;
            }
        } catch(e) {
            resolve({
                success: false,
                message: `redis failed : ${e.message}`
            })
            return;
        }
    })
}