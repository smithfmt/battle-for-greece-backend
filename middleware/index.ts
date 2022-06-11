import { NextFunction, Response } from "express";
import admin from "../config/firebase-config";

import { AuthRequest } from "../types";

class Middleware {
    async decodeToken(req: AuthRequest, res:Response, next:NextFunction) {
        if (!req.headers) return;
        const token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : "notoken";
        if (token==="notoken") {console.log("no token")}
        try {
            const decodeValue = await admin.auth().verifyIdToken(token, true);
            if (decodeValue) {
                req.userInfo = decodeValue;
                return next();
            }
            return res.status(400).json({ success: false, msg: `Unauthorized Token` });
        } catch (e) {
            if (e.errorInfo.code==="auth/id-token-expired") {
                return res.status(500).json({ success: false, msg: `Token Expired` });
            } else {
                return res.status(500).json({ success: false, msg: `Internal Error` });
            };
        };
    };
};

const middleware = new Middleware();

export default middleware;