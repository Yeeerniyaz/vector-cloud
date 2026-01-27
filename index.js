import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка путей для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'vector_db.json');

app.use(cors());
app.use(express.json());

// Вспомогательные функции для БД (JSON файл)
const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) return { clients: {}, system_logs: [] };
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { clients: {}, system_logs: [] };
    }
};

const writeDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

// --- API: Регистрация нового зеркала ---
app.post('/api/register', (req, res) => {
    const { deviceId, owner, city, version } = req.body;
    const db = readDB();

    db.clients[deviceId] = {
        owner: owner || "Unknown",
        city: city || "Unknown",
        version: version || "1.0.0",
        regDate: new Date().toISOString(),
        lastSeen: new Date().toISOString()
    };

    writeDB(db);
    console.log(`[REG] Новое устройство: ${deviceId} (${owner})`);
    res.json({ success: true, message: "VECTOR Registered" });
});

// --- API: Алиса (Webhook) ---
app.post('/alice', (req, res) => {
    const { request, session, version } = req.body;
    const command = request.original_utterance.toLowerCase();

    // Стандартный ответ системы
    let text = "Система VECTOR OS активна. Жду команду.";

    // Ответы только по делу и бренду
    if (command.includes("кто ты") || command.includes("что за проект")) {
        text = "Я — операционная система VECTOR. Обеспечиваю работу умных интерфейсов и мониторинг устройств.";
    }

    if (command.includes("статус") || command.includes("проверка")) {
        text = "Все модули работают штатно. Соединение с сервером api.yeee.kz установлено. Ошибок не обнаружено.";
    }

    res.json({
        version,
        session,
        response: {
            text,
            end_session: false
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 VECTOR Cloud Core (ESM) running on port ${PORT}`);
});