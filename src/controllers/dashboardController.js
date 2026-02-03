import { db } from "../services/dbService.js";
import { io } from "../../index.js";
import { v4 as uuidv4 } from "uuid";

// 1. HTML: Логин беті
const renderLoginPage = (res, error = "") => {
    res.send(`
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <body style="background:#111;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
            <h2 style="color:#ff9900;letter-spacing:2px;">VECTOR CONTROL</h2>
            ${error ? `<p style="color:red">${error}</p>` : ''}
            <form action="/dashboard/login" method="POST" style="display:flex;flex-direction:column;gap:10px;">
                <input type="text" name="code" placeholder="Код с зеркала (123 456)" style="padding:15px;border-radius:10px;border:none;text-align:center;font-size:18px;" required>
                <button style="padding:15px;background:#ff9900;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">ВОЙТИ</button>
            </form>
        </body>
    `);
};

// 2. HTML: Басқару панелі
const renderControlPage = (res, devices) => {
    // Құрылғыларды HTML тізімге айналдырамыз
    const devicesHtml = devices.map(d => {
        const config = d.config?.subDevices?.led || {}; // Тек LED баптаулары мысалға
        const state = d.state?.led || {};
        
        return `
        <div style="background:#222;padding:20px;border-radius:15px;margin-bottom:15px;width:90%;max-width:400px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;">${d.name}</h3>
                <span style="color:${d.is_online ? '#0f0' : '#f00'}">● ${d.is_online ? 'ON' : 'OFF'}</span>
            </div>

            <button onclick="sendCommand('${d.id}', 'led', {on: ${!state.on}})" 
                style="width:100%;padding:15px;background:${state.on ? '#ff9900' : '#444'};border:none;border-radius:10px;color:#fff;font-weight:bold;margin-bottom:10px;">
                ${state.on ? 'ВЫКЛЮЧИТЬ СВЕТ' : 'ВКЛЮЧИТЬ СВЕТ'}
            </button>

            <div style="display:flex;gap:5px;margin-bottom:10px;">
                ${['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#FFA500'].map(c => `
                    <div onclick="sendColor('${d.id}', '${c}')" style="flex:1;height:40px;background:${c};border-radius:8px;cursor:pointer;"></div>
                `).join('')}
            </div>

            <select onchange="sendMode('${d.id}', this.value)" style="width:100%;padding:10px;border-radius:10px;background:#333;color:#fff;border:none;">
                <option value="STATIC" ${state.mode === 'STATIC' ? 'selected' : ''}>Статика</option>
                <option value="BREATHING" ${state.mode === 'BREATHING' ? 'selected' : ''}>Дыхание</option>
                <option value="SCANNER" ${state.mode === 'SCANNER' ? 'selected' : ''}>Сканер</option>
                <option value="RAINBOW" ${state.mode === 'RAINBOW' ? 'selected' : ''}>Радуга</option>
            </select>
        </div>`;
    }).join('');

    res.send(`
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script>
            function sendCommand(realId, subKey, payload) {
                fetch('/api/device/' + realId + '_' + subKey, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getCookie('token')},
                    body: JSON.stringify({ [subKey]: payload })
                }).then(() => location.reload());
            }
            function sendColor(id, hex) {
                // HEX to HSV convertation logic is needed here ideally, but sending raw for demo
                // For now simpler: Just reload to simulate interaction
                alert('Color ' + hex + ' sent!');
            }
            function sendMode(id, mode) {
                sendCommand(id, 'led', { mode: mode });
            }
            function getCookie(name) {
                const value = \`; \${document.cookie}\`;
                const parts = value.split(\`; \${name}=\`);
                if (parts.length === 2) return parts.pop().split(';').shift();
            }
        </script>
        <body style="background:#000;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;padding:20px;margin:0;">
            <h2 style="color:#ff9900;margin-bottom:20px;">МОИ ЗЕРКАЛА</h2>
            ${devicesHtml}
            <a href="/dashboard/logout" style="margin-top:20px;color:#666;text-decoration:none;">Выйти</a>
        </body>
    `);
};

// --- LOGIC ---

export const showDashboard = async (req, res) => {
    // 1. Токен бар ма? (Cookie арқылы тексереміз)
    const token = req.headers.cookie?.split('token=')[1]?.split(';')[0];
    
    if (!token) return renderLoginPage(res);

    // 2. Токен дұрыс па?
    const userId = await db.getUserByToken(token);
    if (!userId) return renderLoginPage(res, "Сессия ескірген");

    // 3. Құрылғыларды алып, көрсету
    const devices = await db.getUserDevices(userId);
    renderControlPage(res, devices);
};

export const handleLogin = async (req, res) => {
    const { code } = req.body;
    const cleanCode = code.replace(/\s+/g, '');

    // Код арқылы User табамыз (сол ескі логика)
    const deviceId = await db.getDeviceIdByCode(cleanCode);
    if (!deviceId) return renderLoginPage(res, "Код қате!");

    const userId = await db.ensureUserForDevice(deviceId);
    
    // Жаңа токен береміз
    const token = uuidv4();
    await db.saveAccessToken(token, userId);
    await db.deletePendingCode(cleanCode);

    // Токенді Cookie-ге сақтаймыз (30 күн)
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=2592000`);
    res.redirect('/dashboard');
};

export const handleLogout = (req, res) => {
    res.setHeader('Set-Cookie', `token=; Path=/; Max-Age=0`);
    res.redirect('/dashboard');
};