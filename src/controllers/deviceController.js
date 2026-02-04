import { db } from '../services/dbService.js';
import { io } from '../../index.js';

// --- 1. АЛИСА: ҚҰРЫЛҒЫЛАРДЫ ІЗДЕУ (Discovery) ---
export const getDevices = async (req, res) => {
    try {
        const userId = req.user.userId; // authMiddleware арқылы келеді
        const devices = await db.getUserDevices(userId);

        const yandexDevices = [];

        for (const d of devices) {
            const config = d.config || {};
            
            // А) Егер 'subDevices' болса (Жаңа режим) -> Екі бөлек құрылғы жасаймыз
            if (config.subDevices) {
                for (const [subKey, subDef] of Object.entries(config.subDevices)) {
                    yandexDevices.push({
                        id: `${d.id}--${subKey}`, // Виртуалды ID: mirror-xxx--led
                        name: `${d.name}${subDef.name_suffix || ''}`,
                        description: d.room,
                        room: d.room,
                        type: subDef.type,
                        capabilities: subDef.capabilities || [],
                        properties: subDef.properties || [],
                        device_info: {
                            manufacturer: "Vector",
                            model: "Mirror Pro",
                            hw_version: "2.0",
                            sw_version: "1.0"
                        }
                    });
                }
            } 
            // Ә) Ескі режим (SubDevices жоқ болса)
            else {
                yandexDevices.push({
                    id: d.id,
                    name: d.name,
                    room: d.room,
                    type: "devices.types.other",
                    capabilities: [],
                    properties: []
                });
            }
        }

        res.json({
            request_id: req.headers['x-request-id'],
            payload: {
                user_id: userId,
                devices: yandexDevices
            }
        });

    } catch (e) {
        console.error("❌ getDevices Error:", e);
        res.status(500).json({ error: "Internal Error" });
    }
};

// --- 2. АЛИСА: СТАТУС СҰРАУ (Query) ---
export const queryDevices = async (req, res) => {
    try {
        const userId = req.user.userId;
        const requestedIds = req.body.devices.map(d => d.id);
        const devices = [];

        // Базадан нақты құрылғыларды аламыз
        const userDevices = await db.getUserDevices(userId);
        const deviceMap = {}; 
        userDevices.forEach(d => { deviceMap[d.id] = d; });

        for (const reqId of requestedIds) {
            // ID-ні талдаймыз (mirror-xxx--led -> [mirror-xxx, led])
            const [realId, subKey] = reqId.split('--');
            const device = deviceMap[realId];

            if (!device || !device.is_online) {
                devices.push({ id: reqId, error_code: "DEVICE_OFFLINE" });
                continue;
            }

            // subKey бойынша статусты сүземіз
            // led үшін -> state.led, screen үшін -> state.screen
            const subState = (device.state || {})[subKey] || {};
            const capabilities = [];

            // ON/OFF
            if (typeof subState.on !== 'undefined') {
                capabilities.push({
                    type: "devices.capabilities.on_off",
                    state: { instance: "on", value: subState.on }
                });
            }

            // COLOR (Тек LED үшін)
            if (subKey === 'led' && subState.color) { // color: {h,s,v}
                 capabilities.push({
                    type: "devices.capabilities.color_setting",
                    state: { instance: "hsv", value: subState.color }
                });
            }

            // MODE (Тек LED үшін)
            if (subKey === 'led' && subState.mode) {
                 capabilities.push({
                    type: "devices.capabilities.mode",
                    state: { instance: "program", value: subState.mode }
                });
            }

            devices.push({ id: reqId, capabilities });
        }

        res.json({
            request_id: req.headers['x-request-id'],
            payload: { devices }
        });

    } catch (e) {
        console.error("❌ queryDevices Error:", e);
        res.status(500).json({ error: "Internal Error" });
    }
};

// --- 3. АЛИСА: КОМАНДА БЕРУ (Action) ---
export const actionDevices = async (req, res) => {
    try {
        const userId = req.user.userId;
        const payloadDevices = req.body.payload.devices;
        const results = [];

        for (const item of payloadDevices) {
            const [realId, subKey] = item.id.split('--'); // ID бөлу

            // Командаларды жинаймыз
            const updates = {};
            
            for (const cap of item.capabilities) {
                if (cap.type === "devices.capabilities.on_off") {
                    updates.on = cap.state.value;
                }
                if (cap.type === "devices.capabilities.color_setting") {
                    if (cap.state.instance === 'hsv') updates.color = cap.state.value; // {h,s,v}
                    // Яндекс кейде RGB жібереді, конвертация керек болса осында қосамыз
                }
                if (cap.type === "devices.capabilities.mode") {
                    updates.mode = cap.state.value;
                }
            }

            // Базаға жазамыз: state = { "led": { ...updates } }
            // JSONB update (smart merge)
            // Бұл жерде dbService updateDeviceState логикасы subKey қолдау керек
            // Бірақ біз оңай жолын жасаймыз: state объектісін құрап жібереміз
            
            const stateUpdate = {};
            stateUpdate[subKey] = updates; // { led: { on: true, mode: 'FIRE' } }

            await db.updateDeviceState(realId, stateUpdate);

            // АЙНАҒА ЖІБЕРУ (Socket)
            // React-тағы useHardwareBridge осы форматты күтеді: { led: {...} }
            io.to(realId).emit('command', stateUpdate);

            results.push({ id: item.id, capabilities: item.capabilities.map(c => ({ type: c.type, state: { instance: c.state.instance, action_result: { status: "DONE" } } })) });
        }

        res.json({
            request_id: req.headers['x-request-id'],
            payload: { devices: results }
        });

    } catch (e) {
        console.error("❌ actionDevices Error:", e);
        res.status(500).json({ error: "Internal Error" });
    }
};

// --- 4. КОД АЛУ (PAIRING) ---
export const requestPairCode = async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) return res.status(400).json({ error: "No deviceId" });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await db.savePairingCode(deviceId, code);
        
        console.log(`🔢 Code for ${deviceId}: ${code}`);
        res.json({ success: true, code });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error" });
    }
};