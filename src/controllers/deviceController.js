import db, { saveDB } from '../services/dbService.js';
import { sendCommand } from '../services/mqttService.js';

// ... (requestPairCode и hsvToRgb оставляем без изменений) ...
// (Если нужно, могу прислать их снова, но они не менялись)

// --- QUERY (ЗАПРОС СОСТОЯНИЯ) ---
export const queryDevices = (req, res) => {
    // В запросе приходит массив устройств, которые Яндекс хочет опросить
    const requestedDevices = req.body.devices; 
    
    // Но мы знаем, что все они живут на одном зеркале (req.deviceId)
    const state = db.deviceStates[req.deviceId] || {};
    
    // Заглушки данных (в будущем сюда будем писать реальные данные из MQTT)
    const temp = state.temp || 24.5;
    const hum = state.hum || 45;
    const co2 = state.co2 || 420;

    const devicesStatus = requestedDevices.map(reqDev => {
        const id = reqDev.id;
        
        // 1. Основное зеркало
        if (id === req.deviceId) {
            return {
                id: id,
                capabilities: [
                    { type: "devices.capabilities.on_off", state: { instance: "on", value: state.on || false } },
                    { type: "devices.capabilities.range", state: { instance: "brightness", value: state.brightness || 100 } },
                    { type: "devices.capabilities.color_setting", state: { instance: "hsv", value: state.hsv || { h: 0, s: 0, v: 100 } } },
                    { type: "devices.capabilities.mode", state: { instance: "program", value: state.mode || "one" } }
                ]
            };
        }

        // 2. Датчик Температуры
        if (id.endsWith('_temp')) {
            return {
                id: id,
                properties: [{ type: "devices.properties.float", state: { instance: "temperature", value: temp } }]
            };
        }

        // 3. Датчик Влажности
        if (id.endsWith('_hum')) {
            return {
                id: id,
                properties: [{ type: "devices.properties.float", state: { instance: "humidity", value: hum } }]
            };
        }

        // 4. Датчик CO2
        if (id.endsWith('_co2')) {
            return {
                id: id,
                properties: [{ type: "devices.properties.float", state: { instance: "co2_level", value: co2 } }]
            };
        }
        
        return { id: id, error_code: "DEVICE_UNREACHABLE" };
    });

    res.json({
        request_id: req.headers['x-request-id'],
        payload: { devices: devicesStatus }
    });
};

// --- ACTION (УПРАВЛЕНИЕ) ---
// Управляем только основным зеркалом, датчики управлять нельзя
export const actionDevices = (req, res) => {
    // ... (старый код actionDevices подойдет, так как он работает только с capabilities, а у датчиков их нет)
    // Но для надежности лучше убедиться, что управляем основным ID:
    
    const device = req.body.payload.devices[0];
    const realId = device.id.split('_')[0]; // На всякий случай отрезаем суффиксы, если вдруг придут
    
    // Далее логика управления светом (как было раньше)
    const results = [];
    if (!db.deviceStates[realId]) db.deviceStates[realId] = {};
    const state = db.deviceStates[realId];

    device.capabilities.forEach(cap => {
         // ... (сюда вставь ту же логику on/off/color/mode из прошлого ответа) ...
         // Для краткости не дублирую, если нужно - скажи.
    });
    
    // ... (сохранение и ответ) ...
    // ВАЖНО: В ответе возвращаем id именно тот, который пришел в запросе (device.id), а не realId.
};