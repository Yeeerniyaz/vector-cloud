import { v4 as uuidv4 } from "uuid";
import { db } from "../services/dbService.js";
import { io } from "../../index.js"; // Импортируем Socket.IO для уведомления зеркала

// 1. Страница ввода кода (Отрисовка)
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

// 2. Обработка кода (Связывание User <-> Device)
export const handleLogin = async (req, res) => {
    const { state, redirect_uri, user_code } = req.body;
    
    // Убираем пробелы, если юзер ввел "123 456"
    const cleanCode = user_code ? user_code.replace(/\s+/g, '') : "";

    // А. Ищем, какое устройство сгенерировало этот код
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

    // Б. "Магия": Находим или создаем юзера для этого устройства
    const userId = await db.ensureUserForDevice(deviceId);

    // В. Уведомляем зеркало, что всё получилось (прямо сейчас, пока оно онлайн)
    // Зеркало может скрыть код и показать "Привет, хозяин!"
    io.to(deviceId).emit('pairing_success', { userId });
    console.log(`🔗 Device ${deviceId} linked to User ${userId}`);

    // Г. Генерируем временный Auth Code для Яндекса
    const authCode = uuidv4();
    await db.saveAuthCode(authCode, userId); // Привязываем код к ЮЗЕРУ
    
    // Д. Удаляем использованный код сопряжения (безопасность)
    await db.deletePendingCode(cleanCode);
    
    // Е. Возвращаем пользователя в Яндекс
    res.redirect(`${redirect_uri}?state=${state}&code=${authCode}`);
};

// 3. Обмен кода на токен (Yandex -> Server)
export const handleToken = async (req, res) => {
    const { code } = req.body;
    
    // А. Проверяем код и получаем ID пользователя
    const userId = await db.getUserByAuthCode(code);
    
    if (!userId) {
        return res.status(400).json({ error: "invalid_grant" });
    }

    // Б. Создаем вечный Access Token
    const accessToken = uuidv4();
    await db.saveAccessToken(accessToken, userId);

    console.log(`🔑 Token issued for User ${userId}`);

    // В. Отдаем токен Яндексу
    res.json({
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 31536000, // 1 год
    });
};

// 4. Отвязка аккаунта (Опционально)
export const unlink = async (req, res) => {
    const requestId = req.headers["x-request-id"] || "no-id";
    // Здесь можно добавить удаление токенов юзера из БД
    res.status(200).json({ request_id: requestId });
};