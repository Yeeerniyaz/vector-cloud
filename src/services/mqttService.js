import mqtt from 'mqtt';
import db, { saveDB } from './dbService.js';

const MQTT_HOST = process.env.MQTT_HOST || 'mqtt-broker';
const MQTT_PORT = process.env.MQTT_PORT || '1883';

const mqttClient = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
    reconnectPeriod: 5000,
});

mqttClient.on('connect', () => {
    console.log("✅ MQTT подключен к брокеру");
    mqttClient.subscribe('vector/+/status'); // Слушаем отчеты от малинки
});

mqttClient.on('message', (topic, message) => {
    const deviceId = topic.split('/')[1];
    db.deviceStates[deviceId] = message.toString() === 'ON';
    saveDB();
});

export const sendCommand = (deviceId, cmd) => {
    mqttClient.publish(`vector/${deviceId}/cmd`, cmd, { qos: 1, retain: true });
};