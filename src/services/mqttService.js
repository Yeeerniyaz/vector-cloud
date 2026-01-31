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
    // Сервер может подписаться на статусы устройств, чтобы знать, кто онлайн
    client.subscribe('vector/+/status');
});

client.on('message', (topic, message) => {
    // Здесь можно обрабатывать входящие данные от зеркал (например, датчики)
    // console.log(`☁️ MSG [${topic}]: ${message.toString()}`);
});

client.on('error', (err) => {
    console.error('❌ MQTT Error:', err.message);
});

// Функция отправки команды на зеркало
export const sendCommand = (deviceId, command) => {
    if (client.connected) {
        const topic = `vector/${deviceId}/cmd`;
        client.publish(topic, command);
        console.log(`📡 Sent to [${deviceId}]: ${command}`);
    } else {
        console.warn("⚠️ MQTT not connected, command skipped");
    }
};