import { v4 as uuidv4 } from "uuid";
import { db } from "../services/dbService.js"; // SQL базасы
import { io } from "../../index.js"; // Сокет жіберу үшін

export const renderAuthPage = (req, res) => {
    res.send(`
        <body style="background:#000;color:#ff9900;text-align:center;padding:50px;font-family:sans-serif;">
            <h1 style="letter-spacing: 5px;">VECTOR OS</h1>
            <p>Введите код с экрана зеркала:</p>
            <form action="/login" method="post">
                <input type="hidden" name="state" value="${req.query.state || ""}">
                <input type="hidden" name="redirect_uri" value="${req.query.redirect_uri || ""}">
                
                <input type="text" name="user_code" placeholder="000 000" maxlength="6"
                       style="font-size: 24px; padding: 10px; text-align: center; width: 200px; margin-bottom: 20px; border-radius: 5px; border: none; outline: none;">
                <br>
                
                <button style="padding:15px 40px;background:#ff9900;border:none;cursor:pointer;font-weight:bold;border-radius:10px;font-size:16px;">
                    ПОДТВЕРДИТЬ
                </button>
            </form>
        </body>`);
};

export const handleLogin = async (req, res) => {
    const { state, redirect_uri, user_code } = req.body;
    const cleanCode = user_code ? user_code.replace(/\s+/g, '') : "";

    // 1. PostgreSQL-ден код бойынша deviceId іздеу (бұрын db.pendingCodes болған)
    // Ескерту: Кестеде 'auth_codes' немесе 'pending_codes' деген баған болуы керек
    const deviceId = await db.getDeviceIdByCode(cleanCode);

    if (!deviceId) {
        return res.status(400).send(`
            <body style="background:#000;color:red;text-align:center;font-family:sans-serif;padding:50px;">
                <h1>Ошибка!</h1>
                <p>Код не найден или истек.</p>
                <a href="javascript:history.back()" style="color:#ff9900">Попробовать снова</a>
            </body>
        `);
    }

    // 2. Яндекс үшін уақытша код жасау
    const code = uuidv4();
    await db.saveAuthCode(code, deviceId); // Базаға сақтау
    
    // Кодты өшіру (бір реттік болуы үшін)
    await db.deletePendingCode(cleanCode);
    
    // 3. Редирект
    res.redirect(`${redirect_uri}?state=${state}&code=${code}`);
};

export const handleToken = async (req, res) => {
    const { code } = req.body;
    
    // Базадан deviceId-ді код арқылы алу
    const deviceId = await db.getDeviceIdByAuthCode(code);
    if (!deviceId) return res.status(400).json({ error: "invalid_code" });

    const accessToken = uuidv4();
    // Токенді базаға тіркеу
    await db.saveAccessToken(accessToken, deviceId);

    // 👇 МАГИЯ: MQTT орнына Socket.io арқылы зеркалоға хабар жіберу
    io.to(deviceId).emit('command', { cmd: 'AUTH_SUCCESS', value: true });

    res.json({
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 31536000,
    });
};

export const unlink = async (req, res) => {
    const requestId = req.headers["x-request-id"] || "no-id";
    // Базадан токенді өшіру логикасын қосуға болады
    res.status(200).json({ request_id: requestId });
};