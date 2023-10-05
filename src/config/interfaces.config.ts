export type Acknowledgement = (data: any) => void;

export enum GameStatus {
  EmptyGame = 0, 
  RunningGame = 1,
  FullRunningGame = 2,
  RematchGame = 3
}

export enum RandomizeType {
  Position = 0,
  Cloth = 1,
}

export interface Gun {
  name: string;
  index: number;
  damageRate: number;
  ammoCount: number;
  fireRate: 2;
}

export interface User {
  id: string;
  deviceId: string;
  userName: string;
  purchasedGun: string[];
  purchasedCloths: string[];
}

export interface PlayerPosition {
  position: string;
  updatedAt: Date;
}

export interface Player {
  ip: string,
  port: number;
  id: string;
  userId: string;
  userName: string;
  socketId: string;
  gameId: string;
  isWaiting: boolean;
  isRejoin: boolean;
  deadCount: number;
  killCount: number;
  health: number;
  gunAmmoCount: number;
  gunMaxAmmoCount: number;
  magazine: number;
  gunFireRate: number;
  gunSFireRate: number;
  gunDamageRate: number;
  gunSDamageRate: number;
  isRematch: boolean;
  playerPosition: number;
  playerCloth: number;
  playerGun: number;
  playerGunId: string;
  playerSGun: number;
  playerSGunId: string;
  gunSAmmoCount: number;
  gunSMaxAmmoCount: number;
  sMagazine: number;
  match_slug: string;
  inFull: boolean;
  grenades: number;
  winAmount: number;
  createdAt: Date;
  updatedAt: Date;
  lastPosition: string;
  isKill: boolean;
  curGun: number;
  curAmmo: number;
  magCount: number;
  sMegCount: number;
  curSAmmo: number;
  recievedBoard: boolean;
}

export interface PlayerSortInfo {
  id: string;
  userName: string;
  playerCloth: number;
}

export interface UDPInfo {
  Port: number;
  IP: string;
}

export interface UDPLink {
  [userId:string]: UDPInfo;
}

export interface UDP {
  [gameId:string]: UDPLink;
}

export interface EmptyGame {
  id: string;
  gameId: string;
  players: string[]; // only (Player.userId)[]
  createdAt: Date;
  updatedAt: Date;
  expired: boolean;
  expiredAt: Date;
  rematchTime: number;
  tableStatus: number;
  droppedGuns: any[];
  uniqueThings: UniqueThings;
  spawned: string[];
  started: boolean;
  UDP: UDPLink;
  UDPPort: number;
}

export interface RunningGame extends EmptyGame {}
export interface FinishedGame extends RunningGame {}
export interface FullRunningGame extends RunningGame {}
export interface RematchGame extends RunningGame {}

export enum TableStatus {
  emptyGame = 0,
  runningGame = 1,
  fullRunningGame = 2,
  rematchGame = 3,
}

export interface UniqueThings {
  player_positions: number[];
  cloths: number[];
}
