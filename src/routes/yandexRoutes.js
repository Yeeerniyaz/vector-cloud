import express from 'express';
import * as authController from '../controllers/authController.js';
import * as deviceController from '../controllers/deviceController.js';
import { checkAuth } from '../services/authService.js';

const router = express.Router();

// --- Middleware: Логируем трафик ---
router.use((req, res, next) => {
    // Не логируем тело запроса для чистоты консоли, только метод и путь
    console.log(`👀 [Yandex Traffic] ${req.method} ${req.originalUrl}`);
    next();
});

// --- 1. OAUTH 2.0 (Авторизация) ---

// Шаг А: Яндекс открывает страницу входа (HTML)
router.get('/auth', authController.renderAuthPage);

// Шаг Б: Пользователь вводит код сопряжения
router.post('/login', authController.handleLogin);

// Шаг В: Яндекс меняет временный код на вечный токен
router.post('/token', authController.handleToken);

// Заглушка для старого метода (на всякий случай)
router.post('/pair', deviceController.requestPairCode);


// --- 2. SMART HOME API (Управление) ---

// Ping (проверка связи от Яндекса)
router.head('/v1.0', (req, res) => res.status(200).send('OK'));

// Получить список устройств (Свет, Экран...)
// 🔒 Требует checkAuth
router.get('/v1.0/user/devices', checkAuth, deviceController.getDevices);

// Узнать состояние устройств (Включено/Выключено?)
// 🔒 Требует checkAuth
router.post('/v1.0/user/devices/query', checkAuth, deviceController.queryDevices);

// Выполнить действие (Включить свет, поменять цвет)
// 🔒 Требует checkAuth
router.post('/v1.0/user/devices/action', checkAuth, deviceController.actionDevices);

// Отвязать аккаунт (Удаление интеграции)
router.post('/v1.0/user/unlink', authController.unlink);

export default router;