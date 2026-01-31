import mqtt from 'mqtt';
import db, { saveDB } from './dbService.js';

const mqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`);

mqttClient.on('connect', () => {
    console.log("✅ MQTT Connected");
    mqttClient.subscribe('vector/+/telemetry'); // Слушаем данные от датчиков
});

mqttClient.on('message', (topic, message) => {
    const deviceId = topic.split('/')[1];
    try {
        const data = JSON.parse(message.toString());
        // Обновляем состояние датчиков в БД
        db.deviceStates[deviceId] = {
            ...db.deviceStates[deviceId],
            temp: data.t,    // BME280/AHT21
            hum: data.h,     // BME280/AHT21
            press: data.p,   // BME280
            co2: data.c,     // ENS160
            on: data.on      // Статус дисплея
        };
        saveDB();
        console.log(`📡 Состояние ${deviceId} обновлено`);
    } catch (e) {
        console.error("❌ Ошибка парсинга телеметрии");
    }
});

export const sendCommand = (deviceId, cmd) => {
    mqttClient.publish(`vector/${deviceId}/cmd`, cmd, { qos: 1, retain: true });
};