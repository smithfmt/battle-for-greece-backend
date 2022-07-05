import { Firestore } from '@google-cloud/firestore';
import { AuthRequest, UserType } from "../backend-types";
import { NextFunction, Response } from "express";

import BackendGameService from "../services/BackendGameService";

const db = new Firestore({
  projectId: 'struggle-for-greece-4f90c',
  keyFilename: './config/serviceAccount.json',
});

const getUser = async (uid:string) => {
    const userRef = await db.collection('users').doc(uid).get();
    return(userRef.data());
};

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

export default {
    createGame,
    updatePlayer,
    nextTurn,
    drawBasic,
};
