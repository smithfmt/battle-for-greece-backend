import { set, remove } from "firebase/database";
import { LobbyType, PlayerType, UserType } from "../types";
import { base } from "../config/firebase-config";
const lobbiesRef = base.ref("lobbies");

const getLobby = async (lobbyName:string) => {
  const lobbyRef = lobbiesRef.child(lobbyName);
  const lobbySnapshot = await lobbyRef.get();
  return [lobbySnapshot.val(), lobbyRef];
};

export const create = async (lobby:LobbyType) => {
  try {
    const [lobbyData, lobbyRef] = await getLobby(lobby.lobbyName);
    if (lobbyData) {
      return [false, "Lobby name already taken!"];
    } else {
      await set(lobbyRef, lobby);
      return [lobby.lobbyName, false];
    };
  } catch {
    return [false, "Error sending to database"];
  };
};

export const join = async (lobbyName:string, uid:string, user:UserType) => {
  try {
    const [lobbyData, lobbyRef] = await getLobby(lobbyName);
    if (!lobbyData) {
      return [false, "This lobby does not exist"];
    } else {
      const playersData = lobbyData.players || [];
      if (playersData.filter((player:PlayerType) => player.uid===uid).length) {
        return [false, "This player is already in this lobby"];
      } else if (!(playersData.length<lobbyData.playerCount)) {
        return [false, "Sorry! This lobby is full"];
      } else {
        const players = [...playersData, {uid, username: user.username}];
        const lobby = {...lobbyData, players }
        await set(lobbyRef, lobby);
        return [lobby.lobbyName, false];
      };
    };
  } catch {
    return [false, "Error sending to database"];
  };
};

export const close = async (lobbyName:string) => {
  try {
    const [lobbyData, lobbyRef] = await getLobby(lobbyName);
    if (!lobbyData) {
      return [false, "This lobby does not exist"];
    } else {
      remove(lobbyRef);
      return [lobbyName, false];
    };
  } catch {
    return [false, "Error sending to database"];
  };
};

export const leave = async (lobbyName:string, uid:string) => {
  try {
    const [lobbyData, lobbyRef] = await getLobby(lobbyName);
    if (!lobbyData) {
      return [false, "This lobby does not exist"];
    } else {
      let { players } = lobbyData;
      if (!players.filter((player:PlayerType) => {return player.uid===uid}).length) {
        return [false, "This player is not in this lobby"];
      } else {
        players.splice(players.indexOf(uid),1);
        await set(lobbyRef, lobbyData);
        return [lobbyData.players, false];
      };
    };
  } catch {
    return [false, "Error sending to database"];
  };
};

export default {
  create,
  join,
  close,
  leave,
};