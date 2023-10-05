import {io, Socket} from 'socket.io-client';

let base_url = 'http://localhost:5000';

describe("mini-militia", () => {
  let clientSocket, clientSocket2;

  beforeAll((done) => {
    clientSocket = io(base_url);
    clientSocket2 = io(base_url);
      
    clientSocket.on("connect", done);
  });

  afterAll(() => {
    clientSocket.close();
    clientSocket2.close();
  });

  let gameId, gameId2;

  test("should be emiting PLAY_GAME 1, recieve PLAY_GAME_SUCCESS", (done) => {
    clientSocket.on('JOIN_GAME', (arg) => {
        gameId = JSON.parse(arg).gameId;
        expect(Object.keys(JSON.parse(arg))).toMatchObject(['gameId', 'en']);
        done();
    })

    clientSocket.emit("PLAY_GAME", {
        deviceId: 1
    }, (arg) => {
        expect(Object.keys(JSON.parse(arg))).toMatchObject(['userId', 'socketId', 'isWaiting', 'deadCount', 'killCount', 'en']);
        // done();
    });
  });

  test("should be emiting PLAY_GAME 2, recieve PLAY_GAME_SUCCESS", (done) => {
    clientSocket2.on('JOIN_GAME', (arg) => {
        gameId2 = JSON.parse(arg).gameId;
        expect(Object.keys(JSON.parse(arg))).toMatchObject(['gameId', 'en']);
        done();
    })


    clientSocket2.emit("PLAY_GAME", {
        deviceId: 2
    }, (arg) => {
        expect(Object.keys(JSON.parse(arg))).toMatchObject(['userId', 'socketId', 'isWaiting', 'deadCount', 'killCount', 'en']);
        // done();
    });
  });

  const playerJoinGameResponse = ['playerPosition', 'playerCloth', 'playerGun', 'gameId', 'playerId', 'grenades', 'playersList', 'expiredAt', 'isRejoin', 'isRematch', 'droppedGuns', 'last_position', 'fireCount', 'bulletLeft', 'totalBullet', 'en'];


  let playerId, playerId2;

  test("should be emiting JOIN_GAME 1, recieve JOIN_GAME_SUCCESS", (done) => {
    clientSocket.emit("JOIN_GAME", {
        gameId: gameId
    }, (arg) => {
        playerId = JSON.parse(arg).playerId
        expect(Object.keys(JSON.parse(arg))).toMatchObject(playerJoinGameResponse);
        done();
    });
  });

  test("should be emiting JOIN_GAME 2, recieve JOIN_GAME_SUCCESS", (done) => {
    clientSocket2.emit("JOIN_GAME", {
        gameId: gameId2
    }, (arg) => {
        expect(Object.keys(JSON.parse(arg))).toMatchObject(playerJoinGameResponse);
        done();
    });
  });

  const response = ['gameId', 'playerId', 'position', 'en']

  test("should be recieving 50000 movement events", (done) => {
    let recieved = 0;
    clientSocket2.on('PLAYER_MOVE_SUCCESS', (arg) => {
        recieved += 1;
        expect(JSON.parse(arg).position).toEqual('49999');
        done();
    })
  })

  test("should be emiting 50000 movement events", (done) => {
    let recieved = 0;
    clientSocket2.on('PLAYER_MOVE_SUCCESS', (arg) => {
        recieved += 1;
        expect(JSON.parse(arg).position).toEqual('49999');
            done();
    })

    for(let i = 0; i < 50000; i++) {
        clientSocket.emit("PLAYER_MOVE", {
            gameId: gameId,
            playerId: playerId,
            position: i.toString()
        }, (args) => {});
    }
    done();
  });
});