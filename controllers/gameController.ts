import { Firestore } from '@google-cloud/firestore';
import { AuthRequest, UserType } from "../backend-types";
import { NextFunction, Response } from "express";
import { cleanupLobbies } from "./lobbyController";
import { getUser, saveGame } from "./userController";
import BackendGameService from "../services/BackendGameService";

const db = new Firestore({
  projectId: 'struggle-for-greece-4f90c',
  keyFilename: './config/serviceAccount.json',
});

export const createGame = async (req:AuthRequest, res:Response, next:NextFunction) => {
    const { lobbyName, botNumber } = req.body;
    const { uid } = req.userInfo;
    const user:UserType = await getUser(uid);
    user.open.game = lobbyName;
    user.open.lobby = false;
    const usersRef = db.collection('users');
    await usersRef.doc(uid).set(user);
    const { response, error } = await BackendGameService.create(lobbyName, botNumber, uid);
    if (error) {
        console.log(error)
        res.status(403).json({ success: false, msg: error });
    } else {
        next();
    };
};

export const updatePlayer = async (req:AuthRequest, res:Response) => {
    const { uid } = req.userInfo;
    const { player, updating, data, gameName } = req.body;
    if (player!==uid) {
        res.status(403).json({ success: false, msg: "Cannot update another player" });
    } else {
        const { response, error } = await BackendGameService.updatePlayer(gameName, player, updating, data);
        if (error) {
            res.status(403).json({ success: false, msg: error });
        } else {
            res.status(200).json({ success: true, msg: "Successfully updated player", response, player });
        };
    };
};

export const nextTurn = async (req:AuthRequest, res:Response) => {
    const { uid } = req.userInfo;
    const { gameName } = req.body;
    const { response, error } = await BackendGameService.nextTurn(gameName, uid);
    if (error) {
        return res.status(403).json({ success: false, msg: error });
    };
    let bot = response.bot;
    while (bot) {
        const { response: botResponse, error: botError } = await BackendGameService.runBotTurn(gameName, response.whoNext);
        if (botError) console.log(botError);
        const { response: nextResponse, error: nextError} = await BackendGameService.nextTurn(gameName, response.whoNext);
        if (nextError) {
            return res.status(403).json({ success: false, msg: nextError });
        };
        bot = nextResponse.bot;
    };
    res.status(200).json({ success: true, msg: "Next Turn", response });
};

export const drawBasic = async (req:AuthRequest, res:Response) => {
    const { uid } = req.userInfo;
    const { gameName } = req.body;
    const { response, error } = await BackendGameService.drawBasic(gameName, uid);
    if (error) {
        return res.status(403).json({ success: false, msg: error });
    };
    return res.status(200).json({ success: true, msg: "Drawn Basic!", response });
};

export const endBattleTurn = async (req:AuthRequest, res:Response) => {
    const { uid } = req.userInfo;
    const { gameName, uid: endUid } = req.body;
    if (uid!== endUid) return res.status(403).json({ success: false, msg: "Not Your Turn" })
    const { response, error } = await BackendGameService.endBattleTurn(gameName, uid);
    if (error) {
        return res.status(403).json({ success: false, msg: error });
    };
    let bot = response.bot;
    while (bot) {
        const { response: botResponse, error: botError } = await BackendGameService.runBotBattleTurn(gameName, response.nextPlayer);
        if (botError) console.log(botError);
        const { response: nextResponse, error: nextError} = await BackendGameService.endBattleTurn(gameName, response.nextPlayer);
        if (nextError) {
            return res.status(403).json({ success: false, msg: nextError });
        };
        bot = nextResponse.bot;
    };
    res.status(200).json({ success: true, msg: "Next Battle Turn", response });
};

export const updateBattle = async (req:AuthRequest, res:Response) => {
    const { uid } = req.userInfo;
    const { gameName, player, updating, data } = req.body;
    if (uid!==player) return res.status(403).json({ success: false, msg: "Can't update someone else" });
    const { response, error } = await BackendGameService.updateBattle(gameName, player, updating, data);
    if (error) {
        return res.status(403).json({ success: false, msg: error });
    };
    const { updatedBattle: battle, updatedBattleIndex: battleIndex } = response;
    // Check for winner
    let winner = "";
    let draw = false;
    battle.players.forEach(player => {
        if (!player.board.cards.length) {
            winner? draw = true : winner = battle.players.filter(plyr => {return plyr.uid!==player.uid})[0].uid;
        };
    });
    if (draw||winner) {
        const { response, error } = await BackendGameService.endBattle(gameName, winner, draw, battleIndex);
        if (error) {
            return res.status(403).json({ success: false, msg: error });
        };
        const { msg, gameWinner, allBattlesEnded } = response;
        if (gameWinner&&allBattlesEnded) {
            const { response, error } = await BackendGameService.endGame(gameName, gameWinner);
            if (error) {
                return res.status(403).json({ success: false, msg: error });
            };
            return res.status(200).json({ success: true, msg: "successfully ended game", id: response });
        };
        return res.status(200).json({ success: true, msg: response });
    };
    return res.status(200).json({ success: true, msg: `attacked ${data.attackedCard.card.uid}`, response });
};

export const leaveGame = async (req:AuthRequest, res:Response) => {
    try {
        const { uid } = req.userInfo;
        const { name, player } = req.body;
        const user:UserType = await getUser(uid);
        if (uid!==player) return res.status(403).json({ success: false, msg: "cannot remove another user" });
        await cleanupLobbies(user.open, uid);
        user.open.game = false;
        const usersRef = db.collection('users');
        await usersRef.doc(uid).set(user);
        return res.status(200).json({ success: true, msg: `${player} successfully left game ${name}`, user });
    } catch (e) {
        console.log(e);
        return res.status(403).json({ success: false, msg: "error contacting database" })
    };    
};

export const endGame = async (req:AuthRequest, res:Response) => {
    try {
        const { uid } = req.userInfo;
        const { gameName, player } = req.body;
        const { response, error} = await BackendGameService.close(gameName, true, player);
        if (error) {
            return res.status(403).json({ success: false, msg: error });
        };
        return res.status(200).json({ success: true, msg: response });
    } catch (e) {
        console.log(e);
        return res.status(403).json({ success: false, msg: "error contacting database" })
    };    
};

export default {
    createGame,
    updatePlayer,
    nextTurn,
    drawBasic,
    endBattleTurn,
    updateBattle,
    leaveGame,
    endGame,
};
