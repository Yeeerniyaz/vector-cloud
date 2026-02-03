import db from '../services/dbService.js';
import { io } from '../../index.js';

// 1. Барлық құрылғыларды алу (Dashboard үшін таза JSON)
export const getMyDevices = async (req, res) => {
    try {
        const userId = req.userId;
        const devices = await db.getUserDevices(userId);
        res.json(devices);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server Error" });
    }
};

// 2. Құрылғыны басқару (Жылдам команда: Жарық, Түс)
export const controlDevice = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params; // ID: mirror_uuid
        const command = req.body;  // Body: { "led": { "on": true, "color": "red" } }

        console.log(`📱 CMD -> ${id}:`, JSON.stringify(command));

        // A. Айнаға жіберу (Socket.IO)
        io.to(id).emit('command', command);

        // B. Базаны жаңарту
        await db.updateDeviceState(id, JSON.stringify(command));

        res.json({ success: true, sent: command });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Control Error" });
    }
};

// 3. ЖАҢА: Баптауларды жаңарту (Тіл, Қала, Сағат)
export const updateSettings = async (req, res) => {
    try {
        const { id } = req.params;
        // Dashboard-тан келетін деректер
        const { city, language, timezone, showWeather } = req.body;

        console.log(`⚙️ Settings Update for ${id}:`, req.body);

        // Жаңа конфигурация объектісі
        const newConfig = {
            general: {
                city: city || "Almaty",
                language: language || "ru", // Егер келмесе, default 'ru'
                timezone: timezone || "Asia/Almaty",
                showWeather: showWeather === true
            }
        };

        // 1. Базаға сақтау
        await db.updateDeviceConfig(id, newConfig);

        // 2. Айнаға тікелей сигнал жіберу (Socket)
        // Айна бұны қабылдап, интерфейсін (ауа райы, тіл) жаңартады
        io.to(id).emit('config_updated', newConfig.general);

        res.json({ success: true, settings: newConfig.general });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Settings Error" });
    }
};