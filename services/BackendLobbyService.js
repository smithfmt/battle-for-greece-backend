const { ref, set, child, get, remove } = require("firebase/database");
const { base } = require("../config/firebase-config");
const lobbiesRef = ref(base, "lobbies");

const getLobby = async (lobbyName) => {
  const lobbyRef = child(lobbiesRef, lobbyName);
  const lobbySnapshot = await get(lobbyRef);
  return [lobbySnapshot.val(), lobbyRef];
};

const create = async (lobby) => {
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

const join = async (lobbyName, uid, user) => {
  try {
    const [lobbyData, lobbyRef] = await getLobby(lobbyName);
    if (!lobbyData) {
      return [false, "This lobby does not exist"];
    } else {
      const playersData = lobbyData.players || [];
      if (playersData.filter(player => player.uid===uid).length) {
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

const close = async (lobbyName) => {
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

const leave = async (lobbyName, uid) => {
  try {
    const [lobbyData, lobbyRef] = await getLobby(lobbyName);
    if (!lobbyData) {
      return [false, "This lobby does not exist"];
    } else {
      let { players } = lobbyData;
      if (!players.filter(player => {return player.uid===uid}).length) {
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

module.exports = {
  create,
  join,
  close,
  leave,
};