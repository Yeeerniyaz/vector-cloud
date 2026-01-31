import mqtt from "mqtt";
import { exec } from "child_process";
import fetch from "node-fetch"; // В Electron/Node иногда нужен явный импорт
import { getUserToken } from "./identity.js"; // 👈 Импортируем получение токена

// 👇 АДРЕС ТВОЕГО БРОКЕРА
const MQTT_BROKER = "mqtt://82.115.43.240:1883";
// 👇 АДРЕС PYTHON-МОСТА (Локальный сервер на Малине)
const PYTHON_API = "http://localhost:5005";

export const setupMqtt = (deviceId) => {
  const token = getUserToken(); // 👈 Берем сохраненный токен
  
  console.log(`☁️ Connecting to Vector Cloud [${deviceId}]...`);
  if (token) console.log("🔑 Auth Token Found");

  // Подключение с авторизацией (если есть токен)
  const client = mqtt.connect(MQTT_BROKER, {
    reconnectPeriod: 5000,
    username: deviceId, // Обычно deviceId используется как username
    password: token || "anon" // Если токен есть, шлем его, иначе "anon"
  });

  client.on('connect', () => {
    console.log('✅ MQTT Online');
    client.subscribe(`vector/${deviceId}/cmd`);
    client.publish(`vector/${deviceId}/status`, 'ONLINE');
  });

  client.on('message', async (topic, message) => {
    const msgStr = message.toString();
    console.log(`📩 Cloud Command: ${msgStr}`);

    // --- 1. ЭКРАН (Системные команды Raspberry Pi) ---
    if (msgStr === 'ON') exec('vcgencmd display_power 1');
    if (msgStr === 'OFF') exec('vcgencmd display_power 0');

    // --- 2. ПЕРЕЗАГРУЗКА ---
    if (msgStr === 'REBOOT') {
       sendCommandToPython('/system/reboot', {}, 'POST');
    }

    // --- 3. ЛЕНТА (Пересылаем команду Питону в формате для ESP32) ---
    
    // Команда выключения
    if (msgStr === 'LED_OFF') {
        sendCommandToPython('/api/led', { mode: 'OFF' });
    }
    
    // Команда цвета: "LED_COLOR:255,165,0"
    if (msgStr.startsWith('LED_COLOR:')) {
        try {
            const rgbStr = msgStr.split(':')[1]; 
            const [r, g, b] = rgbStr.split(',').map(Number);
            
            // Отправляем массив [r, g, b], как ждет ESP32 (через Python Bridge)
            sendCommandToPython('/api/led', { 
                mode: 'STATIC', 
                color: [r, g, b],
                bright: 1.0 
            });
        } catch (e) {
            console.error("Ошибка парсинга цвета:", e);
        }
    }

    // Команда режима: "LED_MODE:RAINBOW"
    if (msgStr.startsWith('LED_MODE:')) {
        const mode = msgStr.split(':')[1]; // RAINBOW, POLICE, METEOR, FIRE
        sendCommandToPython('/api/led', { 
            mode: mode, 
            speed: 50,
            bright: 0.8
        });
    }
  });

  client.on('error', (err) => console.log('❌ MQTT Error:', err.message));
  
  return client;
};

// --- ОТПРАВКА В PYTHON ---
async function sendCommandToPython(endpoint, body) {
    try {
        await fetch(`${PYTHON_API}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (e) {
        console.error(`Ошибка связи с Python Bridge (${endpoint}):`, e.message);
    }
}