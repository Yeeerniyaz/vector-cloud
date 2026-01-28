import { v4 as uuidv4 } from 'uuid';
import db, { saveDB } from '../services/dbService.js';

export const renderAuthPage = (req, res) => {
    res.send(`
        <body style="background:#000;color:#ff9900;text-align:center;padding:50px;font-family:sans-serif;">
            <h1>VECTOR OS</h1><p>Введите ID устройства:</p>
            <form action="/login" method="post">
                <input type="hidden" name="state" value="${req.query.state}">
                <input type="hidden" name="redirect_uri" value="${req.query.redirect_uri}">
                <input name="device_id" placeholder="v-001" style="padding:10px;border-radius:5px;" required>
                <button style="padding:10px;background:#ff9900;border:none;cursor:pointer;">ПРИВЯЗАТЬ</button>
            </form>
        </body>`);
};

export const handleLogin = (req, res) => {
    const code = uuidv4();
    db.authCodes[code] = req.body.device_id;
    saveDB();
    res.redirect(`${req.body.redirect_uri}?state=${req.body.state}&code=${code}`);
};

export const handleToken = (req, res) => {
    const accessToken = uuidv4();
    db.tokens[accessToken] = db.authCodes[req.body.code];
    saveDB();
    res.json({ access_token: accessToken, token_type: 'bearer', expires_in: 31536000 });
};