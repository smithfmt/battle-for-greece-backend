import { body, validationResult } from "express-validator";
import { Firestore } from '@google-cloud/firestore';

import BackendLobbyService from "../services/BackendLobbyService";
import { NextFunction, Response } from "express";
import { AuthRequest, UserType } from "../types";

const db = new Firestore({
  projectId: 'struggle-for-greece-4f90c',
  keyFilename: './config/serviceAccount.json',
});

const profanity = [
    "fuck", "f0ck", "f*ck", "cunt", "c0nt", "c*nt", "shit","sh1t", "5hit", "5h1t", "sh*t", "bitch", "b1tch", "b*tch", "ass", "a55", "crap"
];

export const validateAccount = [
    body("username", "You must supply a username").notEmpty(),
    body("username", "Please only use numbers and letters for your username").isAlphanumeric(),
    body("username", "Please refrain from profanity in your username").custom((name) => {
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

export const createAccount = async (req:AuthRequest, res:Response) => {
    const { username } = req.body;
    const { userInfo } = req;
    const { uid, name } = userInfo;
    const [first, last] = name.split(" ")
    const usersRef = db.collection('users');
    const usernameSnapshot = await usersRef.where("username", "==", name.toLowerCase()).get();
    const uidSnapshot = await usersRef.where("uid", "==", uid).get();
    if (!usernameSnapshot.empty || !uidSnapshot.empty) {
        res.status(403).json({ success: false, msg: "Username already taken!" })
    } else {
        const user = {
            first,
            last,
            username,
            uid,
            games: 0,
            wins: 0,
            open: {
                lobby: false,
                game: false,
            },
        };
        await usersRef.doc(uid).set(user);
        res.status(200).json({ success: true, msg: "Successfully created user", user });
    };
};

export const deleteAccount = async (req:AuthRequest, res:Response) => {
    const { userInfo } = req;
    const { uid } = userInfo;
    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.doc(uid).get();
    const userData = userSnapshot.data();
    try {
        if (userData.lobby) {
            const { response, error } = await BackendLobbyService.leave(userData.lobby, uid);
            if (response && !response.length) {
                const { response, error } = await BackendLobbyService.close(userData.lobby);
            };
        };
        await usersRef.doc(uid).delete();
        res.status(200).json({ success: true, msg: "Successfully deleted user", uid });
    } catch {
        res.status(500).json({ success: false, msg: "Internal Server Error" });
    }
};

export const getAllUsers = async (req:AuthRequest, res:Response) => {
    try {
        const usersRef = db.collection('users');
        const usersSnapshot = await usersRef.get();
        const users:UserType[] = [];
        usersSnapshot.forEach(snapshot => {
            const { username, wins, games } = snapshot.data();
            users.push({username, wins, games});
        });
        res.status(200).json({ success: true, msg: "Here are all user stats", users });
    } catch {
        res.status(500).json({ success: false, msg: "Internal Server Error" });
    };
};

export default {
    validateAccount,
    createAccount,
    deleteAccount,
    getAllUsers,
};