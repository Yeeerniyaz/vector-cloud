import express from 'express';
import * as authController from '../controllers/authController.js';
import * as deviceController from '../controllers/deviceController.js';
import { checkAuth } from '../services/authService.js';

const router = express.Router();

router.use((req, res, next) => {
    // Логируем только метод и URL, без тела (для скорости)
    console.log(`👀 [Traffic] ${req.method} ${req.originalUrl}`);
    next();
});

// --- AUTH & PAIR ---
router.get('/auth', authController.renderAuthPage);
router.post('/login', authController.handleLogin);
router.post('/token', authController.handleToken);
router.post('/pair', deviceController.requestPairCode);

// --- YANDEX SMART HOME ---
router.head('/v1.0', (req, res) => res.status(200).send('OK'));

// Все запросы теперь идут в контроллер, где им и место
router.get('/v1.0/user/devices', checkAuth, deviceController.getDevices);
router.post('/v1.0/user/devices/query', checkAuth, deviceController.queryDevices);
router.post('/v1.0/user/devices/action', checkAuth, deviceController.actionDevices);
router.post('/v1.0/user/unlink', authController.unlink);

export default router;