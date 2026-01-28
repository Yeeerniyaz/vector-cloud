import fs from 'fs';

const DB_FILE = process.env.DB_FILE || './vector_db.json';

// Загружаем данные или создаем пустую структуру
let db = { authCodes: {}, tokens: {}, deviceStates: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("❌ Ошибка чтения БД");
    }
}

export const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
export default db;