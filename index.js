import express from 'express';
import mqtt from 'mqtt';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Конфигурация из переменных окружения (Portainer Environment)
const PORT = process.env.PORT || 3000;
const MQTT_HOST = process.env.MQTT_HOST || 'mqtt-broker';
const MQTT_PORT = process.env.MQTT_PORT || '1883';

// 1. НАСТРОЙКИ MQTT С АВТО-ПЕРЕПОДКЛЮЧЕНИЕМ
const mqttClient = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
    reconnectPeriod: 5000, // Попытка подключения каждые 5 секунд
    connectTimeout: 30 * 1000,
});

mqttClient.on('connect', () => {
    console.log(`✅ MQTT Connected successfully to ${MQTT_HOST}`);
});

mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT...');
});

mqttClient.on('error', (err) => {
    // Если брокер еще не встал, не спамим ошибкой, а выводим краткий статус
    if (err.code === 'EAI_AGAIN' || err.code === 'ECONNREFUSED') {
        console.log(`⏳ Waiting for MQTT Broker (${MQTT_HOST})...`);
    } else {
        console.error('❌ MQTT Error:', err);
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Временное хранилище в памяти
const authCodes = {}; 
const tokens = {};
const deviceStates = {}; 

// ==========================================
// 2. OAUTH 2.0 (АВТОРИЗАЦИЯ)
// ==========================================

app.get('/auth', (req, res) => {
    res.send(`
        <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px; background-color: #000; color: white;">
                <h1 style="color: #ff9900;">VECTOR OS</h1>
                <p>Привязка зеркала к Яндекс.Алисе</p>
                <form action="/login" method="post" style="margin-top: 30px;">
                    <input type="hidden" name="state" value="${req.query.state}">
                    <input type="hidden" name="redirect_uri" value="${req.query.redirect_uri}">
                    <input type="text" name="device_id" placeholder="Введите ID (например v-001)" 
                           style="padding: 15px; width: 80%; border-radius: 5px; border: 1px solid #ff9900; background: #111; color: white; margin-bottom: 20px;">
                    <br>
                    <button type="submit" style="padding: 15px 30px; background: #ff9900; border: none; color: black; font-weight: bold; cursor: pointer; border-radius: 5px;">
                        ПОДКЛЮЧИТЬ
                    </button>
                </form>
            </body>
        </html>
    `);
});

app.post('/login', (req, res) => {
    const { state, redirect_uri, device_id } = req.body;
    if (!device_id) return res.status(400).send("Ошибка: ID обязателен");

    const code = uuidv4();
    authCodes[code] = device_id; 
    res.redirect(`${redirect_uri}?state=${state}&code=${code}`);
});

app.post('/token', (req, res) => {
    const code = req.body.code;
    const deviceId = authCodes[code];

    if (!deviceId) return res.status(400).json({ error: "Invalid code" });

    const accessToken = uuidv4();
    tokens[accessToken] = deviceId;

    res.json({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 31536000 
    });
});

// ==========================================
// 3. YANDEX SMART HOME API
// ==========================================

app.head('/v1.0', (req, res) => res.status(200).send('OK'));

app.get('/v1.0/user/devices', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const deviceId = tokens[token];

    if (!deviceId) return res.status(401).send("Unauthorized");

    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            user_id: deviceId,
            devices: [{
                id: deviceId,
                name: "Зеркало Вектор",
                description: "Умное зеркало VECTOR OS",
                room: "Прихожая",
                type: "devices.types.light", 
                capabilities: [{
                    type: "devices.capabilities.on_off",
                    retrievable: true,
                    reportable: true
                }]
            }]
        }
    });
});

app.post('/v1.0/user/devices/query', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const deviceId = tokens[token];
    const currentState = deviceStates[deviceId] || false;

    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            devices: [{
                id: deviceId,
                capabilities: [{
                    type: "devices.capabilities.on_off",
                    state: { instance: "on", value: currentState }
                }]
            }]
        }
    });
});

app.post('/v1.0/user/devices/action', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const deviceId = tokens[token];

    const { payload } = req.body;
    const devicesResult = payload.devices.map(device => {
        const capabilitiesResult = device.capabilities.map(cap => {
            if (cap.type === 'devices.capabilities.on_off') {
                const isOn = cap.state.value;
                deviceStates[deviceId] = isOn;

                const topic = `vector/${deviceId}/cmd`;
                const message = isOn ? "ON" : "OFF";
                mqttClient.publish(topic, message, { qos: 1 });
                console.log(`📡 Command sent to ${topic}: ${message}`);

                return {
                    type: "devices.capabilities.on_off",
                    state: { instance: "on", action_result: { status: "DONE" } }
                };
            }
        });
        return { id: device.id, capabilities: capabilitiesResult };
    });

    res.json({
        request_id: req.headers['x-request-id'],
        payload: { devices: devicesResult }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 VECTOR CLOUD запущен на порту ${PORT}`);
});