const { ref, set, child, get, remove } = require("firebase/database");
const _ = require('lodash');
const { base } = require("../config/firebase-config");
const lobbiesRef = ref(base, "lobbies");
const gamesRef = ref(base, "games");
const { generals, basicCards } = require("../data");
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
  if (card.type==="basic") {
    for (let i=0; i<card.connect;i++) {
      switch (Math.floor(Math.random()*3)) {
        case 0:
          card.red++;
          break;
        case 1:
          card.blue++;
          break;
        case 2:
          card.green++;
          break;
      };
    };
  };
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
  let connections = shuffle(result)
  let background;
  let filteredColors = connections.filter(con => {return con!=="inactive"});
  let colArr = shuffle(filteredColors.sort().filter((item, pos, arr) => {return !pos || item != arr[pos-1]}));
  let sortedColors = colArr.sort((a,b) => {
    return (connections.filter(con => {return con===b}).length-connections.filter(con => {return con===a}).length);
  });
  if (filteredColors.length===2&&colArr.length===2) {
    let done = false;
    background = connections.map(con => {
      if (con === "inactive") {
        if (!done) {
          done = true;
          return sortedColors[0]
        } else {
          return sortedColors[1]
        };
      } else {
        return con;
      };      
    });
  } else {
    background = connections.map(con => {
      if (con==="inactive") {
        return sortedColors[0];
      } else {
        return con;
      };
    });
  };
  card.color = sortedColors[0];
  card.connections = connections;
  card.background = background;
  return card;
};

const canPlace = (cards) => {
  const occupied = cards.map(cardObj => {return cardObj.square});
  const connectedSquares = [];
  cards.forEach(cardObj => {
    const square = cardObj.square;
    const connections = cardObj.card.connections;
    connections.forEach((connect, index) => {
      if (connect!=="inactive") {
        let pushSquare = [...square];
        switch (index) {
          case 0:
            pushSquare[1]++;
            connectedSquares.push([...pushSquare]);
            break;
          case 1:
            pushSquare[0]++;
            connectedSquares.push([...pushSquare]);
            break;
          case 2:
            pushSquare[1]--;
            connectedSquares.push([...pushSquare]);
            break;
          case 3:
            pushSquare[0]--;
            connectedSquares.push([...pushSquare]);
            break;
          default:
            break;
        };
      };
    });
  }); 
  const res = connectedSquares.filter(square => {
    return !occupied.filter(occ => {
      occ.every(i => square.includes(i));
    }).length;
  });
  return res;
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
        case "placeCard": 
          updatedGameData.players[player].hand = updatedGameData.players[player].hand.filter(card => {
            return !_.isEqual(card, data.card);
          });
          updatedGameData.players[player].board.cards.push(data);
          updatedGameData.players[player].board.canPlace = canPlace(updatedGameData.players[player].board.cards);
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
      updatedGameData.players[uid].drawnBasic = false;
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

const drawBasic = async (gameName, uid) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    const { whoTurn } = gameData;
    if (!gameData) {
      return [false, "This game does not exist"];
    } else if (whoTurn!==uid) {
      return [false, "It is not your turn"];
    } else if (gameData.players[uid].drawnBasic) {
      return [false, "Already drawn basic this turn"];
    } else {
      const updatedGameData = {...gameData};
      const basic = cardConnect(shuffle([...basicCards])[0]);
      updatedGameData.players[uid].hand?
        updatedGameData.players[uid].hand.push(basic)
        :   
        updatedGameData.players[uid].hand = [basic];
      updatedGameData.players[uid].drawnBasic = true;
      updatedGameData.players[uid].board.canPlace = canPlace(updatedGameData.players[uid].board.cards);
      await set(gameRef, updatedGameData);
      return [basic, false];
    };
  } catch (e) {
    console.log(e)
    return [false, "Error sending to database"];
  };
}

module.exports = {
  create,
  leave,
  close,
  updatePlayer,
  nextTurn,
  runBotTurn,
  drawBasic,
};