import fs from 'fs';
const DB_FILE = process.env.DB_FILE || './vector_db.json';

let db = { authCodes: {}, tokens: {}, deviceStates: {} };
if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

export const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
export default db;