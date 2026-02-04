import { db } from "./dbService.js";

// Храним socketId для каждого устройства: { deviceId: socketId }
const connectedDevices = {};

export const initSocketLogic = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 New Connection: ${socket.id}`);

        // 1. Регистрация устройства (Зеркало подключается)
        socket.on('register', async (data) => {
            const { deviceId, type } = data;
            
            if (deviceId) {
                console.log(`📱 Device Registered: ${deviceId} (${type})`);
                
                // Сохраняем связь ID устройства -> Socket ID
                connectedDevices[deviceId] = socket.id;
                
                // Присоединяем сокет к комнате с именем deviceId
                socket.join(deviceId); 

                // Обновляем статус в базе (Online)
                await db.upsertDevice(deviceId, 'vector_a1');
                
                // Сразу отправляем текущий конфиг (чтобы зеркало узнало язык)
                const devices = await db.getUserDevices(null); // Тут можно оптимизировать, но пока берем конфиг из базы
                // Ищем конкретное устройство (в будущем можно сделать метод getDeviceConfig)
                // Но проще сделать так:
                const res = await db.pool.query('SELECT config FROM devices WHERE id = $1', [deviceId]);
                const config = res.rows[0]?.config?.general || { city: "Almaty", language: "ru", showWeather: true };
                
                socket.emit('config_updated', config);
            }
        });

        // 2. Зеркало запрашивает конфиг (принудительно)
        // ЭТО ТО, ЧЕГО НЕ ХВАТАЛО 👇
        socket.on('request_config', async () => {
            // Найти deviceId по socket.id (или использовать handshake query, если передавали)
            // Самый надежный способ - посмотреть, в каких комнатах состоит сокет
            // Но мы передавали deviceId при подключении в query, можно взять оттуда
            const deviceId = socket.handshake.query.deviceId;

            if (deviceId) {
                console.log(`📥 Config Requested by ${deviceId}`);
                const res = await db.pool.query('SELECT config FROM devices WHERE id = $1', [deviceId]);
                // Берем настройки или дефолтные
                const config = res.rows[0]?.config?.general || { city: "Almaty", language: "ru", showWeather: true };
                
                // Отправляем обратно
                socket.emit('config_updated', config);
            }
        });

        // 3. Отключение
        socket.on('disconnect', async () => {
            console.log(`❌ Disconnected: ${socket.id}`);
            // Найти deviceId и пометить offline
            const deviceId = Object.keys(connectedDevices).find(key => connectedDevices[key] === socket.id);
            if (deviceId) {
                await db.setOffline(deviceId);
                delete connectedDevices[deviceId];
            }
        });
    });
};