const { ref, set, child, get, remove } = require("firebase/database");
const { base } = require("../config/firebase-config");
const lobbiesRef = ref(base, "lobbies");
const gamesRef = ref(base, "games");
const { generals } = require("../data");
const { shuffle } = require("../helpers");

const getLobby = async (lobbyName) => {
  const lobbyRef = child(lobbiesRef, lobbyName);
  const lobbySnapshot = await get(lobbyRef);
  return [lobbySnapshot.val(), lobbyRef];
};

const getGame = async (gameName) => {
  const gameRef = child(gamesRef, gameName);
  const gameSnapshot = await get(gameRef);
  return [gameSnapshot.val(), gameRef];
};

const cardConnect = (card) => {
  let cols = [card.red, card.blue, card.green];
  let result = [];
  let colours = ["red", "blue", "green"];
  cols.forEach((col, index) => {
    for (let i=0; i<col; i++) {
      result.push(colours[index]);
    };
  });
  while (result.length<4) {
    result.push("inactive");
  };
  if (card.type==="god") {result = ["gold", "gold", "gold", "gold"]}
  else if (card.type==="monster") {result = ["white", "white", "white", "white"]};
  card.connections = shuffle(result);
  return card;
};

const create = async (lobbyName, botNumber, uid) => {
  try {
    const [lobbyData, lobbyRef] = await getLobby(lobbyName);
    const [gameData, gameRef] = await getGame(lobbyName);
    if (gameData) {
        return [false, "Game name already taken!"];
    }else if (lobbyData.host !== uid) {
        return [false, "This is not the host"];
    } else {
      // Generate Game Object //
        const players = {};
        lobbyData.players.forEach(player => players[player.uid] = player);
        for (let i = 0; i < botNumber; i++) {
            players[`bot${i}`] = { uid: `bot${i}`, bot: true };
        };
        let generalArr = [...generals];
        generalArr.map(general => {return cardConnect(general)});
        for (let i = 0; i <3; i++) {
          Object.keys(players).map(player => {
            const generalNum = Math.floor(generalArr.length*Math.random());
            if (players[player].generalChoice) {
              players[player].generalChoice.push(generalArr[generalNum]);
            } else {
              players[player].generalChoice = [generalArr[generalNum]];
            };
            generalArr.splice(generalNum,1);
          });
        };
        Object.keys(players).map(player => {
          if (players[player].bot) {
            players[player].board = {cards: [{card:players[player].generalChoice[Math.floor(3*Math.random())], square: [0,0]}]};
            players[player].generalChoice = null;
          };
        });
        const turnOrder = shuffle(Object.keys(players));
        let val = 0;
        let whoTurn = turnOrder[val];
        while (players[whoTurn].bot) {
          val++;
          whoTurn = turnOrder[val];
        };

        const game = {
            gameName: lobbyName,
            host: uid,
            players,
            whoTurn,
            turnOrder,
        };
      // -------------------- //
        await set(lobbyRef, { ...lobbyData, starting: true });
        await set(gameRef, game);
        return [game.gameName, false];
    };
  } catch (e) {
    console.log(e);
    return [false, "Error sending to database"];
  };
};

const leave = async (gameName, uid) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    const updatedGameData = {...gameData};
    const { players } = updatedGameData;
    if (!updatedGameData) {
      return [false, "This game does not exist"];
    } else if (!players[uid]) {
      return [false, "This player is not in this game"];
    } else {
      players[`BOT${uid}`] = {...players[uid]};
      delete players[uid];
      players[`BOT${uid}`].uid = "bot";
      players[`BOT${uid}`].bot = "true";
      await set(gameRef, updatedGameData);
      return [Object.keys(players).filter(player => {return !players[player].bot}), false];
    };
  } catch (e) {
    console.log(e)
    return [false, "Error sending to database"];
  };
};

const close = async (gameName) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    if (!gameData) {
      return [false, "This game does not exist"];
    } else {
      remove(gameRef);
      return [gameName, false];
    };
  } catch {
    return [false, "Error sending to database"];
  };
};

const updatePlayer = async (gameName, player, updating, data) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);

    if (!gameData) {
      return [false, "This game does not exist"];
    } else {
      const updatedGameData = {...gameData};
      switch (updating) {
        case "general":
          updatedGameData.players[player].board = {cards: [data]};
          updatedGameData.players[player].generalChoice = null;
          break;
        case "addCard": 
          updatedGameData.players[player].board.cards.push(data);
          break;
        default:
          break;
      };
      await set(gameRef, updatedGameData);
      return [updatedGameData.gamename, false];
    };
  } catch (e) {
    console.log(e)
    return [false, "Error sending to database"];
  };
};

const nextTurn = async (gameName, uid) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    const { whoTurn } = gameData;
    if (!gameData) {
      return [false, "This game does not exist"];
    } else if (whoTurn!==uid) {
      return [false, "It is not your turn"];
    } else {
      const updatedGameData = {...gameData};
      const nextIndex = updatedGameData.turnOrder.indexOf(whoTurn)+1;
      let whoNext = updatedGameData.turnOrder[0];
      if (nextIndex!==updatedGameData.turnOrder.length) {
        whoNext = updatedGameData.turnOrder[nextIndex];
      };
      updatedGameData.whoTurn = whoNext;
      await set(gameRef, updatedGameData);
      let bot = updatedGameData.players[whoNext].bot;
      return [{whoNext, bot}, false];
    };
  } catch (e) {
    console.log(e)
    return [false, "Error sending to database"];
  };
};

const runBotTurn = async (gameName, botUid) => {
  console.log("doing Bot Turn!", botUid)
  return [botUid, false];
};

module.exports = {
  create,
  leave,
  close,
  updatePlayer,
  nextTurn,
  runBotTurn,
};