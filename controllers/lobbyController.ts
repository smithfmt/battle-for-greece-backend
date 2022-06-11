import { body, validationResult } from "express-validator";
import { Firestore } from '@google-cloud/firestore';

import BackendLobbyService from "../services/BackendLobbyService";
import BackendGameService from "../services/BackendGameService";
import { NextFunction, Response } from "express";
import { AuthRequest, UserType, LobbyType, GameType } from "../types";

const db = new Firestore({
  projectId: 'struggle-for-greece-4f90c',
  keyFilename: './config/serviceAccount.json',
});

const profanity = [
    "fuck", "f0ck", "f*ck", "cunt", "c0nt", "c*nt", "shit","sh1t", "5hit", "5h1t", "sh*t", "bitch", "b1tch", "b*tch", "crap"
];

const getUser = async (uid:string) => {
    const userRef = await db.collection('users').doc(uid).get();
    return(userRef.data());
};

const cleanupLobbies = async ({lobby, game}:{lobby:string|false, game:string|false},uid:string) => {
    if (lobby) {
        const { response: leaveResponse, error: leaveError } = await BackendLobbyService.leave(lobby, uid);
        if (leaveResponse && !leaveResponse.length) {
            const { response: closeResonse, error: closeError } = await BackendLobbyService.close(lobby);
            console.log(closeResonse, closeError);
        };
    };
    if (game) {
        const { response: leaveResponse, error: leaveError } = await BackendGameService.leave(game, uid);
        if (!leaveResponse && !leaveResponse.length) {
            const { response: closeResonse, error: closeError } = await BackendGameService.close(game);
            console.log(closeResonse, closeError);
        };
    };
};

export const validateLobby = [
    body("lobbyName", "You must supply a lobby name").notEmpty(),
    // body("lobbyName", "Please only use numbers and letters for your lobby name").isAlphanumeric(),
    body("lobbyName", "Please refrain from profanity in your lobby name").custom((name) => {
        let clean = true;
        profanity.forEach((word) => {
            if (name.toLowerCase().includes(word)) {
                clean = false;
            };
        });
        return clean;
    }),
    (req:AuthRequest, res:Response, next:NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // consolg.log(errors.array());
            return errors.array().forEach(err => res.status(402).json({ success: false, msg: err.msg }));
        };
        next();
    },
];

export const createLobby = async (req:AuthRequest, res:Response) => {
    const { lobbyName, playerCount } = req.body;
    const { uid } = req.userInfo;
    const user:UserType = await getUser(uid);
    const lobby = {
        lobbyName,
        playerCount,
        players: [{ uid, username: user.username }],
        host: uid,
    };
    await cleanupLobbies(user.open, uid);
    user.open.game = false;
    user.open.lobby = lobbyName;
    const usersRef = db.collection('users');
    await usersRef.doc(uid).set(user);
    const { response, error } = await BackendLobbyService.create(lobby);
    if (error) {
        res.status(403).json({ success: false, msg: error });
    } else {
        res.status(200).json({ success: true, msg: "Successfully created lobby", response });
    };
};

export const joinLobby = async (req:AuthRequest, res:Response) => {
    const { lobbyName } = req.body;
    const { uid } = req.userInfo;
    const user = await getUser(uid);
    if (user.open.lobby===lobbyName) {
        res.status(200).json({ success: true, msg: "Player already in Lobby!", lobbyName, uid });
    } else {
        await cleanupLobbies(user.open, uid);
        user.open.game = false;
        user.open.lobby = lobbyName;
        const usersRef = await db.collection('users');
        await usersRef.doc(uid).set(user);
        const { response, error } = await BackendLobbyService.join(lobbyName, uid, user);
        if (error) {
            res.status(403).json({ success: false, msg: error });
        } else {
            res.status(200).json({ success: true, msg: "Successfully joined lobby", response, uid });
        };
    };
};

export const removeLobby = async (req:AuthRequest, res:Response) => {
    const { lobbyName } = req.body;
    const { response, error } = await BackendLobbyService.close(lobbyName);
    if (error) {
        res.status(403).json({ success: false, msg: error });
    } else {
        res.status(200).json({ success: true, msg: "Successfully deleted Lobby", response });
    };
};

export default {
    validateLobby,
    createLobby,
    joinLobby,
    removeLobby,
};