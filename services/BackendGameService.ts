import { set, remove } from "firebase/database";
import _ from 'lodash';
import { CardType, PlayerType, SquareType } from "../types";
import { base } from "../config/firebase-config";
const lobbiesRef = base.ref("lobbies");
const gamesRef = base.ref("games");
import { generals, basicCards } from "../data";
import { shuffle } from "../helpers";

const getLobby = async (lobbyName:string) => {
  const lobbyRef = lobbiesRef.child(lobbyName)
  const lobbySnapshot = await lobbyRef.get();
  return [lobbySnapshot.val(), lobbyRef];
};

const getGame = async (gameName:string) => {
  const gameRef = gamesRef.child(gameName);
  const gameSnapshot = await gameRef.get();
  return [gameSnapshot.val(), gameRef];
};

const cardConnect = (card:CardType) => {
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

const canPlace = (cards:{card:CardType,square:SquareType}[]) => {
  const occupied = cards.map(cardObj => {return cardObj.square});
  const connectedSquares:SquareType[] = [];
  cards.forEach(cardObj => {
    const square = cardObj.square;
    const connections = cardObj.card.connections;
    connections.forEach((connect, index) => {
      if (connect!=="inactive") {
        let pushSquare:SquareType = [...square];
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

export const create = async (lobbyName:string, botNumber:number, uid:string) => {
  try {
    const [lobbyData, lobbyRef] = await getLobby(lobbyName);
    const [gameData, gameRef] = await getGame(lobbyName);
    if (gameData) {
        return [undefined, "Game name already taken!"];
    }else if (lobbyData.host !== uid) {
        return [undefined, "This is not the host"];
    } else {
      // Generate Game Object //
        const players:any = {};
        lobbyData.players.forEach((player:PlayerType) => players[player.uid] = player);
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
    return [undefined, "Error sending to database"];
  };
};

export const leave = async (gameName:string, uid:string) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    const updatedGameData = {...gameData};
    const { players } = updatedGameData;
    if (!updatedGameData) {
      return [undefined, "This game does not exist"];
    } else if (!players[uid]) {
      return [undefined, "This player is not in this game"];
    } else {
      players[`BOT${uid}`] = {...players[uid]};
      delete players[uid];
      players[`BOT${uid}`].uid = "bot";
      players[`BOT${uid}`].bot = "true";
      await set(gameRef, updatedGameData);
      return [Object.keys(players).filter(player => {return !players[player].bot}), undefined];
    };
  } catch (e) {
    console.log(e)
    return [undefined, "Error sending to database"];
  };
};

export const close = async (gameName:string) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    if (!gameData) {
      return [undefined, "This game does not exist"];
    } else {
      remove(gameRef);
      return [gameName, false];
    };
  } catch {
    return [undefined, "Error sending to database"];
  };
};

export const updatePlayer = async (gameName:string, player:string, updating:string, data:any) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    if (!gameData) {
      return [undefined, "This game does not exist"];
    } else {
      const updatedGameData = {...gameData};
      switch (updating) {
        case "general":
          updatedGameData.players[player].board = {cards: [data]};
          updatedGameData.players[player].generalChoice = null;
          break;
        case "placeCard": 
          updatedGameData.players[player].hand = updatedGameData.players[player].hand.filter((card:CardType) => {
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
    return [undefined, "Error sending to database"];
  };
};

export const nextTurn = async (gameName:string, uid:string) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    const { whoTurn } = gameData;
    if (!gameData) {
      return [null, "This game does not exist"];
    };
    if (whoTurn!==uid) {
      return [null, "It is not your turn"];
    };
    const updatedGameData = {...gameData};
    updatedGameData.players[uid].drawnBasic = false;
    const nextIndex = updatedGameData.turnOrder.indexOf(whoTurn)+1;
    let whoNext:string = updatedGameData.turnOrder[0];
    if (nextIndex!==updatedGameData.turnOrder.length) {
      whoNext = updatedGameData.turnOrder[nextIndex];
    };
    updatedGameData.whoTurn = whoNext;
    await set(gameRef, updatedGameData);
    let bot:boolean = updatedGameData.players[whoNext].bot;
    return [{whoNext, bot}, null];
  } catch (e) {
    console.log(e)
    return [null, "Error sending to database"];
  };
};

export const runBotTurn = async (gameName:string, botUid:string) => {
  console.log("doing Bot Turn!", botUid)
  return [botUid, false];
};

export const drawBasic = async (gameName:string, uid:string) => {
  try {
    const [gameData, gameRef] = await getGame(gameName);
    const { whoTurn } = gameData;
    if (!gameData) {
      return [undefined, "This game does not exist"];
    } else if (whoTurn!==uid) {
      return [undefined, "It is not your turn"];
    } else if (gameData.players[uid].drawnBasic) {
      return [undefined, "Already drawn basic this turn"];
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
    return [undefined, "Error sending to database"];
  };
}

export default {
  create,
  leave,
  close,
  updatePlayer,
  nextTurn,
  runBotTurn,
  drawBasic,
};