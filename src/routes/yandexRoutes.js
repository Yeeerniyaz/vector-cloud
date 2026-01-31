import express from 'express';
import * as authController from '../controllers/authController.js';
import * as deviceController from '../controllers/deviceController.js';
import { checkAuth } from '../services/authService.js';

const router = express.Router();

// OAuth маршруты для связки аккаунтов
router.get('/auth', authController.renderAuthPage);
router.post('/login', authController.handleLogin);
router.post('/token', authController.handleToken);

// Smart Home API эндпоинты
// (Важно: Yandex проверяет доступность корня v1.0 HEAD-запросом)
router.head('/v1.0', (req, res) => res.status(200).send('OK'));

// Основные методы API
router.get('/v1.0/user/devices', checkAuth, deviceController.getDevices);
router.post('/v1.0/user/devices/query', checkAuth, deviceController.queryDevices);
router.post('/v1.0/user/devices/action', checkAuth, deviceController.actionDevices);

// 👇 ВОТ ЭТОГО НЕ ХВАТАЛО (Отвязка аккаунта)
// Яндекс отправляет сюда POST запрос, когда ты нажимаешь "Отвязать" или при проверке
router.post('/v1.0/user/unlink', authController.unlink); 

export default router;