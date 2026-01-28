// /root/vector-cloud/index.js
import express from 'express';
import mqtt from 'mqtt';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3000;

// 1. НАСТРОЙКИ MQTT (Твой брокер на том же сервере)
const mqttClient = mqtt.connect('mqtt://localhost:1883');

mqttClient.on('connect', () => console.log('✅ MQTT Connected'));
mqttClient.on('error', (err) => console.error('❌ MQTT Error:', err));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- БАЗА ДАННЫХ (Пока в памяти, потом можно MongoDB) ---
// Храним привязку: код авторизации -> ID зеркала
const authCodes = {}; 
const tokens = {};

// ==========================================
// 1. OAUTH 2.0 (ВХОД В АККАУНТ)
// ==========================================

// Шаг А: Алиса отправляет юзера сюда. Показываем форму ввода ID.
app.get('/auth', (req, res) => {
    res.send(`
        <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px; background-color: #111; color: white;">
                <h1 style="color: #ff9900;">VECTOR HOME</h1>
                <p>Привязка зеркала к Умному Дому</p>
                <form action="/login" method="post" style="margin-top: 30px;">
                    <input type="hidden" name="state" value="${req.query.state}">
                    <input type="hidden" name="redirect_uri" value="${req.query.redirect_uri}">
                    <input type="hidden" name="client_id" value="${req.query.client_id}">
                    
                    <input type="text" name="device_id" placeholder="Введите ID (например v-123)" 
                           style="padding: 15px; width: 80%; border-radius: 5px; border: none; margin-bottom: 20px;">
                    <br>
                    <button type="submit" style="padding: 15px 30px; background: #ff9900; border: none; color: white; font-weight: bold; cursor: pointer; border-radius: 5px;">
                        ПРИВЯЗАТЬ
                    </button>
                </form>
            </body>
        </html>
    `);
});

// Шаг Б: Юзер ввел ID. Генерируем временный код.
app.post('/login', (req, res) => {
    const { state, redirect_uri, device_id } = req.body;
    
    // В реальном проекте тут проверяем, существует ли такой ID в базе
    if (!device_id) return res.send("Ошибка: Введите ID");

    const code = uuidv4();
    authCodes[code] = device_id; // Запоминаем: этот код = это зеркало
    
    // Возвращаем юзера обратно в Яндекс с кодом
    res.redirect(`${redirect_uri}?state=${state}&code=${code}`);
});

// Шаг В: Яндекс меняет код на Токен
app.post('/token', (req, res) => {
    const code = req.body.code;
    const deviceId = authCodes[code];

    if (!deviceId) return res.status(400).json({ error: "Invalid code" });

    const accessToken = uuidv4();
    tokens[accessToken] = deviceId; // Запоминаем: этот токен = это зеркало

    res.json({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 31536000 // 1 год
    });
});

// ==========================================
// 2. YANDEX SMART HOME API
// ==========================================

// Проверка связи
app.head('/v1.0', (req, res) => res.status(200).send('OK'));

// Алиса спрашивает: "Какие устройства есть у юзера?"
app.get('/v1.0/user/devices', (req, res) => {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const deviceId = tokens[token];

    if (!deviceId) return res.status(401).send("Unauthorized");

    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            user_id: deviceId,
            devices: [{
                id: deviceId, // ID устройства = то, что ввел юзер
                name: "Зеркало Вектор",
                description: "Умное зеркало",
                room: "Прихожая",
                type: "devices.types.light", // Притворяемся лампочкой (самый простой тип)
                capabilities: [{
                    type: "devices.capabilities.on_off",
                    retrievable: true,
                    reportable: true
                }]
            }]
        }
    });
});

// Алиса спрашивает: "Зеркало включено или нет?"
app.post('/v1.0/user/devices/query', (req, res) => {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const deviceId = tokens[token];

    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            devices: [{
                id: deviceId,
                capabilities: [{
                    type: "devices.capabilities.on_off",
                    state: { instance: "on", value: true } // Пока всегда "Включено" (заглушка)
                }]
            }]
        }
    });
});

// 🔥 Алиса командует: "ВКЛЮЧИ!"
app.post('/v1.0/user/devices/action', (req, res) => {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const deviceId = tokens[token]; // Узнаем ID зеркала по токену

    const payload = req.body.payload;
    const devicesResult = [];

    payload.devices.forEach(device => {
        const capabilitiesResult = [];
        device.capabilities.forEach(cap => {
            if (cap.type === 'devices.capabilities.on_off') {
                const isOn = cap.state.value; // true или false
                const cmd = isOn ? "ON" : "OFF";
                
                // 🚀 ОТПРАВЛЯЕМ КОМАНДУ В MQTT
                // Топик: vector/{ID_ЗЕРКАЛА}/cmd
                const topic = `vector/${deviceId}/cmd`;
                console.log(`📡 Sending command "${cmd}" to ${topic}`);
                
                mqttClient.publish(topic, cmd);

                capabilitiesResult.push({
                    type: "devices.capabilities.on_off",
                    state: { instance: "on", action_result: { status: "DONE" } }
                });
            }
        });
        devicesResult.push({ id: device.id, capabilities: capabilitiesResult });
    });

    res.json({
        request_id: req.headers['x-request-id'],
        payload: { devices: devicesResult }
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 VECTOR CLOUD запущен на порту ${PORT}`);
});