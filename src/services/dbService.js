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
    init: async () => {
        const queries = [
            // 1. Клиенттер
            `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                login VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100),
                phone_number VARCHAR(20)
            );`,
            // 2. Құрылғы модельдері (датчиктер тізімімен)
            `CREATE TABLE IF NOT EXISTS device_models (
                id VARCHAR(20) PRIMARY KEY, -- 'A1', 'A2', 'PRO'
                has_temp BOOLEAN DEFAULT FALSE,
                has_hum BOOLEAN DEFAULT FALSE,
                has_co2 BOOLEAN DEFAULT FALSE
            );`,
            // 3. Зеркалолар
            `CREATE TABLE IF NOT EXISTS devices (
                id VARCHAR(50) PRIMARY KEY,
                model_id VARCHAR(20) REFERENCES device_models(id),
                user_id INTEGER REFERENCES users(id),
                status VARCHAR(20) DEFAULT 'OFFLINE',
                led_color VARCHAR(30) DEFAULT '255,165,0',
                led_mode VARCHAR(50) DEFAULT 'static',
                temp_val FLOAT,
                hum_val FLOAT,
                co2_val INTEGER,
                last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );`,
            // 4. Яндекс токендері мен кодтары
            `CREATE TABLE IF NOT EXISTS tokens (token UUID PRIMARY KEY, device_id VARCHAR(50));`,
            `CREATE TABLE IF NOT EXISTS pending_codes (code VARCHAR(10) PRIMARY KEY, device_id VARCHAR(50));`
        ];
        for (let q of queries) await pool.query(q);
        
        // Дефолттық модельді қосу (A1)
        await pool.query("INSERT INTO device_models (id, has_temp) VALUES ('A1', false) ON CONFLICT DO NOTHING");
        console.log("✅ База құрылымы дайын");
    },

    // Құрылғы мәліметін моделімен бірге алу (Яндекс үшін)
    getDeviceWithSpecs: async (deviceId) => {
        const res = await pool.query(
            `SELECT d.*, m.has_temp, m.has_hum, m.has_co2 
             FROM devices d JOIN device_models m ON d.model_id = m.id 
             WHERE d.id = $1`, [deviceId]
        );
        return res.rows[0];
    },

    // Қалған функциялар (saveLed, upsertDevice, т.б.) осында жазылады...
    saveLed: async (id, color, mode) => {
        await pool.query("UPDATE devices SET led_color = $2, led_mode = $3 WHERE id = $1", [id, color, mode]);
    }
};