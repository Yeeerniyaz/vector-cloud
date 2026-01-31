import db from './dbService.js';

export const checkAuth = (req, res, next) => {
  // 1. Получаем заголовок авторизации
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn("⚠️ Auth header missing");
    return res.status(401).send();
  }

  // 2. Вытаскиваем токен (отрезаем "Bearer ")
  const token = authHeader.split(' ')[1];

  // 3. Ищем устройство по токену
  const deviceId = db.tokens[token];

  if (deviceId) {
    // ✅ ВАЖНО: Записываем ID, чтобы контроллер его увидел
    req.deviceId = deviceId;
    next();
  } else {
    console.warn(`⛔ Invalid token: ${token}`);
    return res.status(401).send();
  }
};