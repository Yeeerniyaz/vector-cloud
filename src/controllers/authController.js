import { v4 as uuidv4 } from "uuid";
import db, { saveDB } from "../services/dbService.js";
import { sendAuthSuccess } from "../services/mqttService.js"; // 👇 Добавили импорт

export const renderAuthPage = (req, res) => {
  // Нам больше не нужен UUID в URL, мы ждем ввод кода пользователем
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

export const handleLogin = (req, res) => {
  const { state, redirect_uri, user_code } = req.body;

  // Убираем пробелы, если пользователь ввел "123 456"
  const cleanCode = user_code ? user_code.replace(/\s+/g, '') : "";

  // 1. Ищем устройство по коду
  const deviceId = db.pendingCodes[cleanCode];

  if (!deviceId) {
    return res.status(400).send(`
        <body style="background:#000;color:red;text-align:center;font-family:sans-serif;padding:50px;">
            <h1>Ошибка!</h1>
            <p>Код не найден или истек.</p>
            <a href="javascript:history.back()" style="color:#ff9900">Попробовать снова</a>
        </body>
    `);
  }

  // 2. Генерируем временный код для Яндекса
  const code = uuidv4();
  db.authCodes[code] = deviceId; 
  
  // (Опционально) Можно удалить код из pending, чтобы нельзя было использовать дважды
  delete db.pendingCodes[cleanCode];
  
  saveDB();
  
  // 3. Редирект обратно в Яндекс
  res.redirect(`${redirect_uri}?state=${state}&code=${code}`);
};

export const handleToken = (req, res) => {
  const deviceId = db.authCodes[req.body.code];
  if (!deviceId) return res.status(400).json({ error: "invalid_code" });

  const accessToken = uuidv4();
  db.tokens[accessToken] = deviceId; // Токен привязан к зеркалу
  saveDB();

  // 👇 ГЛАВНАЯ МАГИЯ: Сообщаем зеркалу, что вход выполнен
  sendAuthSuccess(deviceId);

  res.json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 31536000,
  });
};

export const unlink = async (req, res) => {
  const requestId = req.headers["x-request-id"] || "no-id";
  console.log(`🔌 Yandex Unlink Request: ${requestId}`);

  res.status(200).json({
    request_id: requestId,
  });
};