import db from './dbService.js';

export const checkAuth = (req, res, next) => {
  console.log(`🛡️ [Auth] Проверка доступа для: ${req.originalUrl}`);
  
  const authHeader = req.headers.authorization;

  // 1. Проверяем заголовок
  if (!authHeader) {
    console.warn("⚠️ [Auth] Нет заголовка Authorization!");
    return res.status(401).send();
  }

  // 2. Достаем токен
  const token = authHeader.split(' ')[1];
  console.log(`   🔑 Токен от Яндекса: ${token ? token.substring(0, 5) + "..." : "PUSTO"}`);

  // 3. Ищем в базе
  const deviceId = db.tokens[token];

  if (deviceId) {
    console.log(`   ✅ Токен принят! Устройство: ${deviceId}`);
    req.deviceId = deviceId;
    next();
  } else {
    console.warn(`   ⛔ [Auth] Токен не найден в базе! (База знает ${Object.keys(db.tokens).length} токенов)`);
    console.log("   📜 Дамп базы токенов (DEBUG):", JSON.stringify(db.tokens));
    return res.status(401).send();
  }
};