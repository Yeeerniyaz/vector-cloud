import { db } from './dbService.js';

export const initSocketLogic = (io) => {
    io.on('connection', async (socket) => {
        const { deviceId, modelId } = socket.handshake.auth;
        if (!deviceId) return socket.disconnect();

        console.log(`📡 Зеркало қосылды: ID[${deviceId}] Model[${modelId}]`);
        socket.join(deviceId);

        // Базада жаңарту (Модельді де сақтаймыз)
        await db.upsertDevice(deviceId, modelId || 'A1');

        socket.on('led_status', async (data) => {
            await db.saveLed(deviceId, data.color, data.mode);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Ажыратылды: ${deviceId}`);
        });
    });
};