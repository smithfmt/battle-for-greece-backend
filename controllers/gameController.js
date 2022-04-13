const { body, validationResult } = require("express-validator");
const Firestore = require('@google-cloud/firestore');

const BackendGameService = require("../services/BackendGameService");

const db = new Firestore({
  projectId: 'struggle-for-greece-4f90c',
  keyFilename: './config/serviceAccount.json',
});

const getUser = async (uid) => {
    const userRef = await db.collection('users').doc(uid).get();
    return(userRef.data());
};

exports.createGame = async (req, res, next) => {
    const { lobbyName, botNumber } = req.body;
    const { uid } = req.userInfo;
    const user = await getUser(uid);
    user.open.game = lobbyName;
    user.open.lobby = false;
    const usersRef = await db.collection('users');
    await usersRef.doc(uid).set(user);
    const [response, err] = await BackendGameService.create(lobbyName, botNumber, uid);
    if (err) {
        console.log(err)
        res.status(403).json({ success: false, msg: err });
    } else {
        next();
    };
};

exports.updatePlayer = async (req, res) => {
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

exports.nextTurn = async (req, res) => {
    const { uid } = req.userInfo;
    const { gameName } = req.body;
    const [response, err] = await BackendGameService.nextTurn(gameName, uid);
    if (err) {
        res.status(403).json({ success: false, msg: err });
    } else {
        let bot = response.bot;
        while (bot) {
            const [botResponse, botErr] = await BackendGameService.runBotTurn(gameName, response.whoNext);
            if (botErr) console.log(botErr);
            const [nextResponse, nextErr] = await BackendGameService.nextTurn(gameName, response.whoNext);
            if (nextErr) {
                console.log(nextErr);
            } else {
                bot = nextResponse.bot;
            };
        };
        res.status(200).json({ success: true, msg: "Next Turn", response });           
    };
};

exports.drawBasic = async (req, res) => {
    const { uid } = req.userInfo;
    const { gameName } = req.body;
    const [response, err] = await BackendGameService.drawBasic(gameName, uid);
    if (err) {
        res.status(403).json({ success: false, msg: err });
    } else {
        res.status(200).json({ success: true, msg: "Drawn Basic!", response });           
    };
};
