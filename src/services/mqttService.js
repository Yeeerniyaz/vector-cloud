import mqtt from 'mqtt';
import db, { saveDB } from './dbService.js'; // 👇 Импортируем базу

const MQTT_BROKER = "mqtt://82.115.43.240:1883";

const client = mqtt.connect(MQTT_BROKER, {
    reconnectPeriod: 5000,
    clientId: 'vector-cloud-server_' + Math.random().toString(16).substr(2, 8)
});

client.on('connect', () => {
    console.log('✅ Cloud Backend connected to MQTT Broker');
    client.subscribe('vector/+/status');
    
    // 👇 ПОДПИСЫВАЕМСЯ НА ДАННЫЕ ОТ ЗЕРКАЛ
    client.subscribe('vector/+/state');
});

client.on('message', (topic, message) => {
    const msgStr = message.toString();

    // Обработка данных состояния (Датчики)
    // Топик: vector/mirror-12345/state
    if (topic.includes('/state')) {
        try {
            // Вытаскиваем ID из топика
            const deviceId = topic.split('/')[1];
            const data = JSON.parse(msgStr);

            // Сохраняем в базу данных
            if (!db.deviceStates[deviceId]) db.deviceStates[deviceId] = {};
            
            // Обновляем только пришедшие поля
            const state = db.deviceStates[deviceId];
            if (data.temp !== undefined) state.temp = data.temp;
            if (data.hum !== undefined) state.hum = data.hum;
            if (data.co2 !== undefined) state.co2 = data.co2;
            
            // Не сохраняем файл на каждый чих (слишком часто), 
            // но можно сохранить раз в минуту или оставить в памяти.
            // Для надежности сохраним:
            saveDB();
            
            // console.log(`💾 Updated state for [${deviceId}]`);
        } catch (e) {
            console.error("State parse error:", e);
        }
    }
});

// ... (остальные функции sendCommand и sendAuthSuccess без изменений) ...
// (Оставь их как были в прошлом файле)

export const sendCommand = (deviceId, command) => {
    if (client.connected) {
        const topic = `vector/${deviceId}/cmd`;
        const payload = typeof command === 'object' ? JSON.stringify(command) : command;
        client.publish(topic, payload);
    }
};

export const sendAuthSuccess = (deviceId) => {
    if (client.connected) {
        client.publish(`vector/${deviceId}/auth`, JSON.stringify({ type: 'AUTH_SUCCESS' }));
    }
};