import db from './dbService.js';

export const checkAuth = (req, res, next) => {
  // 1. Получаем заголовок авторизации от Яндекса
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn("⚠️ Auth header missing");
    return res.status(401).send();
  }

  // 2. Вытаскиваем сам токен (убираем "Bearer ")
  const token = authHeader.split(' ')[1];

  // 3. Ищем в базе, какому устройству принадлежит этот токен
  // (Этот токен был сохранен как раз в authController.js)
  const deviceId = db.tokens[token];

  if (deviceId) {
    // ✅ Ура! Токен верный.
    // Сохраняем ID устройства в запрос, чтобы deviceController знал, кого отдавать
    req.deviceId = deviceId;
    next();
  } else {
    // ❌ Токен не найден (или старая база)
    console.warn(`⛔ Invalid token attempt: ${token}`);
    return res.status(401).send();
  }
};