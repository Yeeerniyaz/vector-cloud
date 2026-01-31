import express from 'express';
import * as authController from '../controllers/authController.js';
import * as deviceController from '../controllers/deviceController.js';
import { checkAuth } from '../services/authService.js';

const router = express.Router();

// 1. Логируем абсолютно ВСЕ запросы, которые приходят на этот роутер
router.use((req, res, next) => {
    console.log(`👀 [Traffic] ${req.method} ${req.originalUrl}`);
    next();
});

// OAuth
router.get('/auth', authController.renderAuthPage);
router.post('/login', authController.handleLogin);
router.post('/token', authController.handleToken);

// Генерация кода (для зеркала)
router.post('/pair', deviceController.requestPairCode);

// 👇 ВАЖНО: HEAD запрос (Проверка доступности)
router.head('/v1.0', (req, res) => {
    console.log("🤖 [Yandex] HEAD Check (Ping) — OK");
    res.status(200).send('OK');
});

// Основные методы API
router.get('/v1.0/user/devices', checkAuth, deviceController.getDevices);
router.post('/v1.0/user/devices/query', checkAuth, deviceController.queryDevices);
router.post('/v1.0/user/devices/action', checkAuth, deviceController.actionDevices);

// Отвязка
router.post('/v1.0/user/unlink', authController.unlink);

export default router;