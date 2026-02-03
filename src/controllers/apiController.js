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

// 2. Құрылғыны басқару (Жылдам команда)
export const controlDevice = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params; // ID: mirror_uuid
        const command = req.body;  // Body: { "led": { "on": true, "color": "red" } }

        console.log(`📱 Dashboard Command to ${id}:`, JSON.stringify(command));

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