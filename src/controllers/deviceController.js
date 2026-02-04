import { db } from '../services/dbService.js';
import { io } from '../../index.js';

// --- 1. АЛИСА: ҚҰРЫЛҒЫЛАРДЫ ІЗДЕУ (Discovery) ---
export const getDevices = async (req, res) => {
    try {
        const userId = req.userId; // authService-тен келетін ID
        const devices = await db.getUserDevices(userId);

        console.log(`🔍 [Discovery] User: ${userId}, Devices in DB: ${devices.length}`);

        const yandexDevices = [];

        for (const d of devices) {
            const config = d.config || {};
            
            // Егер subDevices болса, оларды бөлек құрылғы қылып шығарамыз
            if (config.subDevices) {
                for (const [subKey, subDef] of Object.entries(config.subDevices)) {
                    
                    // Яндекске қажетті таза capabilities тізімі
                    const capabilities = (subDef.capabilities || []).map(cap => {
                        const base = {
                            type: cap.type,
                            retrievable: true,
                            reportable: true
                        };
                        
                        // Режимдер болса, оларды дұрыс форматтаймыз
                        if (cap.type === "devices.capabilities.mode" && cap.parameters) {
                            base.parameters = {
                                instance: cap.parameters.instance || "program",
                                modes: cap.parameters.modes.map(m => ({ value: m.value }))
                            };
                        }
                        
                        // Түс болса
                        if (cap.type === "devices.capabilities.color_setting") {
                            base.parameters = { color_model: "hsv" };
                        }

                        return base;
                    });

                    yandexDevices.push({
                        id: `${d.id}--${subKey}`, // mirror-xxx--led
                        name: `${d.name}${subDef.name_suffix || ''}`,
                        type: subDef.type,
                        capabilities: capabilities,
                        device_info: {
                            manufacturer: "Vector",
                            model: "Mirror Pro",
                            hw_version: "2.0"
                        }
                    });
                }
            }
        }

        console.log(`🚀 [Discovery] Sending ${yandexDevices.length} devices to Yandex`);

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
        // console.log("🔍 [Query] Start...");
        const userId = req.userId;
        const requestedIds = req.body.devices.map(d => d.id);
        const devices = [];

        const userDevices = await db.getUserDevices(userId);
        const deviceMap = {}; 
        userDevices.forEach(d => { deviceMap[d.id] = d; });

        for (const reqId of requestedIds) {
            const [realId, subKey] = reqId.split('--');
            const device = deviceMap[realId];

            if (!device || !device.is_online) {
                devices.push({ id: reqId, error_code: "DEVICE_OFFLINE" });
                continue;
            }

            const subState = (device.state || {})[subKey] || {};
            const capabilities = [];

            // 1. ON/OFF
            capabilities.push({
                type: "devices.capabilities.on_off",
                state: { instance: "on", value: subState.on || false }
            });

            // 2. ТҮС
            if (subKey === 'led') {
                 capabilities.push({
                    type: "devices.capabilities.color_setting",
                    state: { 
                        instance: "hsv", 
                        value: subState.color || { h: 0, s: 0, v: 100 } 
                    }
                });
            }

            // 3. РЕЖИМ
            if (subKey === 'led') {
                 capabilities.push({
                    type: "devices.capabilities.mode",
                    state: { 
                        instance: "program", 
                        value: subState.mode || "STATIC" 
                    }
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
        console.log("⚡ [Action] Command received!");
        const userId = req.userId;
        const payloadDevices = req.body.payload.devices;
        const results = [];

        for (const item of payloadDevices) {
            const [realId, subKey] = item.id.split('--');

            const updates = {};
            for (const cap of item.capabilities) {
                if (cap.type === "devices.capabilities.on_off") updates.on = cap.state.value;
                if (cap.type === "devices.capabilities.color_setting") updates.color = cap.state.value;
                if (cap.type === "devices.capabilities.mode") updates.mode = cap.state.value;
            }

            const stateUpdate = {};
            stateUpdate[subKey] = updates; 

            console.log(`📡 [Action] Sending to Socket ${realId}:`, stateUpdate);
            await db.updateDeviceState(realId, stateUpdate);
            io.to(realId).emit('command', stateUpdate);

            results.push({ 
                id: item.id, 
                capabilities: item.capabilities.map(c => ({ 
                    type: c.type, 
                    state: { instance: c.state.instance, action_result: { status: "DONE" } } 
                })) 
            });
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

// --- 4. КОД АЛУ ---
export const requestPairCode = async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) return res.status(400).json({ error: "No deviceId" });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await db.savePairingCode(deviceId, code);
        res.json({ success: true, code });
    } catch (e) { res.status(500).json({ error: "Error" }); }
};