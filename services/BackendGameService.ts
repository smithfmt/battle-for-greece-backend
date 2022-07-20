import _ from 'lodash';
import { CardType, PlayerType, SquareType, LobbyType, GameType, BattleType } from "../backend-types";
import { base } from "../config/firebase-config";
const lobbiesRef = base.ref("lobbies");
const gamesRef = base.ref("games");
import { generals, basicCards, heroCards, battleCards } from "../data";
import { shuffle, removeDuplicates, loop, addArr, invertConnection, generateMatrixes, range } from "../backend-helpers";
import { findAdjacentCard, mapConnection } from "../board-nav";
import UserController from '../controllers/userController';

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
// Assign connections to a card Object
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
  let background:string[];
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
// Calculate where a player can place cards
const calcCanPlace = (cards:{card:CardType,square:SquareType}[]) => {
  const occupied = cards.map(cardObj => {return cardObj.square});
  let connectedSquares:SquareType[] = [];
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
  connectedSquares = removeDuplicates(connectedSquares);
// Filter out occupied squares
  const res = _.uniq(connectedSquares).filter(square => {
    return !occupied.filter(occ => {
      return _.isEqual(occ, square);
    }).length;
  });
  return res;
};
// Calculate card costs
const calcCost = (cost:number, red:number, green:number, blue:number, type:string) => {
  let result:string[] = [];
  switch (type) {
    case "god":
      loop(cost, () => {result.push("gold")});
      return result;
    case "monster":
      loop(cost, () => {result.push("white")});
      return result;
    default:
      break;
  };
  let connections:string[] = [];
  loop(red, () => {connections.push("red")});
  loop(green, () => {connections.push("green")});
  loop(blue, () => {connections.push("blue")});
  result = shuffle(connections).splice(0,cost);
  return result;
};
// Activate Connections 
const blankConnects = ["inactive", "inactive", "inactive", "inactive"];
const activeConnects = (cards:{card:CardType,square:SquareType}[]) => {
  let connectedCards = [...cards].filter(cdObj => {return cdObj});
  connectedCards.forEach(cardObj => {
    const { card, square } = cardObj;
    card.activeConnections = [...blankConnects];
    card.connections.forEach((connection:string, i) => {
      if (connection==="inactive") return;
      let dirMatrix = [-1,0];
      switch (i) {
        case 0:
          dirMatrix = [0,1];break;
        case 1:
          dirMatrix = [1,0];break;
        case 2:
          dirMatrix = [0,-1];break;
        default: break;
      };
      const connectedSquare = addArr(square, dirMatrix);
      const connectedCard = connectedCards.filter(cd => {return _.isEqual(cd.square,connectedSquare)})[0];
      if (!connectedCard) {card.activeConnections[i] = "inactive";return;};
      switch (connection) {
        case "gold":
          if (connectedCard.card.connections[invertConnection(i)]!=="white") {
            card.activeConnections[i] = connection;
          };
          break;
        case "white":
          break;
        default:
          if (connectedCard.card.connections[invertConnection(i)]===connection||connectedCard.card.connections[invertConnection(i)]==="gold") {
            card.activeConnections[i] = connection;
          };
          break;
      };
    });
  });
  return connectedCards;
};
// Calculate best positions 
const calcPositions = (cards:CardType[], general:{card:CardType,square:SquareType}) => {
  let scores:{board:{card:CardType,square:SquareType}[], hand:CardType[], score:number}[] = [];
  cards.forEach(() => {
    let placedCards = [{...general}];
    let handCards:CardType[] = [];
    let sortedCardArr:CardType[] = shuffle(cards);
    sortedCardArr = [
      ...sortedCardArr.filter((card) => {return card.type!=="basic"}).sort((a,b) => {return b.cost-a.cost}),
      ...sortedCardArr.filter((card) => {return card.ability!=="Equipment"&&card.type==="basic"}),
      ...sortedCardArr.filter((card) => {return card.ability==="Equipment"}),
    ];
    let testCardArr = [];
    sortedCardArr.forEach((card, i)=> {
      if (i<9) return testCardArr.push(card);
      return handCards.push(card);
    });
    const tryAgainCards:CardType[] = [];
    // simulate placing of all cards
    const simulateCards = (cardArr:CardType[], tryAgain?:boolean) => {
      cardArr.forEach(testCard => {
        const canPlace = calcCanPlace(placedCards);
        // find placeable squares for selected card
        const placeable = canPlace.filter(square => {
          let successes = 0;
          const failed = testCard.connections.filter((connection, index) => {
            const inactive = connection === "inactive"?1:-1;
            const adjacentCard = findAdjacentCard(placedCards, square, index);
            if (adjacentCard) {
                const match = adjacentCard.card.connections[mapConnection(index)]==="inactive"?-1:1;
                if (inactive===-1&&match===1) {successes++}
                return inactive+match;  
            };
            return false;
          });
          if (!failed.length&&successes) {
              return true;
          };
          return false;
        });
        if (!placeable.length) {       
          if (tryAgain) return handCards.push(testCard);
          return tryAgainCards.push(testCard);
        };
        let placeableScore:{square:SquareType,score:number}[] = [];
        placeable.forEach(square => {
          // simulated placed cards
          let newCards = [...placedCards, {card:{...testCard} as CardType,square:[...square] as SquareType}];
          newCards = activeConnects(newCards);
          // examine the simulated placed card
          const newPlacedCard = newCards.filter(cdObj => {return _.isEqual(cdObj.square,square)})[0].card;
          // increase score for every active connection
          let score = newPlacedCard.activeConnections.reduce((prev,cur) => {
            if (cur==="inactive") return prev;
            return prev+1;
          },0);
          // increase score for percentage of active connections
          score = score + score/newPlacedCard.connect;
          placeableScore.push({square, score});
        });
        const bestPlace = placeableScore.sort((a,b) => {return b.score-a.score})[0];
        if (testCard.ability==="Equipment"&&bestPlace.score===0) {
          if (tryAgain) return handCards.push(testCard);
          return tryAgainCards.push(testCard);
        };
        return placedCards.push({card:testCard,square:bestPlace.square});
      });
    };
    simulateCards(testCardArr);
    simulateCards(tryAgainCards, true);
    placedCards = activeConnects(placedCards);
    let score = placedCards.reduce((prev,cur) => {
      // sum all active connections
      return (prev+cur.card.activeConnections.reduce((pr,cr) => {if (cr==="inactive") return pr;return pr+1},0));
    },0);
    scores.push({board:placedCards, hand:handCards, score});
  });
  const bestPosition = scores.sort((a,b) => {return b.score-a.score})[0];
  return bestPosition;
};
// Calculate if you can buy
const calcPaid = (payment:CardType[], buyCard:CardType) => {
  if (!buyCard) return false;
  let { costArr } = buyCard;
  if (!costArr) return false;
  const paid = payment.map(cd => {
      let res:string[] = [];
      if (cd.red) res.push("red");
      if (cd.green) res.push("green");
      if (cd.blue) res.push("blue");
      return res;
  });
  const compare = (req:string[], pay:string[][]) => {
      if (req.includes("gold")||req.includes("white")) {
        if (req.length===pay.length) return true;
        return false;
      };
      let requirements = [...req];
      const singles = pay.filter(arr => {return arr.length===1}).map(arr => {return arr[0]});
      singles.forEach(sing => {
          if (requirements.includes(sing)) {
              requirements.splice(requirements.indexOf(sing),1);
          } else return false;
      });
      if (singles.length&&!requirements.length) return true;
      const complex = pay.filter(arr => {return arr.length>1});
      const testMatrixes = generateMatrixes([0,1,2],complex.length, true);
      let success = false;
      let end = false;
      let iterations = 0;
      while (!success&&!end&&iterations<testMatrixes.length) {
          const matrix = testMatrixes[iterations];
          if (matrix===undefined) end=true;
          const compareMatrix = complex.map((arr, i) => {return(arr[matrix[i]])});
          if (matrix && _.isEqual(requirements, compareMatrix)) success = true;
          iterations++;
      };
      return success;
  };
  return compare(costArr, paid);
};
// Shop purchase tester
const tryToBuy = (buyCard:CardType, hand:CardType[]) => {
  let success = false;
  let payment:CardType[] = [];
  const { costArr } = buyCard;
  let filteredHand = hand.filter(card => {
    if (card.type!=="basic") return false;
    let colorMatch:string[] = [];
    costArr.forEach(col => {
      if (card[col]) colorMatch.push(col);
      if (col==="white"||col==="gold") colorMatch.push(col);
    });
    if (!colorMatch.length) return false;
    return true;
  });
  const testMatrixes = generateMatrixes(range(0,filteredHand.length-1),buyCard.cost, true);
  const testResults:{paid:CardType[], score:number}[] = [];
  testMatrixes.forEach((matrix:number[]) => {
    let score = 0;
    let paid:CardType[] = [];
    matrix.forEach((index:number) => {
      paid.push(filteredHand[index]);
    });
    const result = calcPaid(paid,buyCard);
    if (result) {
      score++;
      paid.forEach(paidCard => {
        if (paidCard.ability==="Equipment") score++;
      });
    };
    return testResults.push({paid,score})
  });
  const bestResults = testResults.sort((a,b) => {return b.score-a.score});
  if (bestResults.length&&bestResults[0].score) success = true;
  if (bestResults.length) payment = bestResults[0].paid;
  return {canBuy: success, payment};
};
// Check for bad placement
const checkPlacement = (cards:{card:CardType,square:SquareType}[]) => {
  if (cards.length===1) return true;
  // Map over cards and return an array of connected card Objects
  let connectedIds = cards.map(cardObj => {
    const connections = [...cardObj.card.connections];
    // Create an array of potentially connected squares
    const newSquares = connections.map((con,i) => {
      let dirMatrix = [-1,0];
      switch (i) {
        case 0:
          dirMatrix = [0,1];break;
        case 1:
          dirMatrix = [1,0];break;
        case 2:
          dirMatrix = [0,-1];break;
        default: break;
      };
      return addArr(cardObj.square, dirMatrix);
    });
    // Map over these squares and return connected card objects if a card occupies them
    let newCardIds = newSquares.map(squ => {
      const newCardObj = cards.filter(obj => {
        return _.isEqual(squ, obj.square);
      })[0];
      if (!newCardObj) return {id:null, general:false, parent:null};
      return {id: newCardObj.card.id, general: newCardObj.card.type==="general", parent:cardObj.card.id};
    });
    // Filter out empty places
    return newCardIds.filter(val => {return val.id!==null});
  });
  // check to see if any card is not connected to anything
  if (connectedIds.filter(arr => {return !arr.length}).length) return false;
  // an array of successfully placed card ids (general by default)
  let successArr:number[] = [0];
  // {
  for (let i=0;i<cards.length;i++) {
    // forEach the success array
    successArr.forEach(id => {
      let idArr = connectedIds.filter(idObj => {return idObj[0].parent===id})[0];
      // Foreach the connected Cards
      idArr.forEach(idObj => {
        // Add connected Cards to success array    
        if (!successArr.includes(idObj.id)) successArr.push(idObj.id);
      });
    });
    // } : Repeat the total number of cards -1 times
  };
  const allCardIds = cards.map(obj => {return obj.card.id});
  return _.isEqual(_.sortBy([...successArr]),_.sortBy(allCardIds));
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
      Object.keys(players).forEach(player => {
        players[player].id = 0;
        const generalNum = Math.floor(generalArr.length*Math.random());
        if (players[player].generalChoice) {
          players[player].generalChoice.push(generalArr[generalNum]);
        } else {
          players[player].generalChoice = [generalArr[generalNum]];
        };
        generalArr.splice(generalNum,1);
      });
    };
    Object.keys(players).forEach(player => {
      players[player].wins = 0;
      if (!players[player].bot) return;
      const botGeneral:CardType = players[player].generalChoice[Math.floor(3*Math.random())];
      botGeneral.team = player;
      botGeneral.id = 0;
      players[player].id++;
      players[player].board = {cards: activeConnects([{card: botGeneral, square: [0,0]}])};
      players[player].generalChoice = null;
      players[player].hand = [];
      // give each bot 3 basics
      loop(3, () => {
        const basic = cardConnect({...shuffle([...basicCards])[0]});
        basic.id = players[player].id;
        basic.team = player;
        players[player].id++;
        players[player].hand.push(basic);
      });
    });
    const turnOrder = shuffle(Object.keys(players));
    let val = 0;
    let whoTurn = turnOrder[val];
    while (players[whoTurn].bot) {
      val++;
      whoTurn = turnOrder[val];
    };
    const shopOrder = shuffle([...heroCards].map((card:CardType) => {
      card = cardConnect(card);
      card.costArr = calcCost(card.cost, card.red, card.green, card.blue, card.type);
      return card;
    }));
    const game = {
      gameName: lobbyName,
      host: uid,
      players,
      whoTurn,
      turnOrder,
      shopOrder,
      whoFirst: `${whoTurn}`,
      shopBought: false,
      cycleShop: 2,
      battle: {
        started:false,
        battles:[],
      },
      battleFrequency: 15,
      cardsSinceBattle: 0,
      battleList: shuffle(battleCards),
      winsToWin: 3,
    };
  // -------------------- //
    await lobbyRef.set({ ...lobbyData, starting: true });
    await gameRef.set(game);
    return {response: game.gameName};
  } catch (e) {
    console.log("error",e);
    return {error: "Error sending to database"};
  };
};

export const leave = async (gameName:string, uid:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    const updatedGameData = {...gameData};
    const { players } = updatedGameData;
    if (!players) {
      return {error: "This game does not exist"};
    };
    if (!players[uid]) {
      return {error: "This player is not in this game"};
    };
    players[`BOT${uid}`] = {...players[uid]};
    delete players[uid];
    players[`BOT${uid}`].uid = "bot";
    players[`BOT${uid}`].bot = true;
    await gameRef.set(updatedGameData);
    console.log(Object.keys(players).filter(player => {return !players[player].bot}));
    return {response: Object.keys(players).filter(player => {return !players[player].bot})};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export const close = async (gameName:string, ending?:boolean, player?:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    if (ending&&!gameData.ended) {
      return {error: "This game has not ended"};
    };
    if (!gameData.players[player]) {
      return {error: "This player is not in this game"};
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
    };
    const updatedGameData = {...gameData};
    const updatedPlayer = updatedGameData.players[player];
    switch (updating) {
      case "general":
        data.card.activeConnections = [...blankConnects];
        data.card.id = updatedPlayer.id;
        data.card.team = player;
        updatedPlayer.id++;
        updatedPlayer.board = {cards: [{...data}], canPlace: calcCanPlace([{...data}])};
        updatedPlayer.generalChoice = null;
        updatedPlayer.hand = [];
        // give player 3 basics
        loop(3, () => {
          const basic = cardConnect({...shuffle([...basicCards])[0]});
          basic.id = updatedPlayer.id
          basic.team = player;
          updatedPlayer.id++;
          updatedPlayer.hand.push(basic);
        });
        updatedPlayer.goodPlacement = checkPlacement(updatedPlayer.board.cards)
        break;
      case "placeCard":
        if (updatedPlayer.board.cards.length===10) return { error: "max cards placed" };
        data.card.activeConnections = [...blankConnects];
        updatedPlayer.hand = updatedPlayer.hand.filter((card:CardType) => {
          return card.id!==data.card.id;
        });
        updatedPlayer.board.cards.push(data);
        updatedPlayer.board.canPlace = calcCanPlace(updatedPlayer.board.cards);
        updatedPlayer.board.cards = activeConnects(updatedPlayer.board.cards);
        updatedPlayer.goodPlacement = checkPlacement(updatedPlayer.board.cards);
        break;
      case "pickupCard":
        if (data.card.type==="general") break;
        updatedPlayer.board.cards = updatedPlayer.board.cards.filter((cardObj:{card:CardType,square:SquareType}) => {
          return !_.isEqual(cardObj.square, data.square);
        });
        data.card.activeConnections = [...blankConnects];
        updatedPlayer.hand? 
          updatedPlayer.hand.push(data.card) :
          updatedPlayer.hand = [data.card];
        updatedPlayer.board.canPlace = calcCanPlace(updatedPlayer.board.cards);
        updatedPlayer.board.cards = activeConnects(updatedPlayer.board.cards);
        updatedPlayer.goodPlacement = checkPlacement(updatedPlayer.board.cards);
        break;
      case "buyCard":
        const canBuy = calcPaid(data.payment,data.card);
        if (!canBuy) return {error: "This payment is incorrect"};
        data.card.id = updatedPlayer.id
        data.card.team = player;
        updatedPlayer.id++;
        updatedPlayer.hand? 
          updatedPlayer.hand.push(data.card) :
          updatedPlayer.hand = [{...data.card}];
        data.payment.forEach((payCard:CardType) => {
          updatedPlayer.hand = updatedPlayer.hand.filter((handCard:CardType) => {
            return !_.isEqual(payCard, handCard);
          });
        });
        const isFirstShopCard = _.isEqual(_.omit(updatedGameData.shopOrder[0],["id"]), _.omit(data.card,["id"]));
        updatedGameData.shopOrder = updatedGameData.shopOrder.filter((shopCard:CardType) => {
          return !_.isEqual(_.omit(shopCard,["id"]), _.omit(data.card,["id"]));
        });
        updatedGameData.shopBought = true;
        if (isFirstShopCard || updatedGameData.cycleShop===2) {
          updatedGameData.cycleShop = 2;
        } else {
          updatedGameData.cycleShop = 1;
        };
        break;
      default:
        break;
    };
    await gameRef.set(updatedGameData);
    return {response: updatedGameData.gameName};
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
    if (!checkPlacement([...updatedGameData.players[uid].board.cards])) {
      return {error: "Illegal placement"};
    };
    updatedGameData.players[uid].drawnBasic = false;
    const nextIndex = updatedGameData.turnOrder.indexOf(whoTurn)+1;
    let whoNext:string = updatedGameData.turnOrder[0];
    if (nextIndex!==updatedGameData.turnOrder.length) {
      whoNext = updatedGameData.turnOrder[nextIndex];
    };
    // If nothing is bought this turn, reduce shop cycle counter by 1
    if (whoNext===updatedGameData.whoFirst) {
      if (!updatedGameData.shopBought) {
        updatedGameData.cycleShop = updatedGameData.cycleShop-1;
        if (updatedGameData.cycleShop===0) {
          updatedGameData.shopOrder.shift();
          updatedGameData.cycleShop = 1;
        };
      };
      updatedGameData.shopBought = false;
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
  try {
    // Draw Card
    const { error } = await drawBasic(gameName, botUid);
    if (error) return { error };
    //OVERRIDE
    return {response: botUid};
    // Retrieve Game data to adjust positions
    const { gameData, gameRef } = await getGame(gameName);
    const updatedGameData = {...gameData};
    const bot = updatedGameData.players[botUid];
    // push all cards to hand
    bot.board.cards.forEach((cardObj:{card:CardType,square:SquareType}, i) => {
      if (cardObj.card.type!=="general") return bot.hand.push(cardObj.card);
    });
    bot.board.cards = [{...bot.board.cards[0]}];
    // Buy Cards
    const shopOptions = {prefer: "expensive",freq:4};
    if (!bot.shopBoughtCounter) {
      let shop:CardType[] = [];
      switch (shopOptions.prefer) {
        case "expensive":
          shop = gameData.shopOrder.slice(0,3).sort((a,b) => {return (b.cost-a.cost)});
          break;
        case "cheap":
          shop = gameData.shopOrder.slice(0,3).sort((a,b) => {return (a.cost-b.cost)});
          break;
        default: break;
      };
      const canBuy:{card: CardType, payment: CardType[]}[] = [];
      shop.forEach(card => {
        const buyResult = tryToBuy(card,[...bot.hand]);
        if (buyResult.canBuy) canBuy.push({card, payment:buyResult.payment});
      });
      if (canBuy.length) {
        const { card, payment } = canBuy[0];
        card.id = bot.id;
        bot.id++;
        card.team = botUid;
        bot.hand? 
          bot.hand.push(card) :
          bot.hand = [{...card}];
        payment.forEach((payCard:CardType) => {
          bot.hand = bot.hand.filter((handCard:CardType) => {
            return !_.isEqual(payCard, handCard);
          });
        });
        const isFirstShopCard = _.isEqual(_.omit(updatedGameData.shopOrder[0],["id"]), _.omit(card,["id"]));
        updatedGameData.shopOrder = updatedGameData.shopOrder.filter((shopCard:CardType) => {
          return !_.isEqual(_.omit(shopCard,["id"]), _.omit(card,["id"]));
        });
        updatedGameData.shopBought = true;
        if (isFirstShopCard || updatedGameData.cycleShop===2) {
          updatedGameData.cycleShop = 2;
        } else {
          updatedGameData.cycleShop = 1;
        };
        bot.shopBoughtCounter = shopOptions.freq;
      };
    } else {
      bot.shopBoughtCounter=bot.shopBoughtCounter-1;
    };
    const botCards = [...bot.hand];
    // Place Cards
    const bestPosition = calcPositions(botCards,bot.board.cards[0]);
    bot.hand = bestPosition.hand;
    bot.board.cards = activeConnects(bestPosition.board);
    await gameRef.set(updatedGameData);
    return {response: botUid};
  } catch (e) {
    console.log(e)
    return {error: `Error in ${botUid}'s turn`};
  };
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
    const basic = cardConnect({...shuffle([...basicCards])[0]});
    if (updatedGameData.cardsSinceBattle>updatedGameData.battleFrequency) {
      if (Math.floor(Math.random()*1)===0) {
        let res = await startBattle(gameName);
        if (res.response) return {response: res.response};
        return {error: res.error};
      };
    };
    updatedGameData.cardsSinceBattle++;
    basic.id = updatedGameData.players[uid].id
    basic.team = uid;
    updatedGameData.players[uid].id++;
    updatedGameData.players[uid].hand?
      updatedGameData.players[uid].hand.push(basic)
      :
      updatedGameData.players[uid].hand = [basic];
    updatedGameData.players[uid].drawnBasic = true;
    updatedGameData.players[uid].board.canPlace = calcCanPlace(updatedGameData.players[uid].board.cards);
    await gameRef.set(updatedGameData);
    return {response: basic};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export const startBattle = async (gameName:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    const updatedGameData = {...gameData};
    let battles = [];
    shuffle(Object.keys(updatedGameData.players)).forEach(player => {
      battles.length?
        battles[battles.length-1].players.length===2?
        battles.push({players:[updatedGameData.players[player]]})
        :
        battles[battles.length-1].players.push(updatedGameData.players[player])
      :
      battles.push({players:[updatedGameData.players[player]]});
    });
    const battleCard = updatedGameData.battleList.shift();
    battles.forEach(battle => {battle.whoTurn = shuffle(battle.players)[0].uid});
    updatedGameData.battle = {
      started: true,
      battles,
    };
    await gameRef.set(updatedGameData);
    return {response: battleCard};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };  
};

export const endBattleTurn = async (gameName:string, uid:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    const updatedGameData = {...gameData};
    let battleIndex = 0;
    const battle = updatedGameData.battle.battles.filter((bat:BattleType, index:number) => {
      if (bat.players.filter(player => {return player.uid===uid}).length) {
        battleIndex = index;
        return true;
      };
      return false;
    })[0];
    const { players } = battle;
    const uids = players.map(player => {return player.uid});
    const nextPlayer = uids.filter(id => {return id!==uid})[0];
    updatedGameData.players[uid].attacked = false;
    updatedGameData.battle.battles[battleIndex].whoTurn = nextPlayer;
    await gameRef.set(updatedGameData);
    const bot:boolean = updatedGameData.players[nextPlayer].bot;
    return {response: {nextPlayer, bot}};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export const runBotBattleTurn = async (gameName:string, botUid:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    const updatedGameData = {...gameData};
    let battleIndex = 0;
    const battle = updatedGameData.battle.battles.filter((bat:BattleType, index:number) => {
      if (bat.players.filter(player => {return player.uid===botUid}).length) {
        battleIndex = index;
        return true;
      };
      return false;
    })[0];
    const { players } = battle;
    const uids = players.map(player => {return player.uid});
    await gameRef.set(updatedGameData);
    return {response: botUid};
  } catch (e) {
    console.log(e)
    return {error: `Error in ${botUid}'s turn`};
  };
};

export const updateBattle = async (gameName:string, player:string, updating:string, data:any) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return { error: "This game does not exist"};
    };
    const updatedGameData = {...gameData};
    let updatedBattleIndex:number;
    const updatedBattle = updatedGameData.battle.battles.filter((bat, index) => {
      if (bat.players.filter(plyr => {return plyr.uid===player}).length) {
        updatedBattleIndex = index;
        return true;
      };
      return false;
    })[0];
    if (updatedBattle.whoTurn!==player) {
      return { error: "Not your turn"};
    };
    let playerIndex:number;
    let oponentIndex:number;
    if (updatedBattle.players[0].uid===player) {
      playerIndex = 0;
      oponentIndex = 1;
    } else {
      playerIndex = 1;
      oponentIndex = 0;
    };
    const { attackedCard, attackingCard, oponent } = data;
    let attackerIndex:number;
    let defenderIndex:number;
    const attacker = updatedBattle.players[playerIndex].board.cards.filter((cd,index) => {
      if (cd.card.id===attackingCard.card.id) {
        attackerIndex = index;
        return true;
      };
      return false;
    })[0];
    const defender = updatedBattle.players[oponentIndex].board.cards.filter((cd,index) => {
      if (cd.card.id===attackedCard.card.id) {
        defenderIndex = index;
        return true;
      };
      return false;
    })[0];
    switch (updating) {
      case "attack":
        if (attacker.card.atk===0) return {error: "Attacker has no attack"};
        if (updatedGameData.players[player].attacked) return {error: "Player has already attacked"};
        // Calc connection bonuses
        let bonuses = [[0,0],[0,0]];
        [attacker,defender].forEach((cardObj, index) => cardObj.card.activeConnections.forEach((con) => {
          switch (con) {
            case "red":
              bonuses[index][0]++;
              break;
            case "green":
              bonuses[index][1]++;
              break;
            case "blue":
              bonuses[index][0]++;
              bonuses[index][1]++;
              break;
            default: break;
          };
        }));
        attacker.card.hp = attacker.card.hp - defender.card.atk;
        defender.card.hp = defender.card.hp - attacker.card.atk - bonuses[0][0] + bonuses[1][1];
        updatedGameData.players[player].attacked = true;
        break;
      case "cast":
        if (attacker.card.style!=="bolt") return {error: "Attacker has no ability"};
        if (attacker.card.cast) return {error: "Attacker has already cast"};
        break;
      default: break;
    };
    const attackerAlive = attacker.card.hp>0;
    const defenderAlive = defender.card.hp>0;
    let playerCards = updatedBattle.players[playerIndex].board.cards;
    let oponentCards = updatedBattle.players[oponentIndex].board.cards;
    // filter out dead equipment
    const checkEquipment = (cards:{card:CardType,square:SquareType}[], testCard:{card:CardType,square:SquareType}) => {
      const connections = [...testCard.card.connections];
      // Create an array of potentially connected squares
      const newSquares = connections.map((con,i) => {
        let dirMatrix = [-1,0];
        switch (i) {
          case 0:
            dirMatrix = [0,1];break;
          case 1:
            dirMatrix = [1,0];break;
          case 2:
            dirMatrix = [0,-1];break;
          default: break;
        };
        return addArr(testCard.square, dirMatrix);
      });
      const filtered = cards.filter(cardObj => {
        if (newSquares.filter(squ => _.isEqual(squ, cardObj.square)).length&&cardObj.card.ability==="Equipment") {
          return false;
        };
        return true;
      });
      return filtered
    };
    if (!attackerAlive) {
      playerCards = activeConnects(checkEquipment(playerCards, attacker).filter(cdObj => {return cdObj.card.id!==attacker.card.id}));
    };
    if (!defenderAlive) {
      oponentCards = activeConnects(checkEquipment(oponentCards, defender).filter(cdObj => {return cdObj.card.id!==defender.card.id}));
    };
    updatedBattle.players[playerIndex].board.cards = playerCards;
    updatedBattle.players[oponentIndex].board.cards = oponentCards;
    updatedGameData.battle.battles[updatedBattleIndex] = updatedBattle;
    await gameRef.set(updatedGameData);
    return {response: {updatedBattle, updatedBattleIndex}};
  } catch (e) {
    console.log(e)
    return {error: "Error sending to database"};
  };
};

export const endBattle = async (gameName:string, winner:string, draw:boolean, battleIndex:number) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    const updatedGameData = {...gameData};
    const updatedBattle = updatedGameData.battle.battles[battleIndex];
    updatedBattle.ended = true;
    let gameWinner = "";
    if (winner&&!draw) {
      updatedGameData.players[winner].wins++;     
      if (updatedGameData.players[winner].wins===updatedGameData.winsToWin) gameWinner = winner;
    };
    const allBattlesEnded = !updatedGameData.battle.battles.map(bat => {return bat.ended}).filter(ended => {return !ended}).length;
    if (allBattlesEnded) updatedGameData.battle.started = false;
    await gameRef.set(updatedGameData);
    return {response: {msg:`ended battle ${battleIndex}`, gameWinner, allBattlesEnded}};
  } catch (e) {
    console.log(e)
    return {error: `Error connecting to Database`};
  };
};

export const endGame = async (gameName:string, winner:string) => {
  try {
    const { gameData, gameRef } = await getGame(gameName);
    if (!gameData) {
      return {error: "This game does not exist"};
    };
    const updatedGameData = {...gameData};
    const winnerName = updatedGameData.players[winner].username?updatedGameData.players[winner].username:winner;
    const errors = await Promise.all(Object.keys(updatedGameData.players).map(async player => {
      if (updatedGameData.players[player].bot) return {error: false, response: ""};
      return UserController.saveGame(updatedGameData, updatedGameData.players[player].uid, winnerName);
    }));
    if (errors.filter(err => {return err.error}).length) return {error: `Error saving games`};
    const gameID = errors.filter(obj => {return obj.response})[0].response;
    updatedGameData.ended = true;
    await gameRef.set(updatedGameData);
    return { response: gameID };
  } catch (e) {
    console.log(e)
    return {error: `Error connecting to Database`};
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
  endBattleTurn,
  runBotBattleTurn,
  updateBattle,
  endBattle,
  endGame,
};