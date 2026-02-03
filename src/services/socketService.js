import db, { saveDB } from './dbService.js';

export const initSocketLogic = (io) => {
    io.on('connection', (socket) => {
        // Извлекаем ID и версию модели из query-параметров
        const { deviceId, deviceV } = socket.handshake.query;

        if (!deviceId) {
            console.log('⚠️ Подключение без deviceId отклонено');
            socket.disconnect();
            return;
        }

        console.log(`✅ Подключено: ID [${deviceId}], Модель [${deviceV || 'A1'}]`);
        socket.join(deviceId);

        // Инициализируем или обновляем состояние устройства в базе
        if (!db.deviceStates[deviceId]) {
            db.deviceStates[deviceId] = {};
        }
        
        // Сохраняем версию модели и ставим статус Online
        db.deviceStates[deviceId].version = deviceV || 'A1';
        db.deviceStates[deviceId].online = true;
        db.deviceStates[deviceId].lastSeen = new Date().toISOString();
        saveDB();

        // Отправляем зеркалу подтверждение
        socket.emit('server:connected', { 
            status: 'online', 
            deviceId 
        });

        // Слушаем запрос на генерацию кода привязки (если зеркало еще не привязано)
        socket.on('auth:request_code', () => {
            // Генерируем 6-значный код
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Сохраняем связь Код -> DeviceID в твое новое поле pendingCodes
            db.pendingCodes[code] = {
                deviceId,
                createdAt: Date.now()
            };
            saveDB();

            // Отправляем код обратно на зеркало, чтобы оно вывело его на экран
            socket.emit('auth:code_generated', { code });
            console.log(`🔑 Сгенерирован код ${code} для устройства ${deviceId}`);
        });

        socket.on('disconnect', () => {
            if (db.deviceStates[deviceId]) {
                db.deviceStates[deviceId].online = false;
                saveDB();
            }
            console.log(`❌ Отключено: ${deviceId}`);
        });
    });
};

/**
 * Отправка команд на LED (из yandexRoutes)
 */
export const sendLedCommand = (io, deviceId, action, payload) => {
    io.to(deviceId).emit('command:led', { action, payload });
};

/**
 * Успешная привязка через код
 */
export const sendAuthSuccess = (io, deviceId) => {
    io.to(deviceId).emit('auth:success', { type: 'AUTH_SUCCESS' });
};