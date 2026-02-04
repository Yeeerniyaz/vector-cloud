import { db } from '../services/dbService.js';
import { io } from '../../index.js';

/**
 * 1. DISCOVERY: Алиса құрылғыларды іздегенде жауап береді
 */
export const getDevices = async (req, res) => {
    try {
        const userId = req.userId; // authService-тен келетін ID
        const devices = await db.getUserDevices(userId);

        console.log(`🔍 [Discovery] User: ${userId}, Devices in DB: ${devices.length}`);

        const yandexDevices = [];

        for (const d of devices) {
            const config = d.config || {};
            
            // Егер subDevices болса (LED және Screen бөлек болса)
            if (config.subDevices) {
                console.log(`✨ [Discovery] Splitting device ${d.id} into sub-devices...`);
                
                for (const [subKey, subDef] of Object.entries(config.subDevices)) {
                    
                    // Яндекске қажетті мүмкіндіктер (capabilities) тізімін форматтау
                    const capabilities = (subDef.capabilities || []).map(cap => {
                        const base = {
                            type: cap.type,
                            retrievable: true,
                            reportable: true
                        };
                        
                        // Режимдер болса (Program mode)
                        if (cap.type === "devices.capabilities.mode" && cap.parameters) {
                            base.parameters = {
                                instance: cap.parameters.instance || "program",
                                modes: cap.parameters.modes.map(m => ({ value: m.value }))
                            };
                        }
                        
                        // Түс параметрлері (HSV моделі)
                        if (cap.type === "devices.capabilities.color_setting") {
                            base.parameters = { color_model: "hsv" };
                        }

                        return base;
                    });

                    yandexDevices.push({
                        id: `${d.id}--${subKey}`, // Виртуалды ID жасаймыз: mirror-xxx--led
                        name: `${d.name}${subDef.name_suffix || ''}`,
                        type: subDef.type,
                        capabilities: capabilities,
                        device_info: {
                            manufacturer: "Vector",
                            model: "Mirror Pro",
                            hw_version: "2.0",
                            sw_version: "1.0"
                        }
                    });
                }
            }
        }

        console.log(`🚀 [Discovery] Sending ${yandexDevices.length} virtual devices to Yandex`);

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

/**
 * 2. QUERY: Алиса құрылғының күйін (статусын) сұрағанда
 */
export const queryDevices = async (req, res) => {
    try {
        const userId = req.userId;
        const requestedIds = req.body.devices.map(d => d.id);
        const results = [];

        const userDevices = await db.getUserDevices(userId);
        const deviceMap = {};
        userDevices.forEach(d => { deviceMap[d.id] = d; });

        for (const reqId of requestedIds) {
            const [realId, subKey] = reqId.split('--');
            const device = deviceMap[realId];

            if (!device || !device.is_online) {
                results.push({ id: reqId, error_code: "DEVICE_OFFLINE" });
                continue;
            }

            // Құрылғының ішкі статусын аламыз (state.led немесе state.screen)
            const subState = (device.state || {})[subKey] || {};
            const capabilities = [];

            // Қосу/Өшіру статусы (Default: false)
            capabilities.push({
                type: "devices.capabilities.on_off",
                state: { instance: "on", value: subState.on || false }
            });

            // LED үшін түс және режим статустары
            if (subKey === 'led') {
                if (subState.color) {
                    capabilities.push({
                        type: "devices.capabilities.color_setting",
                        state: { instance: "hsv", value: subState.color }
                    });
                }
                if (subState.mode) {
                    capabilities.push({
                        type: "devices.capabilities.mode",
                        state: { instance: "program", value: subState.mode }
                    });
                }
            }

            results.push({ id: reqId, capabilities });
        }

        res.json({
            request_id: req.headers['x-request-id'],
            payload: { devices: results }
        });
    } catch (e) {
        console.error("❌ queryDevices Error:", e);
        res.status(500).json({ error: "Internal Error" });
    }
};

/**
 * 3. ACTION: Алиса команда бергенде (Жарықты жақ, түсін өзгерт т.б.)
 */
export const actionDevices = async (req, res) => {
    try {
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
            stateUpdate[subKey] = updates; // Мысалы: { led: { mode: 'FIRE' } }

            console.log(`📡 [Action] Sending to Mirror ${realId}:`, stateUpdate);
            
            // Базаны жаңарту және Socket арқылы айнаға команда жіберу
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

/**
 * 4. PAIRING: Айнаны тіркеу коды
 */
export const requestPairCode = async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) return res.status(400).json({ error: "No deviceId" });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await db.savePairingCode(deviceId, code);
        
        console.log(`🔢 Code for ${deviceId}: ${code}`);
        res.json({ success: true, code });
    } catch (e) {
        console.error("❌ Pair Error:", e);
        res.status(500).json({ error: "Error" });
    }
};