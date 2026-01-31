import db, { saveDB } from '../services/dbService.js';
import { sendCommand } from '../services/mqttService.js';

// 👇 Генерация кода привязки
export const requestPairCode = (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "Device ID is required" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    db.pendingCodes[code] = deviceId;
    saveDB();

    console.log(`🔢 Code generated for [${deviceId}]: ${code}`);
    res.json({ code });
};

// 👇 ЗАПРОС СПИСКА УСТРОЙСТВ (С ЛОГАМИ)
export const getDevices = (req, res) => {
    const requestId = req.headers['x-request-id'];
    const deviceId = req.deviceId; // Этот ID должен прийти из authService.js

    console.log(`📡 [Yandex] Запрос устройств...`);
    console.log(`   👉 Request ID: ${requestId}`);
    console.log(`   👉 Device ID (из токена): ${deviceId || "ПУСТО! (ОШИБКА)"}`);

    if (!deviceId) {
        console.error("❌ ОШИБКА: authService не передал deviceId. Проверь authService.js!");
        // Даже если ID нет, вернем пустой список, чтобы Яндекс не ругался ошибкой 500
        return res.json({ request_id: requestId, payload: { user_id: "unknown", devices: [] } });
    }

    res.json({
        request_id: requestId,
        payload: {
            user_id: deviceId,
            devices: [{
                id: deviceId,
                name: "Зеркало Вектор",
                type: "devices.types.light",
                capabilities: [
                    { type: "devices.capabilities.on_off", retrievable: true, reportable: true }
                ],
                properties: [
                    { type: "devices.properties.float", instance: "temperature", unit: "unit.temperature.celsius", reportable: true },
                    { type: "devices.properties.float", instance: "humidity", unit: "unit.percent", reportable: true },
                    { type: "devices.properties.float", instance: "pressure", unit: "unit.pressure.mmhg", reportable: true },
                    { type: "devices.properties.float", instance: "co2_level", unit: "unit.ppm", reportable: true }
                ]
            }]
        }
    });
};

export const queryDevices = (req, res) => {
    const state = db.deviceStates[req.deviceId] || {};
    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            devices: [{
                id: req.deviceId,
                capabilities: [
                    { type: "devices.capabilities.on_off", state: { instance: "on", value: state.on || false } }
                ],
                properties: [
                    { type: "devices.properties.float", instance: "temperature", state: { value: state.temp || 0 } },
                    { type: "devices.properties.float", instance: "humidity", state: { value: state.hum || 0 } },
                    { type: "devices.properties.float", instance: "pressure", state: { value: state.press || 0 } },
                    { type: "devices.properties.float", instance: "co2_level", state: { value: state.co2 || 0 } }
                ]
            }]
        }
    });
};

export const actionDevices = (req, res) => {
    const device = req.body.payload.devices[0];
    const isOn = device.capabilities[0].state.value;
    
    if (!db.deviceStates[device.id]) db.deviceStates[device.id] = {};
    db.deviceStates[device.id].on = isOn;
    saveDB();
    
    sendCommand(device.id, isOn ? "ON" : "OFF");
    
    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            devices: [{
                id: device.id,
                capabilities: [{ type: "devices.capabilities.on_off", state: { instance: "on", action_result: { status: "DONE" } } }]
            }]
        }
    });
};