import db from './dbService.js';

export const initSocketLogic = (io) => {
    // Middleware: Авторизация (қарапайым тексеру)
    io.use(async (socket, next) => {
        const { deviceId, modelId } = socket.handshake.auth;
        if (deviceId) {
            socket.deviceId = deviceId;
            socket.modelId = modelId || 'vector_a1';
            next();
        } else {
            next(new Error("No deviceId provided"));
        }
    });

    io.on('connection', async (socket) => {
        const { deviceId, modelId } = socket;
        console.log(`📡 Mirror Online: ${deviceId} [${modelId}]`);
        
        socket.join(deviceId); // Бөлмеге кіргіземіз (команда жіберу үшін)
        
        // 1. Базаға тіркеу (ONLINE)
        await db.upsertDevice(deviceId, modelId);

        // 2. State жаңарту (Айнадан келген дерек)
        // Мысалы: socket.emit('update_state', { temp: 24.5, humidity: 40 })
        socket.on('update_state', async (data) => {
            console.log(`📊 Data from ${deviceId}:`, data);
            await db.updateDeviceState(deviceId, JSON.stringify(data));
        });

        // 3. Pairing Code (Айна жаңа код сұрады немесе көрсетті)
        // Айна экранында: "Код: 123456"
        socket.on('register_pair_code', async (code) => {
            console.log(`🔗 Pairing Code for ${deviceId}: ${code}`);
            await db.savePairingCode(deviceId, code);
        });

        socket.on('disconnect', async () => {
            console.log(`🔌 Mirror Offline: ${deviceId}`);
            await db.setOffline(deviceId);
        });
    });
};