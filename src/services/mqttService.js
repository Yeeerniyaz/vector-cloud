import mqtt from 'mqtt';

// Адрес твоего брокера
const MQTT_BROKER = "mqtt://82.115.43.240:1883";

// Создаем клиент с уникальным ID для сервера
const client = mqtt.connect(MQTT_BROKER, {
    reconnectPeriod: 5000,
    clientId: 'vector-cloud-server_' + Math.random().toString(16).substr(2, 8)
});

client.on('connect', () => {
    console.log('✅ Cloud Backend connected to MQTT Broker');
    // Сервер подписывается на статусы, чтобы видеть живые зеркала
    client.subscribe('vector/+/status');
});

client.on('message', (topic, message) => {
    // Здесь можно обрабатывать входящие данные от зеркал
    // console.log(`☁️ MSG [${topic}]: ${message.toString()}`);
});

client.on('error', (err) => {
    console.error('❌ MQTT Error:', err.message);
});

// Функция отправки команды на зеркало (общая)
export const sendCommand = (deviceId, command) => {
    if (client.connected) {
        const topic = `vector/${deviceId}/cmd`;
        // Убедимся, что отправляем строку, даже если прилетел объект
        const payload = typeof command === 'object' ? JSON.stringify(command) : command;
        
        client.publish(topic, payload);
        console.log(`📡 Sent to [${deviceId}]: ${payload}`);
    } else {
        console.warn("⚠️ MQTT not connected, command skipped");
    }
};

// 👇 НОВАЯ ФУНКЦИЯ: Уведомление об успешном входе
export const sendAuthSuccess = (deviceId) => {
    if (client.connected) {
        const topic = `vector/${deviceId}/auth`; // Отдельный канал для авторизации
        // Отправляем JSON, чтобы зеркало точно поняло команду
        const payload = JSON.stringify({ type: 'AUTH_SUCCESS' });
        
        client.publish(topic, payload);
        console.log(`🔓 Auth Success sent to [${deviceId}]`);
    } else {
        console.warn("⚠️ MQTT not connected, auth signal skipped");
    }
};