// --- 2. ОПРОС СОСТОЯНИЯ (QUERY) ---
export const queryDevices = (req, res) => {
    // Получаем состояние из базы по ГЛАВНОМУ ID (deviceId берется из токена)
    const state = db.deviceStates[req.deviceId];
    
    const devicesStatus = req.body.devices.map(dev => {
        const id = dev.id;

        // Если данных в базе вообще нет для этого зеркала
        if (!state) return { id, error_code: "DEVICE_UNREACHABLE" };

        // 1. Главное зеркало (свет и режимы)
        if (id === req.deviceId) {
            return {
                id: id,
                capabilities: [
                    { type: "devices.capabilities.on_off", state: { instance: "on", value: state.on ?? false } },
                    { type: "devices.capabilities.range", state: { instance: "brightness", value: state.brightness ?? 100 } },
                    { type: "devices.capabilities.color_setting", state: { instance: "hsv", value: state.hsv ?? { h: 0, s: 0, v: 100 } } },
                    { type: "devices.capabilities.mode", state: { instance: "program", value: state.mode ?? "one" } }
                ]
            };
        }
        
        // 2. Датчики (берем реальные данные, пришедшие через MQTT)
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