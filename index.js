import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors'; 
import yandexRoutes from './src/routes/yandexRoutes.js';
import apiRoutes from './src/routes/apiRoutes.js'; 
import dashboardRoutes from './src/routes/dashboardRoutes.js'; // <--- ЖАҢА
import { initSocketLogic } from './src/services/socketService.js';
import { db } from './src/services/dbService.js'; 

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- ROUTES ---
app.use('/', yandexRoutes); 
app.use('/api', apiRoutes); 
app.use('/dashboard', dashboardRoutes); // <--- Браузерден кіру үшін: http://IP:3000/dashboard

initSocketLogic(io);

const startServer = async () => {
    await db.init();
    httpServer.listen(PORT, () => {
        console.log(`🚀 VECTOR Cloud v4.2 (With Dashboard) running on port ${PORT}`);
        console.log(`📱 Phone Dashboard: http://localhost:${PORT}/dashboard`);
    });
};

startServer();
export { io };