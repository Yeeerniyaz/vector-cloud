import db from '../services/dbService.js';
import { io } from '../../index.js';

// --- HELPER: State Mapping ---
// Переводим состояние из базы (нашего формата) в формат Яндекса
const mapStateToCapability = (subState, type, instance) => {
    // subState - это часть стейта, например state.led
    const s = subState || {};
    
    if (type === 'devices.capabilities.on_off') 
        return { instance: 'on', value: s.on || false };
        
    if (type === 'devices.capabilities.color_setting') 
        return { instance: 'hsv', value: s.color || { h: 0, s: 0, v: 100 } };
        
    if (type === 'devices.capabilities.mode') 
        return { instance: 'program', value: s.mode || 'static' };

    if (type === 'devices.capabilities.range' && instance === 'brightness')
        return { instance: 'brightness', value: s.brightness || 0 };

    return null;
};

// --- 1. GET DEVICES (Список устройств) ---
export const getDevices = async (req, res) => {
    try {
        const userId = req.userId; // Получаем ID из middleware
        const devices = await db.getUserDevices(userId);

        const yandexDevices = [];

        devices.forEach(d => {
            const modelConfig = d.config || {};
            const subDevices = modelConfig.subDevices || {};

            // Разбиваем одно физическое зеркало на логические устройства (Свет, Экран)
            for (const [subKey, subConfig] of Object.entries(subDevices)) {
                yandexDevices.push({
                    // Уникальный ID: "UUID_led" или "UUID_screen"
                    id: `${d.id}_${subKey}`,
                    name: d.name + (subConfig.name_suffix || ""),
                    description: d.room,
                    room: d.room,
                    type: subConfig.type,
                    capabilities: subConfig.capabilities,
                    properties: [], // Сюда можно добавить датчики (температура, влажность)
                    device_info: {
                        manufacturer: "VECTOR",
                        model: modelConfig.name || "Smart Mirror",
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
    } catch (e) {
        console.error("❌ Error in getDevices:", e);
        res.status(500).json({ request_id: req.headers['x-request-id'], payload: { error: "INTERNAL_ERROR" } });
    }
};

// --- 2. QUERY (Запрос статуса) ---
export const queryDevices = async (req, res) => {
    try {
        const { devices } = req.body;
        const userId = req.userId;
        const userDevices = await db.getUserDevices(userId);

        const result = devices.map(reqDev => {
            // Разбираем ID: "UUID_led" -> realId="UUID", subKey="led"
            const [realId, subKey] = reqDev.id.split('_');
            
            const dbDev = userDevices.find(d => d.id === realId);
            
            if (!dbDev) {
                return { id: reqDev.id, error_code: "DEVICE_NOT_FOUND" };
            }

            const config = dbDev.config || {};
            const subConfig = config.subDevices?.[subKey];
            
            if (!subConfig) {
                return { id: reqDev.id, error_code: "DEVICE_NOT_FOUND" };
            }

            // Достаем стейт конкретной части (например, state.led)
            const fullState = dbDev.state || {};
            const subState = fullState[subKey] || {}; 

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
    } catch (e) {
        console.error("❌ Error in queryDevices:", e);
        res.status(500).json({ request_id: req.headers['x-request-id'], payload: { error: "INTERNAL_ERROR" } });
    }
};

// --- 3. ACTION (Выполнение команд) ---
export const actionDevices = async (req, res) => {
    try {
        const { payload } = req.body;
        const results = [];

        for (const dev of payload.devices) {
            const [realId, subKey] = dev.id.split('_');
            
            // 1. Собираем изменения
            const changes = {};
            
            dev.capabilities.forEach(cap => {
                if (cap.type === 'devices.capabilities.on_off') changes.on = cap.state.value;
                if (cap.type === 'devices.capabilities.color_setting') changes.color = cap.state.value;
                if (cap.type === 'devices.capabilities.mode') changes.mode = cap.state.value;
                if (cap.type === 'devices.capabilities.range' && cap.state.instance === 'brightness') changes.brightness = cap.state.value;
            });

            // 2. Формируем пакет для зеркала
            // Пример: { "led": { "on": true, "color": {...} } }
            const socketPayload = {
                [subKey]: changes
            };

            console.log(`📡 Command to ${realId}:`, JSON.stringify(socketPayload));

            // 3. Отправляем на зеркало (через Socket.IO)
            io.to(realId).emit('command', socketPayload);
            
            // 4. Обновляем базу (Оптимистично)
            await db.updateDeviceState(realId, JSON.stringify(socketPayload));

            // 5. Формируем ответ Яндексу
            results.push({ 
                id: dev.id, 
                capabilities: dev.capabilities.map(c => ({
                    type: c.type, 
                    state: { instance: c.state.instance, action_result: { status: "DONE" } }
                })) 
            });
        }

        res.json({ request_id: req.headers['x-request-id'], payload: { devices: results } });
    } catch (e) {
        console.error("❌ Error in actionDevices:", e);
        res.status(500).json({ request_id: req.headers['x-request-id'], payload: { error: "INTERNAL_ERROR" } });
    }
};

// --- 4. Заглушка (Legacy) ---
// Этот метод нужен, чтобы роутер не ругался на отсутствие функции, 
// но само связывание теперь идет через authController.
// ✅ ДҰРЫС (Осыны қой)
export const requestPairCode = async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) return res.status(400).json({ error: "No deviceId provided" });

        // 1. Код генерациялау (6 сан)
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Базаға сақтау
        await db.savePairingCode(deviceId, code);
        console.log(`🔢 Code generated for ${deviceId}: ${code}`);

        // 3. Айнаға қайтару
        res.json({ success: true, code: code });
    } catch (e) {
        console.error("Pairing Error:", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
};