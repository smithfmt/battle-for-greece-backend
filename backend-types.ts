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
};

export type SquareType = [number,number];

export type PlayerType = {
  uid: string,
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
  games?: number,
  open?: {
    lobby: string|false,
    game: string|false,
  },
};

export type GameType = {
  players: {
    uid: string,
    username: string,
  }[],
  gamename: string,
  whoTurn: string,
  turnOrder: string[],
  shopOrder: CardType[],
  shopBought: boolean,
  cycleShop: number,
  whoFirst: string,
};
