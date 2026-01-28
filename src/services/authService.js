import db from './dbService.js';

export const checkAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !db.tokens[token]) {
        return res.status(401).json({ error: "unauthorized" });
    }
    req.deviceId = db.tokens[token];
    next();
};