import db from './dbService.js';

export const initSocketLogic = (io) => {
    // Middleware: Проверка, что подключается именно наше зеркало
    io.use(async (socket, next) => {
        const { deviceId, modelId } = socket.handshake.auth;
        
        if (deviceId) {
            socket.deviceId = deviceId;
            socket.modelId = modelId || 'vector_a1'; // Дефолтная модель
            next();
        } else {
            console.warn(`⛔ Socket Connection Rejected: No deviceId`);
            next(new Error("No deviceId provided"));
        }
    });

    io.on('connection', async (socket) => {
        const { deviceId, modelId } = socket;
        console.log(`📡 Mirror Online: ${deviceId} [${modelId}]`);
        
        // Вступаем в "комнату" с именем deviceId. 
        // Теперь контроллер может писать: io.to(deviceId).emit(...)
        socket.join(deviceId); 
        
        // 1. Регистрируем устройство в базе (Online status)
        await db.upsertDevice(deviceId, modelId);

        // 2. Слушаем обновление состояния от зеркала
        socket.on('update_state', async (data) => {
            // console.log(`📊 State update from ${deviceId}`); // Раскомментируй для отладки
            await db.updateDeviceState(deviceId, JSON.stringify(data));
        });

        // 3. Зеркало присылает код для связывания (Pairing Code)
        socket.on('register_pair_code', async (code) => {
            console.log(`🔗 Pairing Code Received: ${code} for ${deviceId}`);
            await db.savePairingCode(deviceId, code);
        });

        // 4. Отключение
        socket.on('disconnect', async () => {
            console.log(`🔌 Mirror Offline: ${deviceId}`);
            await db.setOffline(deviceId);
        });
    });
};