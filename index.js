import express from 'express';
import bodyParser from 'body-parser';
import yandexRoutes from './src/routes/yandexRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Подключаем маршруты Яндекса к корню
app.use('/', yandexRoutes);

app.listen(PORT, () => console.log(`🚀 VECTOR CLOUD v4.0 запущен на порту ${PORT}`));