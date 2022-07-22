import { Request } from "express"
import { DocumentData } from "@google-cloud/firestore";
export interface AuthRequest extends Request {
  userInfo?: any,
};

export type CardType = {
  type: string,
  blue: number,
  red: number,
  green: number,
  connect: number,
  connections?: string[],
  background?: string[],
  color?: string,
  square?:SquareType,
  cost?: number,
  costArr?: string[],
  activeConnections?: string[],
  name: string,
  id?: number,
  ability: string,
  atk: number,
  hp: number,
  style: string,
  cast?: boolean,
  team?: string,
};

export type SquareType = [number,number];

export type PlayerType = {
  uid: string,
  username: string,
  board: {
    cards: {
      card: CardType, 
      square: SquareType,
    }[],
    canPlace: SquareType[]
  },
  hand?: CardType[],
  wins?: number,
  bot?:boolean,
};

export type LobbyType = {
  lobbyName: string,
  playerCount: number,
  players: {
    uid: string,
    username: string,
  }[],
  host: string,
};

export interface UserType extends DocumentData {
  username?: string,
  wins?: number,
  games?: any,
  open?: {
    lobby: string|false,
    game: string|false,
  },
};

export type GameType = {
  players: PlayerType[],
  gameName: string,
  whoTurn: string,
  turnOrder: string[],
  shopOrder: CardType[],
  shopBought: boolean,
  cycleShop: number,
  whoFirst: string,
  battle: {
    started:boolean,
    battles: BattleType[],
  },
  cardsSinceBattle: number,
  battleFrequency: number,
  battleList: CardType[],
  winsToWin: number,
  host: string,
  ended?: boolean,
  turnNumber:number,
};

export type BattleType = {
  players: PlayerType[],
  whoTurn: string,
  ended?: boolean,
};
