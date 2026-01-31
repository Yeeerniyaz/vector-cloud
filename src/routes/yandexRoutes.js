import express from 'express';
import * as authController from '../controllers/authController.js';
import * as deviceController from '../controllers/deviceController.js';
import { checkAuth } from '../services/authService.js';

const router = express.Router();

// OAuth маршруты для связки аккаунтов (для Яндекса)
router.get('/auth', authController.renderAuthPage);
router.post('/login', authController.handleLogin);
router.post('/token', authController.handleToken);

// 👇 НОВЫЙ МАРШРУТ: Генерация кода (для Зеркала)
// Зеркало стучится сюда, чтобы получить цифры "123 456"
router.post('/pair', deviceController.requestPairCode); 

// Smart Home API эндпоинты
// (Важно: Yandex проверяет доступность корня v1.0 HEAD-запросом)
router.head('/v1.0', (req, res) => res.status(200).send('OK'));

// Основные методы API (Только для авторизованных)
router.get('/v1.0/user/devices', checkAuth, deviceController.getDevices);
router.post('/v1.0/user/devices/query', checkAuth, deviceController.queryDevices);
router.post('/v1.0/user/devices/action', checkAuth, deviceController.actionDevices);

// Отвязка аккаунта
router.post('/v1.0/user/unlink', authController.unlink); 

export default router;