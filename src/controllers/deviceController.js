import db, { saveDB } from '../services/dbService.js';
import { sendCommand } from '../services/mqttService.js';

// 👇 НОВАЯ ФУНКЦИЯ: Генерация кода привязки
// Зеркало вызывает её, чтобы показать цифры на экране
export const requestPairCode = (req, res) => {
    const { deviceId } = req.body;
    
    if (!deviceId) {
        return res.status(400).json({ error: "Device ID is required" });
    }

    // Генерируем 6-значный код (от 100000 до 999999)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Сохраняем связь "Код -> DeviceID" в базу
    // Теперь, если ввести этот код на сайте, сервер поймет, о каком зеркале речь
    db.pendingCodes[code] = deviceId;
    saveDB();

    console.log(`🔢 Code generated for [${deviceId}]: ${code}`);

    // Отдаем код зеркалу
    res.json({ code });
};

// --- Стандартные функции Яндекс УД (без изменений) ---

export const getDevices = (req, res) => {
    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            user_id: req.deviceId,
            devices: [{
                id: req.deviceId,
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
    
    // Сохраняем состояние экрана/подсветки
    if (!db.deviceStates[device.id]) db.deviceStates[device.id] = {};
    db.deviceStates[device.id].on = isOn;
    saveDB();
    
    // Отправляем команду в MQTT (на RPi она погасит дисплей и WS2812B)
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