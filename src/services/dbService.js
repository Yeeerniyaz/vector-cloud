import fs from 'fs';
const DB_FILE = process.env.DB_FILE || './vector_db.json';

// Инициализируем структуру с новым полем pendingCodes
let db = { 
    authCodes: {},    // Для OAuth (длинные коды Яндекса)
    tokens: {},       // Токены доступа
    deviceStates: {}, // Состояния устройств
    pendingCodes: {}  // 👇 НОВОЕ: Короткие коды для ручной привязки (Код -> DeviceID)
};

if (fs.existsSync(DB_FILE)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        // Мержим, чтобы новые поля (pendingCodes) появились, даже если в файле их нет
        db = { ...db, ...loaded };
        
        // Гарантируем наличие объекта, если база старая
        if (!db.pendingCodes) db.pendingCodes = {};
        
    } catch (e) {
        console.error("❌ Ошибка чтения базы данных, создана новая:", e);
    }
}

export const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
export default db;