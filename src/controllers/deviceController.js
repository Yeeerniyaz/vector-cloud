import db, { saveDB } from '../services/dbService.js';
import { sendCommand } from '../services/mqttService.js';

// --- ГЕНЕРАЦИЯ КОДА ---
export const requestPairCode = (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "No DeviceID" });
    
    // Генерируем 6 цифр
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    db.pendingCodes[code] = deviceId;
    saveDB();
    
    res.json({ code });
};

// --- ВСПОМОГАТЕЛЬНАЯ: HSV -> RGB ---
function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    let c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// --- 1. СПИСОК УСТРОЙСТВ (GET DEVICES) ---
export const getDevices = (req, res) => {
    const baseId = req.deviceId; // ID конкретного зеркала (из токена)
    console.log(`📦 Формируем устройства для: ${baseId}`);

    // Отдаем массив из 4-х устройств для ЭТОГО пользователя
    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            user_id: baseId,
            devices: [
                // Главное устройство (Свет, Цвет, Режимы)
                {
                    id: baseId,
                    name: "Зеркало Вектор",
                    description: "Основное управление",
                    type: "devices.types.light",
                    capabilities: [
                        { type: "devices.capabilities.on_off", retrievable: true, reportable: true },
                        { type: "devices.capabilities.range", retrievable: true, reportable: true, parameters: { instance: "brightness", unit: "unit.percent", range: { min: 0, max: 100, precision: 1 } } },
                        { type: "devices.capabilities.color_setting", retrievable: true, reportable: true, parameters: { color_model: "hsv" } },
                        { type: "devices.capabilities.mode", retrievable: true, reportable: true, parameters: { instance: "program", modes: [
                            { value: "one", name: "Радуга" }, { value: "two", name: "Огонь" }, 
                            { value: "three", name: "Полиция" }, { value: "four", name: "Метеор" }
                        ]}}
                    ],
                    properties: []
                },
                // Датчик Температуры
                {
                    id: `${baseId}_temp`,
                    name: "Температура",
                    type: "devices.types.sensor",
                    capabilities: [],
                    properties: [{ type: "devices.properties.float", retrievable: true, reportable: true, parameters: { instance: "temperature", unit: "unit.temperature.celsius" } }]
                },
                // Датчик Влажности
                {
                    id: `${baseId}_hum`,
                    name: "Влажность",
                    type: "devices.types.sensor",
                    capabilities: [],
                    properties: [{ type: "devices.properties.float", retrievable: true, reportable: true, parameters: { instance: "humidity", unit: "unit.percent" } }]
                },
                // Датчик CO2
                {
                    id: `${baseId}_co2`,
                    name: "Воздух (CO2)",
                    type: "devices.types.sensor",
                    capabilities: [],
                    properties: [{ type: "devices.properties.float", retrievable: true, reportable: true, parameters: { instance: "co2_level", unit: "unit.ppm" } }]
                }
            ]
        }
    });
};

// --- 2. ОПРОС СОСТОЯНИЯ (QUERY) ---
export const queryDevices = (req, res) => {
    // Получаем состояние из базы по ГЛАВНОМУ ID
    const state = db.deviceStates[req.deviceId] || {};
    
    // Данные (если их нет, ставим дефолтные, чтобы не падало)
    const temp = state.temp || 24.5;
    const hum = state.hum || 45;
    const co2 = state.co2 || 420;

    const devicesStatus = req.body.devices.map(dev => {
        const id = dev.id;

        // Если это главное зеркало
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
        
        // Если это виртуальные датчики (проверяем по суффиксу)
        if (id.endsWith('_temp')) return { id, properties: [{ type: "devices.properties.float", state: { instance: "temperature", value: temp } }] };
        if (id.endsWith('_hum')) return { id, properties: [{ type: "devices.properties.float", state: { instance: "humidity", value: hum } }] };
        if (id.endsWith('_co2')) return { id, properties: [{ type: "devices.properties.float", state: { instance: "co2_level", value: co2 } }] };

        return { id, error_code: "DEVICE_UNREACHABLE" };
    });

    res.json({
        request_id: req.headers['x-request-id'],
        payload: { devices: devicesStatus }
    });
};

// --- 3. УПРАВЛЕНИЕ (ACTION) ---
export const actionDevices = (req, res) => {
    const payloadDevices = req.body.payload.devices;
    const results = [];

    payloadDevices.forEach(device => {
        // Отрезаем суффиксы, чтобы получить реальный ID для базы (mirror-123_temp -> mirror-123)
        const realId = device.id.split('_')[0];
        
        if (!db.deviceStates[realId]) db.deviceStates[realId] = {};
        const state = db.deviceStates[realId];
        const capsResult = [];

        device.capabilities.forEach(cap => {
            const val = cap.state.value;
            const instance = cap.state.instance;
            
            // Логика управления
            if (instance === 'on') {
                state.on = val;
                sendCommand(realId, val ? "ON" : "OFF");
            }
            if (instance === 'brightness') {
                state.brightness = val;
                // Можно добавить команду яркости: sendCommand(realId, `BRIGHT:${val}`);
            }
            if (instance === 'hsv') {
                state.hsv = val;
                const [r, g, b] = hsvToRgb(val.h, val.s, val.v);
                sendCommand(realId, `LED_COLOR:${r},${g},${b}`);
            }
            if (instance === 'program') {
                state.mode = val;
                let cmd = "STATIC";
                if (val === "one") cmd = "RAINBOW";
                if (val === "two") cmd = "FIRE";
                if (val === "three") cmd = "POLICE";
                if (val === "four") cmd = "METEOR";
                sendCommand(realId, `LED_MODE:${cmd}`);
            }

            capsResult.push({ type: cap.type, state: { instance: instance, action_result: { status: "DONE" } } });
        });

        results.push({ id: device.id, capabilities: capsResult });
    });

    saveDB();
    res.json({ request_id: req.headers['x-request-id'], payload: { devices: results } });
};