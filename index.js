import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors'; // Обязательно для работы с внешними фронтендами
import yandexRoutes from './src/routes/yandexRoutes.js';
import { initSocketLogic } from './src/services/socketService.js';
import { db } from './src/services/dbService.js'; // Импортируем БД для инициализации

const app = express();
const httpServer = createServer(app);

// Настройка Socket.IO (Для связи с зеркалом)
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Разрешаем подключение зеркала с любого IP
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Разрешаем CORS для всех HTTP запросов
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Маршруты для Алисы
app.use('/', yandexRoutes);

// Запуск логики WebSockets
initSocketLogic(io);

// Главная функция запуска
const startServer = async () => {
    try {
        console.log("⏳ Подключение к базе данных...");
        
        // 1. Инициализация таблиц (если их нет)
        await db.init();

        // 2. Запуск сервера
        httpServer.listen(PORT, () => {
            console.log(`🚀 VECTOR Cloud Server v4.0 запущен на порту ${PORT}`);
            console.log(`🔗 Yandex Endpoint: http://localhost:${PORT}/v1.0`);
        });

    } catch (error) {
        console.error("❌ Ошибка при запуске сервера:", error);
        process.exit(1); // Завершаем процесс с ошибкой, чтобы Docker перезапустил контейнер
    }
};

startServer();

// Экспортируем io, чтобы контроллеры могли отправлять команды
export { io };