import express from 'express';
import * as authController from '../controllers/authController.js';
import * as deviceController from '../controllers/deviceController.js';
import { checkAuth } from '../services/authService.js';

const router = express.Router();

router.use((req, res, next) => {
    console.log(`👀 [Traffic] ${req.method} ${req.originalUrl}`);
    next();
});

// OAuth & Pair
router.get('/auth', authController.renderAuthPage);
router.post('/login', authController.handleLogin);
router.post('/token', authController.handleToken);
router.post('/pair', deviceController.requestPairCode);

router.head('/v1.0', (req, res) => res.status(200).send('OK'));

// 👇 ГЛАВНОЕ: Разбиваем зеркало на 4 устройства
router.get('/v1.0/user/devices', checkAuth, (req, res) => {
    console.log("🚀 [DIRECT] Отдаем список устройств (Зеркало + 3 Датчика)");

    const baseId = req.deviceId; // Например: "mirror-123"

    const response = {
        request_id: req.headers['x-request-id'],
        payload: {
            user_id: baseId,
            devices: [
                // 1. САМО ЗЕРКАЛО (Свет, Лента, Режимы)
                {
                    id: baseId, 
                    name: "Зеркало Вектор",
                    description: "Управление подсветкой",
                    type: "devices.types.light",
                    capabilities: [
                        { type: "devices.capabilities.on_off", retrievable: true, reportable: true },
                        { 
                            type: "devices.capabilities.range", 
                            retrievable: true, reportable: true,
                            parameters: { instance: "brightness", unit: "unit.percent", range: { min: 0, max: 100, precision: 1 } }
                        },
                        {
                            type: "devices.capabilities.color_setting",
                            retrievable: true, reportable: true,
                            parameters: { color_model: "hsv" }
                        },
                        {
                             type: "devices.capabilities.mode",
                             retrievable: true, reportable: true,
                             parameters: {
                                 instance: "program",
                                 modes: [
                                     { value: "one", name: "Радуга" },
                                     { value: "two", name: "Огонь" },
                                     { value: "three", name: "Полиция" },
                                     { value: "four", name: "Метеор" }
                                 ]
                             }
                        }
                    ],
                    properties: []
                },

                // 2. ДАТЧИК ТЕМПЕРАТУРЫ
                {
                    id: `${baseId}_temp`, // Уникальный ID: mirror-123_temp
                    name: "Температура в комнате",
                    type: "devices.types.sensor",
                    capabilities: [],
                    properties: [{
                        type: "devices.properties.float",
                        retrievable: true,
                        reportable: true,
                        parameters: { instance: "temperature", unit: "unit.temperature.celsius" }
                    }]
                },

                // 3. ДАТЧИК ВЛАЖНОСТИ
                {
                    id: `${baseId}_hum`,
                    name: "Влажность в комнате",
                    type: "devices.types.sensor",
                    capabilities: [],
                    properties: [{
                        type: "devices.properties.float",
                        retrievable: true,
                        reportable: true,
                        parameters: { instance: "humidity", unit: "unit.percent" }
                    }]
                },

                // 4. ДАТЧИК ВОЗДУХА (CO2)
                {
                    id: `${baseId}_co2`,
                    name: "Качество воздуха",
                    type: "devices.types.sensor",
                    capabilities: [],
                    properties: [{
                        type: "devices.properties.float",
                        retrievable: true,
                        reportable: true,
                        parameters: { instance: "co2_level", unit: "unit.ppm" }
                    }]
                }
            ]
        }
    };

    res.json(response);
});

// Управление и опрос состояния
router.post('/v1.0/user/devices/query', checkAuth, deviceController.queryDevices);
router.post('/v1.0/user/devices/action', checkAuth, deviceController.actionDevices);
router.post('/v1.0/user/unlink', authController.unlink);

export default router;