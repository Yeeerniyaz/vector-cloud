import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    user: process.env.DB_USER || 'yerniyaz',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'vector_db',
    password: process.env.DB_PASSWORD || 'vector_secret',
    port: 5432,
});

export const db = {
    pool, // Тікелей запрос керек болса
    
    init: async () => {
        const queries = [
            // 1. Клиенттер (Users)
            `CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                phone VARCHAR(20) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL, -- bcrypt-пен хештелген
                name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // 2. Модельдер (Device Models)
            `CREATE TABLE IF NOT EXISTS device_models (
                id VARCHAR(20) PRIMARY KEY, -- 'vector_a1', 'vector_pro'
                name VARCHAR(50) NOT NULL,
                capabilities JSONB NOT NULL DEFAULT '[]' -- Яндекс конфигі
            );`,

            // 3. Құрылғылар (Devices)
            `CREATE TABLE IF NOT EXISTS devices (
                id VARCHAR(100) PRIMARY KEY, -- Hardware ID (UUID from Mirror)
                model_id VARCHAR(20) REFERENCES device_models(id),
                user_id UUID REFERENCES users(id), -- Кімге тиесілі?
                
                name VARCHAR(100) DEFAULT 'Smart Mirror',
                room VARCHAR(50) DEFAULT 'Living Room',
                
                state JSONB DEFAULT '{}', -- { led: true, color: '#FF0000', temp: 24.5 }
                is_online BOOLEAN DEFAULT false,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // 4. Pairing Codes (Уақытша кодтар)
            `CREATE TABLE IF NOT EXISTS pairing_codes (
                code VARCHAR(6) PRIMARY KEY,
                device_id VARCHAR(100) UNIQUE NOT NULL, -- Бір айнада 1 код
                expires_at TIMESTAMP NOT NULL
            );`,

            // 5. OAuth Tokens (Яндекс үшін)
            `CREATE TABLE IF NOT EXISTS oauth_tokens (
                access_token VARCHAR(255) PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                expires_at TIMESTAMP
            );`,
            
             // 6. OAuth Codes (Login кезінде)
            `CREATE TABLE IF NOT EXISTS auth_codes (
                code VARCHAR(255) PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                expires_at TIMESTAMP
            );`
        ];

        for (let q of queries) await pool.query(q);

        // --- Дефолт модельдерді құру (Егер жоқ болса) ---
        // A1: Тек жарық (Light)
        const capsA1 = JSON.stringify([
            { type: "devices.capabilities.on_off" },
            { type: "devices.capabilities.color_setting" },
            { type: "devices.capabilities.range", parameters: { instance: "brightness", unit: "unit.percent", range: { min: 0, max: 100, precision: 1 } } }
        ]);
        
        // PRO: Жарық + Датчиктер (Temp, Humidity)
        const capsPRO = JSON.stringify([
            ...JSON.parse(capsA1),
            // PRO модельде датчиктер бөлек "properties" ретінде келеді, бірақ мұнда жалпы конфиг сақтаймыз
        ]);

        await pool.query(`INSERT INTO device_models (id, name, capabilities) VALUES 
            ('vector_a1', 'Vector A1', '${capsA1}'),
            ('vector_pro', 'Vector PRO', '${capsPRO}')
            ON CONFLICT (id) DO NOTHING;`);

        console.log("✅ PostgreSQL: Кестелер тексерілді және дайын.");
    },

    // --- Pairing Logic ---
    savePairingCode: async (deviceId, code) => {
        // Код 5 минутқа жарамды
        await pool.query(`
            INSERT INTO pairing_codes (code, device_id, expires_at) 
            VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
            ON CONFLICT (device_id) DO UPDATE SET code = $1, expires_at = NOW() + INTERVAL '5 minutes'
        `, [code, deviceId]);
    },

    linkDeviceToUser: async (code, userId) => {
        const res = await pool.query(`SELECT device_id FROM pairing_codes WHERE code = $1 AND expires_at > NOW()`, [code]);
        if (res.rows.length === 0) return null; // Код қате немесе ескірген

        const deviceId = res.rows[0].device_id;
        await pool.query(`UPDATE devices SET user_id = $2 WHERE id = $1`, [deviceId, userId]);
        await pool.query(`DELETE FROM pairing_codes WHERE code = $1`, [code]); // Кодты өшіру
        return deviceId;
    },

    // --- Socket Logic ---
    upsertDevice: async (id, modelId) => {
        // Егер девайс жоқ болса -> жасаймыз (user_id = NULL)
        // Егер бар болса -> online = true
        await pool.query(`
            INSERT INTO devices (id, model_id, is_online, last_seen)
            VALUES ($1, $2, true, NOW())
            ON CONFLICT (id) DO UPDATE SET is_online = true, last_seen = NOW(), model_id = $2
        `, [id, modelId]);
    },

    updateDeviceState: async (id, statePart) => {
        // JSONB merge: ескі state + жаңа деректер
        await pool.query(`UPDATE devices SET state = state || $2, last_seen = NOW() WHERE id = $1`, [id, statePart]);
    },
    
    setOffline: async (id) => {
        await pool.query(`UPDATE devices SET is_online = false WHERE id = $1`, [id]);
    },

    // --- Yandex Logic ---
    getUserDevices: async (userId) => {
        // User-ге тиесілі барлық девайсты аламыз + модель қабілеттері
        const res = await pool.query(`
            SELECT d.id, d.name, d.room, d.state, m.id as model_type, m.capabilities 
            FROM devices d 
            JOIN device_models m ON d.model_id = m.id 
            WHERE d.user_id = $1
        `, [userId]);
        return res.rows;
    }
};

export default db;