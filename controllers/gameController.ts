import { body, validationResult } from "express-validator";
import { Firestore } from '@google-cloud/firestore';
import { AuthRequest, UserType } from "../types";
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
    user.open.lobby = undefined;
    const usersRef = db.collection('users');
    await usersRef.doc(uid).set(user);
    const [response, err] = await BackendGameService.create(lobbyName, botNumber, uid);
    if (err) {
        console.log(err)
        res.status(403).json({ success: false, msg: err });
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
        const [response, err] = await BackendGameService.updatePlayer(gameName, player, updating, data);
        if (err) {
            res.status(403).json({ success: false, msg: err });
        } else {
            res.status(200).json({ success: true, msg: "Successfully updated player", response, player });
        };
    };
};

export const nextTurn = async (req:AuthRequest, res:Response) => {
    const { uid } = req.userInfo;
    const { gameName } = req.body;
    const [response, err] = await BackendGameService.nextTurn(gameName, uid);
    if (typeof response === "string" || err) {
        return res.status(403).json({ success: false, msg: err });
    };
    let bot = response.bot;
    while (bot) {
        const [botResponse, botErr] = await BackendGameService.runBotTurn(gameName, response.whoNext);
        if (botErr) console.log(botErr);
        const [nextResponse, nextErr] = await BackendGameService.nextTurn(gameName, response.whoNext);
        if (typeof nextResponse === "string" || nextErr) {
            return res.status(403).json({ success: false, msg: nextErr });
        };
        bot = nextResponse.bot;
    };
    res.status(200).json({ success: true, msg: "Next Turn", response });           
};

export const drawBasic = async (req:AuthRequest, res:Response) => {
    const { uid } = req.userInfo;
    const { gameName } = req.body;
    const [response, err] = await BackendGameService.drawBasic(gameName, uid);
    if (err) {
        res.status(403).json({ success: false, msg: err });
    } else {
        res.status(200).json({ success: true, msg: "Drawn Basic!", response });           
    };
};

export default {
    createGame,
    updatePlayer,
    nextTurn,
    drawBasic,
};
