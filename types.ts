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
};

export type SquareType = [number,number];

export type PlayerType = {
  uid: string,
};

export type LobbyType = {
  lobbyName: string,

};

export interface UserType extends DocumentData {
  username?: string,
  wins?: number,
  games?: number,
  open?: {
    lobby: string|undefined,
    game: string|undefined,
  },
};

export type GameType = {

};
