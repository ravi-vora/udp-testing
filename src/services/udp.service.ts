import dgram from 'node:dgram';
import { config } from 'dotenv';
import { debugging } from '../helpers/logger.helper.js';
import { getFullRunningGame, getRematchGame, getRunningGame } from '../helpers/redis.helper.js';
import { LOG, UDPData } from '../helpers/utils.helper.js';
import { UDPLink } from '../config/interfaces.config.js';
import { CONSTANTS } from '../config/constants.config.js';
config();

export var UDPSocket : dgram.Socket = null;

let count = 0;
export var ports = [];

export const initializeUDPServer = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        try { 

            // UDPSocket = dgram.createSocket('udp4');
            // UDPSocket.on('connect', () => {
            //     debugging("UDP new client connected");
            //     UDPSocket.send(Buffer.from('this is server message on connection'), 12345, '192.168.21.16', () => {
            //         console.log('message has been sent to the clint on new connection');
            //     })
            // })

            // UDPSocket.on('error', (err) => {
            //     console.error(`server error:\n${err.stack}`);
            //     UDPSocket.close();
            // });
            
            // UDPSocket.on('message', (msg, senderInfo) => { 

            //     // const userId = msg.toString('utf8').split("~").at(-1);
            //     // const gameId = msg.toString('utf8').split("~").at(-2);

            //     // console.log("ids :::", userId, gameId, UDPData[gameId]);

            //     // UDPData[gameId][userId].Port = senderInfo.port; 
            //     // UDPData[gameId][userId].IP = senderInfo.address;

            //     // console.log("user's current port :::::: ", senderInfo.port, " stored port :: ", UDPData[gameId][userId].Port);
            //     // for (const userId of Object.keys(UDPData[gameId])) {

            //     //     UDPSocket.send(msg, UDPData[gameId][userId].Port, UDPData[gameId][userId].IP, () => {
            //     //         // console.log(`Message have been sent to the:: ${UDPData[gameId][userId].IP}:${UDPData[gameId][userId].Port}, msg :: ${msg}`);
            //     //         return;
            //     //     })
            //     // }

            //     UDPSocket.send(msg, senderInfo.port, senderInfo.address, () => {
            //         console.log(`Message have been sent to the:: ${senderInfo.address}:${senderInfo.port}, msg :: ${msg}`);
            //         return;
            //     })
                
            // });

            // UDPSocket.on('listening', () => {
            //     UDPSocket.setBroadcast(true);
            //     const address = UDPSocket.address();
            //     console.log(`UDP server listening on ${address.address}:${address.port}`);
            // });
            // UDPSocket.bind(parseInt(process.env.UDP_PORT) || 7013);

            const firstUDPServer = startNewUdpServer('172.22.11.57', parseInt(process.env.UDP_PORT));
            // const secondUDPServer = startNewUdpServer('15.206.228.239', 7014);
            resolve();
            return;

        } catch (e) {
            console.error(e);
            reject(e);  
        }
    }) 
}

export var playersGamePort = {}
export var playersUdpAddress = {}

export const startNewUdpServer = (address: string, port: number) => {
    try {

        const UDPServer : dgram.Socket = dgram.createSocket('udp4');

        UDPServer.on('connect', () => {
            console.log("new udp connection");
        })
        
        // UDPServer.addMembership("192.168.0.255", "::%eth1");
        UDPServer.on('message', (msg, senderInfo) => {
            console.log(playersUdpAddress);

            if (!playersUdpAddress[UDPServer.address().port]) playersUdpAddress[UDPServer.address().port] = {}

            playersUdpAddress[UDPServer.address().port][senderInfo.port] = {
                address: senderInfo.address,
                port: senderInfo.port
            }

            for (const player_N of Object.keys(playersUdpAddress[UDPServer.address().port])) {

                UDPServer.send(msg, playersUdpAddress[UDPServer.address().port][player_N]['port'], playersUdpAddress[UDPServer.address().port][player_N]['address'], () => {
                    // process.stdout.write(`Message have been sent to the:: ${playersUdpAddress[UDPServer.address().port][player_N]['address']}:${playersUdpAddress[UDPServer.address().port][player_N]['port']}:${senderInfo.family}`);
                    return;
                })
            }
            
        });
        UDPServer.on('listening', () => {
            const address = UDPServer.address();
            console.log(`UDP server listening on ${address.address}:${address.port}`);
        });
        UDPServer.bind(port);

        return UDPServer;

    } catch(e) {
        throw e;
    }
}