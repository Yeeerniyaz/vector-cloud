import { v4 as uuidv4 } from 'uuid';
import db, { saveDB } from '../services/dbService.js';

export const renderAuthPage = (req, res) => {
    res.send(`
        <body style="background:#000;color:#ff9900;text-align:center;padding:50px;font-family:sans-serif;">
            <h1>VECTOR OS</h1><p>Привязка зеркала к Алисе</p>
            <form action="/login" method="post">
                <input type="hidden" name="state" value="${req.query.state || ''}">
                <input type="hidden" name="redirect_uri" value="${req.query.redirect_uri || ''}">
                <input name="device_id" placeholder="ID (напр. v-001)" style="padding:10px;border-radius:5px;" required>
                <button style="padding:10px;background:#ff9900;border:none;cursor:pointer;margin-left:10px;">OK</button>
            </form>
        </body>`);
};

export const handleLogin = (req, res) => {
    const { state, redirect_uri, device_id } = req.body;
    const code = uuidv4();
    db.authCodes[code] = device_id;
    saveDB();
    res.redirect(`${redirect_uri}?state=${state}&code=${code}`);
};

export const handleToken = (req, res) => {
    const deviceId = db.authCodes[req.body.code];
    if (!deviceId) return res.status(400).json({ error: "invalid_code" });
    const accessToken = uuidv4();
    db.tokens[accessToken] = deviceId;
    saveDB();
    res.json({ access_token: accessToken, token_type: 'bearer', expires_in: 31536000 });
};