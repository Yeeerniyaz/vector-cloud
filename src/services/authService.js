import db from './dbService.js';

export const checkAuth = async (req, res, next) => {
  // Логируем, кто стучится (для отладки)
  // console.log(`🛡️ [Auth] Проверка доступа для: ${req.originalUrl}`);
  
  const authHeader = req.headers.authorization;

  // 1. Проверяем заголовок
  if (!authHeader) {
    console.warn("⚠️ [Auth] Нет заголовка Authorization!");
    return res.status(401).send();
  }

  // 2. Достаем токен (формат "Bearer <token>")
  const token = authHeader.split(' ')[1];
  
  if (!token) {
      return res.status(401).send();
  }

  // 3. Ищем владельца токена в базе данных (SQL)
  // Раньше было: const deviceId = db.tokens[token];
  // Теперь:
  const userId = await db.getUserByToken(token);

  if (userId) {
    // Успех!
    // Мы сохраняем userId в запрос, чтобы следующие контроллеры знали, чей это запрос.
    req.userId = userId;
    next();
  } else {
    console.warn(`⛔ [Auth] Токен не найден или истек: ${token.substring(0, 5)}...`);
    return res.status(401).send();
  }
};