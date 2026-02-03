import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/', dashboardController.showDashboard);
router.post('/login', dashboardController.handleLogin);
router.get('/logout', dashboardController.handleLogout);

export default router;