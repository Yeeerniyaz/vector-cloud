import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import bodyParser from 'body-parser';
import yandexRoutes from './src/routes/yandexRoutes.js';
import { initSocketLogic } from './src/services/socketService.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" } 
});

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Маршруты для Алисы
app.use('/', yandexRoutes);

// Запуск логики WebSockets с передачей io
initSocketLogic(io);

httpServer.listen(PORT, () => {
    console.log(`🚀 VECTOR Cloud Server v4.0 запущен на порту ${PORT}`);
});

export { io };