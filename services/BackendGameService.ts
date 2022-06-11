import { set, remove } from "firebase/database";
import _ from 'lodash';
import { CardType, PlayerType, SquareType, LobbyType, GameType } from "../types";
import { base } from "../config/firebase-config";
const lobbiesRef = base.ref("lobbies");
const gamesRef = base.ref("games");
import { generals, basicCards } from "../data";
import { shuffle } from "../helpers";

const getLobby = async (lobbyName:string) => {
  const lobbyRef = lobbiesRef.child(lobbyName)
  const lobbySnapshot = await lobbyRef.get();
  const lobbyData:LobbyType|null = lobbySnapshot.val();
  return { lobbyData, lobbyRef };
};

const getGame = async (gameName:string) => {
  const gameRef = gamesRef.child(gameName);
  const gameSnapshot = await gameRef.get();
  const gameData:GameType|null = gameSnapshot.val();
  return { gameData, gameRef };
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
  const cols = [card.red, card.blue, card.green];
  let result:string[] = [];
  const colours = ["red", "blue", "green"];
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
  const connections = shuffle(result)
  let background;
  const filteredColors = connections.filter(con => {return con!=="inactive"});
  const colArr = shuffle(filteredColors.sort().filter((item, pos, arr) => {return !pos || item !== arr[pos-1]}));
  const sortedColors = colArr.sort((a,b) => {
    return (connections.filter(con => {return con===b}).length-connections.filter(con => {return con===a}).length);
  });
  if (filteredColors.length===2&&colArr.length===2) {
    let done = false;
    background = connections.map(con => {
      if (con === "inactive") {
        if (!done) {
          done = true;
          return sortedColors[0]
        };
        return sortedColors[1]
      };
      return con;
    });
  } else {
    background = connections.map(con => {
      if (con==="inactive") {
        return sortedColors[0];
      };
      return con;
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
        const pushSquare:SquareType = [...square];
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
    const { lobbyData, lobbyRef } = await getLobby(lobbyName);
    const { gameData, gameRef } = await getGame(lobbyName);
    if (gameData) {
      return {error: "Game name already taken!"};
    };
    if (lobbyData.host !== uid) {
      return {error: "This is not the host"};
    };
  // Generate Game Object //
    const players:any = {};
    lobbyData.players.forEach((player:PlayerType) => players[player.uid] = player);
    for (let i = 0; i < botNumber; i++) {
        players[`bot${i}`] = { uid: `bot${i}`, bot: true };
    };
    const generalArr = [...generals];
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
    await lobbyRef.set({ ...lobbyData, starting: true });
    await gameRef.set(game);
    return {response: game.gameName};
  } catch (e) {
    console.log(e);
    return {error: "Error sending to database"};
  };
};

export const leave = async (gameName:string, uid:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    const updatedGameData = {...gameData};
    const { players } = updatedGameData;
    if (!updatedGameData) {
      return {error: "This game does not exist"};
    };
    if (!players[uid]) {
      return {error: "This player is not in this game"};
    };
    players[`BOT${uid}`] = {...players[uid]};
    delete players[uid];
    players[`BOT${uid}`].uid = "bot";
    players[`BOT${uid}`].bot = "true";
    await gameRef.set(updatedGameData);
    return {response: Object.keys(players).filter(player => {return !players[player].bot})};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export const close = async (gameName:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    gameRef.remove();
    return {response: gameName};
  } catch {
    return {error: "Error sending to database"};
  };
};

export const updatePlayer = async (gameName:string, player:string, updating:string, data:any) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return { error: "This game does not exist"};
    }
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
    await gameRef.set(updatedGameData);
    return {response: updatedGameData.gamename};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export const nextTurn = async (gameName:string, uid:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    const { whoTurn } = gameData;
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    if (whoTurn!==uid) {
      return {error: "It is not your turn"};
    };
    const updatedGameData = {...gameData};
    updatedGameData.players[uid].drawnBasic = false;
    const nextIndex = updatedGameData.turnOrder.indexOf(whoTurn)+1;
    let whoNext:string = updatedGameData.turnOrder[0];
    if (nextIndex!==updatedGameData.turnOrder.length) {
      whoNext = updatedGameData.turnOrder[nextIndex];
    };
    updatedGameData.whoTurn = whoNext;
    await gameRef.set(updatedGameData);
    const bot:boolean = updatedGameData.players[whoNext].bot;
    return {response: {whoNext, bot}};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export const runBotTurn = async (gameName:string, botUid:string) => {
  console.log("doing Bot Turn!", botUid)
  let insertErrorHere = false;
  if (insertErrorHere) {
    return {error: "INSERT ERROR MESSAGE HERE"};
  };
  return {response: botUid};
};

export const drawBasic = async (gameName:string, uid:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    const { whoTurn } = gameData;
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    if (whoTurn!==uid) {
      return {error: "It is not your turn"};
    };
    if (gameData.players[uid].drawnBasic) {
      return {error: "Already drawn basic this turn"};
    };
    const updatedGameData = {...gameData};
    const basic = cardConnect(shuffle([...basicCards])[0]);
    updatedGameData.players[uid].hand?
      updatedGameData.players[uid].hand.push(basic)
      :
      updatedGameData.players[uid].hand = [basic];
    updatedGameData.players[uid].drawnBasic = true;
    updatedGameData.players[uid].board.canPlace = canPlace(updatedGameData.players[uid].board.cards);
    await gameRef.set(updatedGameData);
    return {response: basic};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export default {
  create,
  leave,
  close,
  updatePlayer,
  nextTurn,
  runBotTurn,
  drawBasic,
};