import express from "express";
const router = express.Router();
import userController from "../controllers/userController";
import lobbyController from "../controllers/lobbyController";
import gameController from "../controllers/gameController";
router.use(express.json());
import { Firestore } from '@google-cloud/firestore';

import { AuthRequest } from "../backend-types";

const db = new Firestore({
  projectId: 'struggle-for-greece-4f90c',
  keyFilename: './config/serviceAccount.json',
});

// Api is Working //

router.get("/", (req, res, next) => {
  res.send(`userAPI is working properly :)`);
});

// Routes

router.post("/test",
  async (req, res) => {
    const { user } = req.body;
    const { username, first, last, password } = user;
    const userRef = db.collection('users').doc(username);
    const exists = await userRef.get()
    if (exists.exists) {
      res.status(400).json({ success: false, msg: `Username already exists!`, username});
    } else {
      await userRef.set({
        username,
        first,
        last,
        password,
      });
      res.status(200).json({ success: true, msg: `Successfully added Test User`, user});
    };
  },
);

router.get("/profile", async (req:AuthRequest, res) => {
  const { userInfo } = req;
  const { uid } = userInfo;
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    const user = await userDoc.data();
    res.status(200).json({ success: true, msg: `Welcome to your profile`, user });
  } else {
    res.status(200).json({ success: true, msg: `This is a new user!`, user: true });
  };
});

router.post("/account",
  userController.validateAccount,
  userController.createAccount,
);

router.delete("/account",
  userController.deleteAccount,
);

router.post("/lobby",
  lobbyController.validateLobby,
  lobbyController.createLobby,
);

router.post("/join",
  lobbyController.joinLobby,
);

router.post("/start",
  gameController.createGame,
  lobbyController.removeLobby,
);

router.get("/leaderboard",
  userController.getAllUsers,
);

router.put("/player",
  gameController.updatePlayer,
);

router.put("/nextTurn",
  gameController.nextTurn,
);

router.put("/drawBasic",
  gameController.drawBasic,
);

export default router;
