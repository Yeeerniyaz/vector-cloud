import pkg from 'pg';
import { DEVICE_MODELS } from '../config/models.js'; 

const { Pool } = pkg;

const pool = new Pool({
    user: process.env.DB_USER || 'yerniyaz',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'vector_db',
    password: process.env.DB_PASSWORD || 'vector_secret',
    port: 5432,
});

export const db = {
    pool, 

    init: async () => {
        const queries = [
            `CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                phone VARCHAR(20) UNIQUE,
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS device_models (
                id VARCHAR(20) PRIMARY KEY, 
                name VARCHAR(50) NOT NULL,
                capabilities JSONB NOT NULL DEFAULT '[]'
            );`,
            `CREATE TABLE IF NOT EXISTS devices (
                id VARCHAR(100) PRIMARY KEY, 
                model_id VARCHAR(20) REFERENCES device_models(id),
                user_id UUID REFERENCES users(id), 
                name VARCHAR(100) DEFAULT 'Smart Mirror',
                room VARCHAR(50) DEFAULT 'Living Room',
                state JSONB DEFAULT '{}', 
                config JSONB DEFAULT '{}', 
                is_online BOOLEAN DEFAULT false,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS pairing_codes (
                code VARCHAR(6) PRIMARY KEY,
                device_id VARCHAR(100) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL
            );`,
            `CREATE TABLE IF NOT EXISTS oauth_tokens (
                access_token VARCHAR(255) PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                expires_at TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS auth_codes (
                code VARCHAR(255) PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                expires_at TIMESTAMP
            );`
        ];

        for (let q of queries) await pool.query(q);

        // Дефолтная модель A1
        const capsA1 = JSON.stringify([
            { type: "devices.capabilities.on_off" },
            { type: "devices.capabilities.color_setting" },
            { type: "devices.capabilities.range", parameters: { instance: "brightness", unit: "unit.percent", range: { min: 0, max: 100, precision: 1 } } }
        ]);

        await pool.query(`INSERT INTO device_models (id, name, capabilities) VALUES 
            ('vector_a1', 'Vector A1', '${capsA1}')
            ON CONFLICT (id) DO NOTHING;`);

        console.log("✅ PostgreSQL: Таблицы проверены и готовы к бою.");
    },

    // --- Pairing Logic ---
    savePairingCode: async (deviceId, code) => {
        await pool.query(`
            INSERT INTO pairing_codes (code, device_id, expires_at) 
            VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
            ON CONFLICT (device_id) DO UPDATE SET code = $1, expires_at = NOW() + INTERVAL '5 minutes'
        `, [code, deviceId]);
    },

    getDeviceIdByCode: async (code) => {
        const res = await pool.query(`SELECT device_id FROM pairing_codes WHERE code = $1 AND expires_at > NOW()`, [code]);
        return res.rows[0]?.device_id || null;
    },

    deletePendingCode: async (code) => {
        await pool.query(`DELETE FROM pairing_codes WHERE code = $1`, [code]);
    },

    // --- User Logic ---
    ensureUserForDevice: async (deviceId) => {
        let res = await pool.query(`SELECT user_id FROM devices WHERE id = $1`, [deviceId]);
        let userId = res.rows[0]?.user_id;

        if (!userId) {
            console.log(`👤 New User created for Device: ${deviceId}`);
            const userRes = await pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`);
            userId = userRes.rows[0].id;
            await pool.query(`UPDATE devices SET user_id = $1 WHERE id = $2`, [userId, deviceId]);
        }
        return userId;
    },

    // --- OAuth Flow ---
    saveAuthCode: async (code, userId) => {
        await pool.query(`INSERT INTO auth_codes (code, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`, [code, userId]);
    },

    getUserByAuthCode: async (code) => {
        const res = await pool.query(`SELECT user_id FROM auth_codes WHERE code = $1 AND expires_at > NOW()`, [code]);
        return res.rows[0]?.user_id || null;
    },

    saveAccessToken: async (token, userId) => {
        await pool.query(`INSERT INTO oauth_tokens (access_token, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 year')`, [token, userId]);
    },

    getUserByToken: async (token) => {
        const res = await pool.query(`SELECT user_id FROM oauth_tokens WHERE access_token = $1 AND expires_at > NOW()`, [token]);
        return res.rows[0]?.user_id || null;
    },

    // ... (басқа OAuth функцияларының жанына)

    deleteAccessToken: async (token) => {
        await pool.query('DELETE FROM oauth_tokens WHERE access_token = $1', [token]);
        console.log(`🗑 Token deleted: ${token.substring(0, 5)}...`);
    },



    // --- Socket Logic ---
    upsertDevice: async (id, modelId) => {
        await pool.query(`
            INSERT INTO devices (id, model_id, is_online, last_seen)
            VALUES ($1, $2, true, NOW())
            ON CONFLICT (id) DO UPDATE SET is_online = true, last_seen = NOW(), model_id = $2
        `, [id, modelId]);
    },

    updateDeviceState: async (id, statePart) => {
        await pool.query(`UPDATE devices SET state = state || $2, last_seen = NOW() WHERE id = $1`, [id, statePart]);
    },
    
    setOffline: async (id) => {
        await pool.query(`UPDATE devices SET is_online = false WHERE id = $1`, [id]);
    },

    // --- SETTINGS UPDATE (ЖАҢА) ---
    updateDeviceConfig: async (deviceId, newConfig) => {
        const res = await pool.query(`SELECT config FROM devices WHERE id = $1`, [deviceId]);
        let currentConfig = res.rows[0]?.config || {};
        
        const updatedConfig = { 
            ...currentConfig, 
            ...newConfig,
            general: { ...(currentConfig.general || {}), ...(newConfig.general || {}) }
        };

        await pool.query(`UPDATE devices SET config = $1 WHERE id = $2`, [JSON.stringify(updatedConfig), deviceId]);
        return updatedConfig;
    },

    // --- ИСПРАВЛЕННАЯ ЛОГИКА (DEFAULTS) ---
    getUserDevices: async (userId) => {
        const res = await pool.query(`
            SELECT d.id, d.name, d.room, d.state, d.config, m.id as model_type
            FROM devices d 
            LEFT JOIN device_models m ON d.model_id = m.id 
            WHERE d.user_id = $1
        `, [userId]);
        
        return res.rows.map(row => {
            let config = row.config || {};
            
            // Егер конфиг бос болса, модельден аламыз
            if (Object.keys(config).length === 0 || !config.subDevices) {
                 const modelDef = DEVICE_MODELS[row.model_type || 'vector_a1'] || DEVICE_MODELS['vector_a1'];
                 config = {
                     name: row.name,
                     subDevices: modelDef.subDevices,
                     general: { city: "Almaty", language: "ru", timezone: "Asia/Almaty", showWeather: true }
                 };
            }

            // Егер general болмаса (ескі записьтер үшін), орыс тілін default қыламыз
            if (!config.general) {
                config.general = { city: "Almaty", language: "ru", timezone: "Asia/Almaty", showWeather: true };
            }
            
            return { ...row, config };
        });
    }
};

export default db;