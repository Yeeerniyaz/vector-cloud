import db from '../services/dbService.js';
import { io } from '../../index.js';

// --- HELPER: State Mapping ---
// Айнаның state-ін Яндекс түсінетін форматқа аудару
const mapStateToCapability = (subState, type, instance) => {
    // Егер state болмаса, дефолт мәндер
    const s = subState || {};
    
    if (type === 'devices.capabilities.on_off') 
        return { instance: 'on', value: s.on || false };
        
    if (type === 'devices.capabilities.color_setting') 
        return { instance: 'hsv', value: s.color || { h: 0, s: 0, v: 100 } };
        
    if (type === 'devices.capabilities.mode') 
        return { instance: 'program', value: s.mode || 'static' };

    return null;
};

// --- 1. GET DEVICES (Сплиттер) ---
export const getDevices = async (req, res) => {
    const userId = req.userId;
    const devices = await db.getUserDevices(userId);

    const yandexDevices = [];

    devices.forEach(d => {
        const modelConfig = d.config || {};
        const subDevices = modelConfig.subDevices || {};

        // Әрбір ішкі құрылғыны (led, screen) жеке девайс қылып тізімге қосамыз
        for (const [subKey, subConfig] of Object.entries(subDevices)) {
            yandexDevices.push({
                // ID құрылымы: "physicalUUID_subKey" (мысалы: "550e8400..._led")
                id: `${d.id}_${subKey}`,
                name: d.name + (subConfig.name_suffix || ""),
                description: d.room,
                room: d.room,
                type: subConfig.type,
                capabilities: subConfig.capabilities,
                properties: [],
                device_info: {
                    manufacturer: "VECTOR",
                    model: modelConfig.name,
                    hw_version: "1.0",
                    sw_version: "5.0"
                }
            });
        }
    });

    res.json({ 
        request_id: req.headers['x-request-id'], 
        payload: { user_id: userId, devices: yandexDevices } 
    });
};

// --- 2. QUERY (Статус сұрау) ---
export const queryDevices = async (req, res) => {
    const { devices } = req.body;
    const userId = req.userId;
    const userDevices = await db.getUserDevices(userId);

    const result = devices.map(reqDev => {
        // ID-ді талдаймыз: "uuid_led" -> ["uuid", "led"]
        const [realId, subKey] = reqDev.id.split('_');
        
        const dbDev = userDevices.find(d => d.id === realId);
        if (!dbDev) return { id: reqDev.id, error_code: "DEVICE_NOT_FOUND" };

        const config = dbDev.config || {};
        const subConfig = config.subDevices?.[subKey];
        if (!subConfig) return { id: reqDev.id, error_code: "DEVICE_NOT_FOUND" };

        // State-тен тек керекті бөлікті аламыз (мысалы: state.led)
        const fullState = dbDev.state || {};
        const subState = fullState[subKey] || {}; // { on: true, color: ... }

        const caps = [];
        
        subConfig.capabilities.forEach(cap => {
            const mapped = mapStateToCapability(subState, cap.type, cap.parameters?.instance);
            if (mapped) {
                caps.push({ type: cap.type, state: mapped });
            }
        });

        return { id: reqDev.id, capabilities: caps, properties: [] };
    });

    res.json({ request_id: req.headers['x-request-id'], payload: { devices: result } });
};

// --- 3. ACTION (Команда беру) ---
export const actionDevices = async (req, res) => {
    const { payload } = req.body;
    const results = [];

    for (const dev of payload.devices) {
        const [realId, subKey] = dev.id.split('_');
        
        // 1. Команданы жинау
        const changes = {};
        dev.capabilities.forEach(cap => {
            if (cap.type === 'devices.capabilities.on_off') changes.on = cap.state.value;
            if (cap.type === 'devices.capabilities.color_setting') changes.color = cap.state.value;
            if (cap.type === 'devices.capabilities.mode') changes.mode = cap.state.value;
        });

        // 2. Socket Packet құру
        // Айнаға мынадай JSON барады: { "led": { "on": true, "color": {...} } }
        const socketPayload = {
            [subKey]: changes
        };

        // 3. Айнаға жіберу
        io.to(realId).emit('command', socketPayload);
        
        // 4. Базаны жаңарту (Optimistic)
        // Ескерту: Бұл жерде біз тек өзгерген бөлігін merge жасаймыз
        await db.updateDeviceState(realId, JSON.stringify(socketPayload));

        results.push({ 
            id: dev.id, 
            capabilities: dev.capabilities.map(c => ({
                type: c.type, 
                state: { instance: c.state.instance, action_result: { status: "DONE" } }
            })) 
        });
    }

    res.json({ request_id: req.headers['x-request-id'], payload: { devices: results } });
};

// --- 4. PAIRING (Өзгеріссіз) ---
export const pairDevice = async (req, res) => {
    const { code } = req.body;
    const userId = req.userId;
    const deviceId = await db.linkDeviceToUser(code, userId);
    
    if (deviceId) {
        io.to(deviceId).emit('paired_success', { userId });
        res.json({ success: true, deviceId });
    } else {
        res.status(400).json({ success: false, message: "Invalid code" });
    }
};