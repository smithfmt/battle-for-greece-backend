import { LobbyType, PlayerType, UserType } from "../backend-types";
import { base } from "../config/firebase-config";
const lobbiesRef = base.ref("lobbies");

const getLobby = async (lobbyName:string) => {
  const lobbyRef = lobbiesRef.child(lobbyName);
  const lobbySnapshot = await lobbyRef.get();
  const lobbyData:LobbyType|null = lobbySnapshot.val();
  return {lobbyData, lobbyRef};
};

export const create = async (lobby:LobbyType) => {
  try {
    const { lobbyData, lobbyRef } = await getLobby(lobby.lobbyName);
    if (lobbyData!==null) {
      return {error: "Lobby name already taken!"};
    };
    await lobbyRef.set(lobby);
    return {response: lobby.lobbyName};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export const join = async (lobbyName:string, uid:string, user:UserType) => {
  try {
    const { lobbyData, lobbyRef } = await getLobby(lobbyName);
    if (!lobbyData) {
      return {error: "This lobby does not exist"};
    } else {
      const playersData = lobbyData.players || [];
      if (playersData.filter((player:PlayerType) => player.uid===uid).length) {
        return {error: "This player is already in this lobby"};
      } else if (!(playersData.length<lobbyData.playerCount)) {
        return {error: "Sorry! This lobby is full"};
      } else {
        const players = [...playersData, {uid, username: user.username}];
        const lobby = {...lobbyData, players }
        await lobbyRef.set(lobby);
        return {response: lobby.lobbyName};
      };
    };
  } catch {
    return {response:false, error: "Error sending to database"};
  };
};

export const close = async (lobbyName:string) => {
  try {
    const { lobbyData, lobbyRef } = await getLobby(lobbyName);
    if (!lobbyData) {
      return {reponse: false, error: "This lobby does not exist"};
    } else {
      lobbyRef.remove();
      return {response: lobbyName};
    };
  } catch {
    return {error: "Error sending to database"};
  };
};

export const leave = async (lobbyName:string, uid:string) => {
  try {
    const { lobbyData, lobbyRef } = await getLobby(lobbyName);
    let updatedLobbyData = {...lobbyData};
    if (!updatedLobbyData) {
      return {error: "This lobby does not exist"};
    } else {
      const { players } = updatedLobbyData;
      if (!players.filter((player:PlayerType) => {return player.uid===uid}).length) {
        return {error: "This player is not in this lobby"};
      } else {
        players.splice(players.indexOf(players.filter(player => {return player.uid===uid})[0]),1);
        if (!players.length) {
          updatedLobbyData = null;
        };
        await lobbyRef.set(updatedLobbyData)
        return {response: `successfully left ${lobbyName}`};
      };
    };
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export default {
  create,
  join,
  close,
  leave,
};