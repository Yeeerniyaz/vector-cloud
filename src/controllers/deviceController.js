import db, { saveDB } from '../services/dbService.js';
import { sendCommand } from '../services/mqttService.js';

// --- ГЕНЕРАЦИЯ КОДА ---
export const requestPairCode = (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "No DeviceID" });
    
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
    const baseId = req.deviceId; 
    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            user_id: baseId,
            devices: [
                {
                    id: baseId,
                    name: "Зеркало Вектор",
                    type: "devices.types.light",
                    capabilities: [
                        { type: "devices.capabilities.on_off", retrievable: true, reportable: true },
                        { type: "devices.capabilities.range", retrievable: true, reportable: true, parameters: { instance: "brightness", unit: "unit.percent", range: { min: 0, max: 100, precision: 1 } } },
                        { type: "devices.capabilities.color_setting", retrievable: true, reportable: true, parameters: { color_model: "hsv" } },
                        { type: "devices.capabilities.mode", retrievable: true, reportable: true, parameters: { instance: "program", modes: [
                            { value: "one", name: "Радуга" }, { value: "two", name: "Огонь" }, 
                            { value: "three", name: "Полиция" }, { value: "four", name: "Метеор" }
                        ]}}
                    ]
                },
                {
                    id: `${baseId}_temp`,
                    name: "Температура",
                    type: "devices.types.sensor",
                    properties: [{ type: "devices.properties.float", retrievable: true, reportable: true, parameters: { instance: "temperature", unit: "unit.temperature.celsius" } }]
                },
                {
                    id: `${baseId}_hum`,
                    name: "Влажность",
                    type: "devices.types.sensor",
                    properties: [{ type: "devices.properties.float", retrievable: true, reportable: true, parameters: { instance: "humidity", unit: "unit.percent" } }]
                },
                {
                    id: `${baseId}_co2`,
                    name: "Качество воздуха",
                    type: "devices.types.sensor",
                    properties: [{ type: "devices.properties.float", retrievable: true, reportable: true, parameters: { instance: "co2_level", unit: "unit.ppm" } }]
                }
            ]
        }
    });
};

// --- 2. ОПРОС СОСТОЯНИЯ (QUERY) — БЕЗ ЗАГЛУШЕК ---
export const queryDevices = (req, res) => {
    const state = db.deviceStates[req.deviceId]; // Данные из MQTT хранятся тут

    const devicesStatus = req.body.devices.map(dev => {
        const id = dev.id;

        // Если данных в базе нет, устройство оффлайн для Яндекса
        if (!state) return { id, error_code: "DEVICE_UNREACHABLE" };

        if (id === req.deviceId) {
            return {
                id,
                capabilities: [
                    { type: "devices.capabilities.on_off", state: { instance: "on", value: state.on ?? false } },
                    { type: "devices.capabilities.range", state: { instance: "brightness", value: state.brightness ?? 100 } },
                    { type: "devices.capabilities.color_setting", state: { instance: "hsv", value: state.hsv ?? { h: 0, s: 0, v: 100 } } },
                    { type: "devices.capabilities.mode", state: { instance: "program", value: state.mode ?? "one" } }
                ]
            };
        }
        
        // Реальные датчики: если значения undefined, возвращаем ошибку, а не заглушку 24.5
        if (id.endsWith('_temp')) {
            return state.temp !== undefined 
                ? { id, properties: [{ type: "devices.properties.float", state: { instance: "temperature", value: state.temp } }] }
                : { id, error_code: "DEVICE_UNREACHABLE" };
        }
        if (id.endsWith('_hum')) {
            return state.hum !== undefined 
                ? { id, properties: [{ type: "devices.properties.float", state: { instance: "humidity", value: state.hum } }] }
                : { id, error_code: "DEVICE_UNREACHABLE" };
        }
        if (id.endsWith('_co2')) {
            return state.co2 !== undefined 
                ? { id, properties: [{ type: "devices.properties.float", state: { instance: "co2_level", value: state.co2 } }] }
                : { id, error_code: "DEVICE_UNREACHABLE" };
        }

        return { id, error_code: "DEVICE_NOT_FOUND" };
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
        const realId = device.id.split('_')[0];
        if (!db.deviceStates[realId]) db.deviceStates[realId] = {};
        const state = db.deviceStates[realId];
        const capsResult = [];

        device.capabilities.forEach(cap => {
            const val = cap.state.value;
            const instance = cap.state.instance;
            
            if (instance === 'on') {
                state.on = val;
                sendCommand(realId, val ? "ON" : "OFF");
            }
            if (instance === 'brightness') {
                state.brightness = val;
                sendCommand(realId, `BRIGHTNESS:${val}`);
            }
            if (instance === 'hsv') {
                state.hsv = val;
                const [r, g, b] = hsvToRgb(val.h, val.s, val.v);
                sendCommand(realId, `LED_COLOR:${r},${g},${b}`);
            }
            if (instance === 'program') {
                state.mode = val;
                const modes = { one: "RAINBOW", two: "FIRE", three: "POLICE", four: "METEOR" };
                sendCommand(realId, `LED_MODE:${modes[val] || "STATIC"}`);
            }

            capsResult.push({ type: cap.type, state: { instance: instance, action_result: { status: "DONE" } } });
        });

        results.push({ id: device.id, capabilities: capsResult });
    });

    saveDB();
    res.json({ request_id: req.headers['x-request-id'], payload: { devices: results } });
};