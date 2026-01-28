import mqtt from 'mqtt';
import db, { saveDB } from './dbService.js';

const mqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`);

mqttClient.on('connect', () => {
    console.log("✅ MQTT подключен");
    mqttClient.subscribe('vector/+/status');
});

mqttClient.on('message', (topic, message) => {
    const deviceId = topic.split('/')[1];
    db.deviceStates[deviceId] = message.toString() === 'ON';
    saveDB();
});

export const sendCommand = (deviceId, cmd) => {
    mqttClient.publish(`vector/${deviceId}/cmd`, cmd, { qos: 1, retain: true });
};