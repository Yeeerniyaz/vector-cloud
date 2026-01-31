import db, { saveDB } from '../services/dbService.js';
import { sendCommand } from '../services/mqttService.js';

// --- ГЕНЕРАЦИЯ КОДА (PAIR) ---
export const requestPairCode = (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "Device ID is required" });

    // Генерируем код
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    db.pendingCodes[code] = deviceId;
    saveDB();

    console.log(`🔢 Code generated for [${deviceId}]: ${code}`);
    res.json({ code });
};

// --- ПОЛУЧЕНИЕ СПИСКА УСТРОЙСТВ ---
export const getDevices = (req, res) => {
    // 1. Читаем ID запроса и устройства
    const requestId = req.headers['x-request-id'];
    const deviceId = req.deviceId; 

    console.log(`📡 [Yandex] ЗАПРОС УСТРОЙСТВ ПРИШЕЛ!`);
    console.log(`   👉 Request ID: ${requestId}`);
    console.log(`   👉 Device ID: ${deviceId}`);

    if (!deviceId) {
        console.error("❌ ОШИБКА: Device ID пустой! Яндекс не увидит устройство.");
        return res.status(200).json({ request_id: requestId, payload: { user_id: "unknown", devices: [] } });
    }

    // 2. Формируем ответ (Упрощенный, чтобы точно сработал)
    const response = {
        request_id: requestId,
        payload: {
            user_id: deviceId,
            devices: [{
                id: deviceId,
                name: "Зеркало Вектор",
                type: "devices.types.light", // Прикидываемся лампочкой (самый надежный тип)
                capabilities: [
                    { 
                        type: "devices.capabilities.on_off", 
                        retrievable: true, 
                        reportable: true 
                    }
                ],
                properties: [] // Пока без датчиков, чтобы исключить ошибки
            }]
        }
    };

    console.log("   📤 Отправляем ответ Яндексу:", JSON.stringify(response));
    res.json(response);
};

// --- СТАТУС (QUERY) ---
export const queryDevices = (req, res) => {
    const state = db.deviceStates[req.deviceId] || {};
    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            devices: [{
                id: req.deviceId,
                capabilities: [
                    { type: "devices.capabilities.on_off", state: { instance: "on", value: state.on || false } }
                ]
            }]
        }
    });
};

// --- УПРАВЛЕНИЕ (ACTION) ---
export const actionDevices = (req, res) => {
    const device = req.body.payload.devices[0];
    const isOn = device.capabilities[0].state.value;
    
    // Сохраняем и шлем в MQTT
    if (!db.deviceStates[device.id]) db.deviceStates[device.id] = {};
    db.deviceStates[device.id].on = isOn;
    saveDB();
    
    console.log(`⚡ [Action] ${device.id} -> ${isOn ? 'ON' : 'OFF'}`);
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