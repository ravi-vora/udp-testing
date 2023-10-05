import { rejects } from 'assert';
import { CONSTANTS } from '../config/constants.config.js';

export const validatePlayer = (data): { valid: boolean; errors?: object } => {
  try {
    const errors = {
      deviceId: [],
      isRematch: [],
      rematchSlug: [],
    };

    if (!('deviceId' in data) || data.deviceId === '')
      errors.deviceId.push(`'deviceId' is required`);
    if (!('isRematch' in data) || data.isRematch === '')
      errors.isRematch.push(`'isRematch' is required`);

    if (
      data.isRematch === true &&
      (!('rematchSlug' in data) || data.rematchSlug === '')
    )
      errors.rematchSlug.push(
        `'rematchSlug' is required, if isRematch -> true`,
      );

    if (
      errors.deviceId.length > 0 ||
      errors.isRematch.length > 0 ||
      errors.rematchSlug.length > 0
    ) {
      Object.keys(errors).forEach((error, index) => {
        if (errors[error].length < 1) delete errors[error];
      });
      return { valid: false, errors };
    } else return { valid: true };
  } catch (e) {
    global.logger.error(e);
    return { valid: false, errors: { general: [e.message] } };
  }
};

// export const validateMove = async (data: any) => {
//     const errors = {
//         gameId: [],
//         playerId: [],
//         position: [],
//         rotation: []
//     }

//     if (!data.gameId || data.gameId === '') errors.gameId.push('gameId is required.')
//     else {
//         try {
//             const foundGame = await Game.findOne({ gameId: data.gameId });

//             if (!foundGame) {
//                 errors.gameId.push('game not found with provided gameId')
//             }
//             if (foundGame && new Date(foundGame.expiredAt) < new Date()) {
//                 errors.gameId.push('gameId has been expired');
//             }

//             if (!data.playerId || data.playerId === '') errors.playerId.push("playerId is required.")
//             else if (foundGame && !foundGame.players.includes(data.playerId)) {
//                 errors.playerId.push("playerId has not joined with provided gameId.")
//             }
//         } catch(e) {
//             global.logger.error(e);
//             errors.gameId.push(e.message);
//         }
//     }

//     if (!data.position || data.position === '') errors.position.push('position is required')
//     if (!data.rotation || data.rotation === '') errors.rotation.push("rotation is required")

//     if (
//         errors.gameId.length > 0 ||
//         errors.playerId.length > 0 ||
//         errors.position.length > 0 ||
//         errors.rotation.length > 0
//     ) {
//         Object.keys(errors).map( (key: string, index: number) : void => {
//             if (errors[key].length < 1) delete errors[key];
//         })
//         return {
//             valid: false,
//             errors
//         }
//     } else return { valid: true }
// }

// export const validatePlayerData = async (data: any) => {
//     const errors = {
//         gameId: [],
//         playerId: [],
//         methodName: [],
//         value: []
//     }

//     if (!data.gameId || data.gameId === '') errors.gameId.push('gameId is required.')
//     else {
//         try {
//             const foundGame = await Game.findOne({ gameId: data.gameId });

//             if (!foundGame) {
//                 errors.gameId.push('game not found with provided gameId')
//             }
//             if (foundGame && new Date(foundGame.expiredAt) < new Date()) {
//                 errors.gameId.push('gameId has been expired');
//             }

//             if (!data.playerId || data.playerId === '') errors.playerId.push("playerId is required.")
//             else if (foundGame && !foundGame.players.includes(data.playerId)) {
//                 errors.playerId.push("playerId has not joined with provided gameId.")
//             }
//         } catch(e) {
//             global.logger.error(e);
//             errors.gameId.push(e.message);
//         }
//     }

//     if (!data.methodName || data.methodName === '') errors.methodName.push('methodName is required')
//     if (!data.value || data.value === '') errors.value.push("value is required")

//     if (
//         errors.gameId.length > 0 ||
//         errors.playerId.length > 0 ||
//         errors.methodName.length > 0 ||
//         errors.value.length > 0
//     ) {
//         Object.keys(errors).map( (key: string, index: number) : void => {
//             if (errors[key].length < 1) delete errors[key];
//         })
//         return {
//             valid: false,
//             errors
//         }
//     } else return { valid: true }
// }

// export const validateHealthPayload = async (data: any) => {
//     const errors = {
//         gameId: [],
//         playerId: [],
//         health: []
//     }

//     if (!data.gameId || data.gameId === '') errors.gameId.push('gameId is required.')
//     else {
//         try {
//             const foundGame = await Game.findOne({ gameId: data.gameId });

//             if (!foundGame) {
//                 errors.gameId.push('game not found with provided gameId')
//             }
//             if (foundGame && new Date(foundGame.expiredAt) < new Date()) {
//                 errors.gameId.push('gameId has been expired');
//             }

//             if (!data.playerId || data.playerId === '') errors.playerId.push("playerId is required.")
//             else if (foundGame && !foundGame.players.includes(data.playerId)) {
//                 errors.playerId.push("playerId has not joined with provided gameId.")
//             }
//         } catch(e) {
//             global.logger.error(e);
//             errors.gameId.push(e.message);
//         }
//     }

//     if (!data.health || data.health === '') errors.health.push('health is required')

//     if (
//         errors.gameId.length > 0 ||
//         errors.playerId.length > 0 ||
//         errors.health.length > 0
//     ) {
//         Object.keys(errors).map( (key: string, index: number) : void => {
//             if (errors[key].length < 1) delete errors[key];
//         })
//         return {
//             valid: false,
//             errors
//         }
//     } else return { valid: true }
// }

export const validateHealthPayloadV1 = (data: any) => {
  const errors = {
    gameId: [],
    playerId: [],
    health: [],
    dead: [],
    killedBy: [],
    clothId: [],
    randomizePosition: [],
    deadPosition: [],
  };

  if (!('gameId' in data) || data.gameId === '')
    errors.gameId.push(`'gameId' is required.`);
  if (!('playerId' in data) || data.playerId === '')
    errors.playerId.push(`'playerId' is required.`);
  if (!('health' in data) || data.health === '')
    errors.health.push(`'health' is required.`);
  if (!('dead' in data) || data.dead === '')
    errors.dead.push(`'dead' is required.`);
  if (!('killedBy' in data) || data.killedBy === '')
    errors.killedBy.push(`'killedBy' is required.`);
  if (!('clothId' in data) || data.clothId === '')
    errors.clothId.push(`'clothId' is required.`);
  if (!('randomizePosition' in data) || data.randomizePosition === '')
    errors.randomizePosition.push(`'randomizePosition' is required.`);
  if (!('deadPosition' in data) || data.deadPosition === '')
    errors.deadPosition.push(`'deadPosition' is required.`);

  if (
    errors.gameId.length > 0 ||
    errors.playerId.length > 0 ||
    errors.health.length > 0 ||
    errors.dead.length > 0 ||
    errors.killedBy.length > 0 ||
    errors.clothId.length > 0 ||
    errors.randomizePosition.length > 0 ||
    errors.deadPosition.length > 0
  ) {
    Object.keys(errors).forEach((error) => {
      if (errors[error].length < 1) delete errors[error];
    });
    return { valid: false, errors };
  } else {
    return { valid: true };
  }
};

// export const validateKilledPayload = async (data: any) => {
//     const errors = {
//         gameId: [],
//         dead: [],
//         killedBy: [],
//         deadPosition: [],
//         randomizePosition: [],
//         clothId: []
//     }

//     if (!data.gameId || data.gameId === '') errors.gameId.push('gameId is required.')
//     else {
//         try {
//             const foundGame = await Game.findOne({ gameId: data.gameId });

//             if (!foundGame) {
//                 errors.gameId.push('game not found with provided gameId')
//             }
//             if (foundGame && new Date(foundGame.expiredAt) < new Date()) {
//                 errors.gameId.push('gameId has been expired');
//             }

//             if (!data.dead || data.dead === '') errors.dead.push("dead is required.")
//             if (foundGame && !foundGame.players.includes(data.dead)) {
//                 errors.dead.push("dead has not joined with provided gameId.")
//             }

//             if (!data.killedBy || data.killedBy === '') errors.killedBy.push("killedBy is required.")
//             if (foundGame && !foundGame.players.includes(data.killedBy)) {
//                 errors.killedBy.push("killedBy has not joined with provided gameId.")
//             }
//         } catch(e) {
//             global.logger.error(e);
//             errors.gameId.push(e.message);
//         }
//     }

//     if (!data.deadPosition || data.deadPosition === '') errors.deadPosition.push('deadPosition is required')
//     if (!data.randomizePosition || data.randomizePosition === '') errors.randomizePosition.push("randomizePosition is required")
//     if (!data.clothId || data.clothId === '') errors.clothId.push("clothId is required")

//     if (
//         errors.gameId.length > 0 ||
//         errors.dead.length > 0 ||
//         errors.killedBy.length > 0 ||
//         errors.deadPosition.length > 0 ||
//         errors.randomizePosition.length > 0 ||
//         errors.clothId.length > 0
//     ) {
//         Object.keys(errors).map( (key: string, index: number) : void => {
//             if (errors[key].length < 1) delete errors[key];
//         })
//         return {
//             valid: false,
//             errors
//         }
//     } else return { valid: true }
// }

export const validateKilledPayload_V1 = (data: any) => {
  const errors = {
    gameId: [],
    dead: [],
    killedBy: [],
    deadPosition: [],
    randomizePosition: [],
    clothId: [],
  };

  if (!('gameId' in data) || data.gameId === '')
    errors.gameId.push(`'gameId' is required.`);
  if (!('dead' in data) || data.dead === '')
    errors.dead.push(`'dead' is required.`);
  if (!('killedBy' in data) || data.killedBy === '')
    errors.killedBy.push(`'killedBy' is required.`);
  if (!('deadPosition' in data) || data.deadPosition === '')
    errors.deadPosition.push(`'deadPosition' is required.`);
  if (!('randomizePosition' in data) || data.randomizePosition === '')
    errors.randomizePosition.push(`'randomizePosition' is required.`);
  if (!('clothId' in data) || data.clothId === '')
    errors.clothId.push(`'clothId' is required.`);

  if (
    errors.gameId.length > 0 ||
    errors.dead.length > 0 ||
    errors.killedBy.length > 0 ||
    errors.deadPosition.length > 0 ||
    errors.randomizePosition.length > 0 ||
    errors.clothId.length > 0
  ) {
    Object.keys(errors).map((key: string, index: number): void => {
      if (errors[key].length < 1) delete errors[key];
    });
    return {
      valid: false,
      errors,
    };
  } else return { valid: true };
};

// export const validateInGamePayload = async (data: any) => {
//     const errors = {
//         gameId: [],
//         playerId: []
//     }

//     if (!data.gameId || data.gameId === '') errors.gameId.push('gameId is required.')
//     else {
//         try {
//             const foundGame = await Game.findOne({ gameId: data.gameId });

//             if (!foundGame) {
//                 errors.gameId.push('game not found with provided gameId')
//             }
//             if (foundGame && new Date(foundGame.expiredAt) < new Date()) {
//                 errors.gameId.push('gameId has been expired');
//             }

//             if (!data.playerId || data.playerId == '') errors.playerId.push("playerId is required.")
//             else if (foundGame && !foundGame.players.includes(data.playerId)) {
//                 errors.playerId.push("playerId has not joined with provided gameId.")
//             }
//         } catch(e) {
//             global.logger.error(e);
//             errors.gameId.push(e.message);
//         }
//     }

//     if (
//         errors.gameId.length > 0 ||
//         errors.playerId.length > 0
//     ) {
//         Object.keys(errors).map( (key: string, index: number) : void => {
//             if (errors[key].length < 1) delete errors[key];
//         })
//         return {
//             valid: false,
//             errors
//         }
//     } else return { valid: true }
// }

export const validateInGamePayload_V1 = (data: any) => {
  const errors = {
    gameId: [],
    playerId: [],
  };

  if (!('gameId' in data) || data.gameId === '')
    errors.gameId.push('gameId is required.');
  if (!('playerId' in data) || data.playerId === '')
    errors.playerId.push('playerId is required.');

  if (errors.gameId.length > 0 || errors.playerId.length > 0) {
    Object.keys(errors).map((key: string, index: number): void => {
      if (errors[key].length < 1) delete errors[key];
    });
    return {
      valid: false,
      errors,
    };
  } else return { valid: true };
};

// export const validateGunPickupPayload = async (data: any) => {
//     const errors = {
//         gameId: [],
//         playerId: [],
//         gunId: [],
//         position: []
//     }

//     if (!data.gunId || data.gunId === '') errors.gunId.push('gunId is required.');
//     else if (!CONSTANTS.GAME.PLAYER_GUNS.includes(data.gunId)) errors.gunId.push('invalid gunId');

//     if (!data.position || data.position === '') errors.position.push('position is required.');

//     if (!data.gameId || data.gameId === '') errors.gameId.push('gameId is required.')
//     else {
//         try {
//             const foundGame = await Game.findOne({ gameId: data.gameId });

//             if (!foundGame) {
//                 errors.gameId.push('game not found with provided gameId')
//             }
//             if (foundGame && new Date(foundGame.expiredAt) < new Date()) {
//                 errors.gameId.push('gameId has been expired');
//             }

//             if (!data.playerId || data.playerId == '') errors.playerId.push("playerId is required.")
//             else if (foundGame && !foundGame.players.includes(data.playerId)) {
//                 errors.playerId.push("playerId has not joined with provided gameId.")
//             }
//         } catch(e) {
//             global.logger.error(e);
//             errors.gameId.push(e.message);
//         }
//     }

//     if (
//         errors.gunId.length > 0 ||
//         errors.gameId.length > 0 ||
//         errors.playerId.length > 0 ||
//         errors.position.length > 0
//     ) {
//         Object.keys(errors).map( (key: string, index: number) : void => {
//             if (errors[key].length < 1) delete errors[key];
//         })
//         return {
//             valid: false,
//             errors
//         }
//     } else return { valid: true }
// }

export const validateGunPickupPayload_V1 = async (data: any) => {
  const errors = {
    id: [],
    gameId: [],
    playerId: [],
    gunId: [],
    position: [],
  };

  if (!('id' in data) || data.gunId === '')
    errors.gunId.push('id is required.');
  if (!('gunId' in data) || data.gunId === '')
    errors.gunId.push('gunId is required.');
  else if (!CONSTANTS.GAME.PLAYER_GUNS.includes(data.gunId))
    errors.gunId.push('invalid gunId');

  if (!('position' in data) || data.position === '')
    errors.position.push('position is required.');

  if (!('gameId' in data) || data.gameId === '')
    errors.gameId.push('gameId is required.');
  if (!('playerId' in data) || data.playerId === '')
    errors.playerId.push('playerId is required.');

  if (
    errors.gunId.length > 0 ||
    errors.gameId.length > 0 ||
    errors.playerId.length > 0 ||
    errors.position.length > 0
  ) {
    Object.keys(errors).map((key: string, index: number): void => {
      if (errors[key].length < 1) delete errors[key];
    });
    return {
      valid: false,
      errors,
    };
  } else return { valid: true };
};

// export const validateGunDropPayload = async (data: any) => {
//     const errors = {
//         gameId: [],
//         playerId: [],
//         gunId: [],
//         position: []
//     }

//     if (!data.gunId || data.gunId === '') errors.gunId.push('gunId is required.');

//     if (!data.position || data.position === '') errors.position.push('position is required.');

//     if (!data.gameId || data.gameId === '') errors.gameId.push('gameId is required.')
//     else {
//         try {
//             const foundGame = await Game.findOne({ gameId: data.gameId });

//             if (!foundGame) {
//                 errors.gameId.push('game not found with provided gameId')
//             }
//             if (foundGame && new Date(foundGame.expiredAt) < new Date()) {
//                 errors.gameId.push('gameId has been expired');
//             }

//             if (!data.playerId || data.playerId == '') errors.playerId.push("playerId is required.")
//             else if (foundGame && !foundGame.players.includes(data.playerId)) {
//                 errors.playerId.push("playerId has not joined with provided gameId.")
//             }
//         } catch(e) {
//             global.logger.error(e);
//             errors.gameId.push(e.message);
//         }
//     }

//     if (
//         errors.gunId.length > 0 ||
//         errors.gameId.length > 0 ||
//         errors.playerId.length > 0 ||
//         errors.position.length > 0
//     ) {
//         Object.keys(errors).map( (key: string, index: number) : void => {
//             if (errors[key].length < 1) delete errors[key];
//         })
//         return {
//             valid: false,
//             errors
//         }
//     } else return { valid: true }
// }

export const validateGunDropPayload_V1 = (data: any) => {
  const errors = {
    gameId: [],
    playerId: [],
    gunId: [],
    position: [],
  };

  if (!('gunId' in data) || data.gunId === '')
    errors.gunId.push('gunId is required.');

  if (!('position' in data) || data.position === '')
    errors.position.push('position is required.');

  if (!('gameId' in data) || data.gameId === '')
    errors.gameId.push('gameId is required.');
  if (!('playerId' in data) || data.playerId === '')
    errors.playerId.push('playerId is required.');

  if (
    errors.gunId.length > 0 ||
    errors.gameId.length > 0 ||
    errors.playerId.length > 0 ||
    errors.position.length > 0
  ) {
    Object.keys(errors).map((key: string, index: number): void => {
      if (errors[key].length < 1) delete errors[key];
    });
    return {
      valid: false,
      errors,
    };
  } else return { valid: true };
};

// export const validateGrenadeThrowPayload = async (data: any) => {
//     const errors = {
//         gameId: [],
//         playerId: [],
//         throwDirection: []
//     }

//     if (!data.throwDirection || data.throwDirection === '') errors.throwDirection.push('throwDirection is required.');

//     if (!data.gameId || data.gameId === '') errors.gameId.push('gameId is required.')
//     else {
//         try {
//             const foundGame = await Game.findOne({ gameId: data.gameId });

//             if (!foundGame) {
//                 errors.gameId.push('game not found with provided gameId')
//             }
//             if (foundGame && new Date(foundGame.expiredAt) < new Date()) {
//                 errors.gameId.push('gameId has been expired');
//             }

//             if (!data.playerId || data.playerId == '') errors.playerId.push("playerId is required.")
//             else if (foundGame && !foundGame.players.includes(data.playerId)) {
//                 errors.playerId.push("playerId has not joined with provided gameId.")
//             }
//         } catch(e) {
//             global.logger.error(e);
//             errors.gameId.push(e.message);
//         }
//     }

//     if (
//         errors.throwDirection.length > 0 ||
//         errors.gameId.length > 0 ||
//         errors.playerId.length > 0
//     ) {
//         Object.keys(errors).map( (key: string, index: number) : void => {
//             if (errors[key].length < 1) delete errors[key];
//         })
//         return {
//             valid: false,
//             errors
//         }
//     } else return { valid: true }
// }

export const validateGrenadeThrowPayload_V1 = async (data: any) => {
  const errors = {
    gameId: [],
    playerId: [],
    throwDirection: [],
  };

  if (!('throwDirection' in data) || data.throwDirection === '')
    errors.throwDirection.push('throwDirection is required.');

  if (!('gameId' in data) || data.gameId === '')
    errors.gameId.push('gameId is required.');
  if (!('playerId' in data) || data.playerId === '')
    errors.playerId.push('playerId is required.');

  if (
    errors.throwDirection.length > 0 ||
    errors.gameId.length > 0 ||
    errors.playerId.length > 0
  ) {
    Object.keys(errors).map((key: string, index: number): void => {
      if (errors[key].length < 1) delete errors[key];
    });
    return {
      valid: false,
      errors,
    };
  } else return { valid: true };
};
