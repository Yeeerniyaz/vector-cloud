import express from 'express';
import { checkAuth } from '../services/authService.js';
import * as apiController from '../controllers/apiController.js';

const router = express.Router();

// Барлық API сұраулары токенді талап етеді
router.use(checkAuth);

// GET /api/devices - Құрылғылар тізімі
router.get('/devices', apiController.getMyDevices);

// POST /api/device/:id - Басқару (ID = айнаның UUID-ы)
router.post('/device/:id', apiController.controlDevice);

export default router;