import { db } from "../services/dbService.js";
import { io } from "../../index.js";
import { v4 as uuidv4 } from "uuid";

const TRANSLATIONS = {
    ru: { logout: "TERMINATE SESSION", online: "SYSTEM ACTIVE", offline: "OFFLINE" },
    kk: { logout: "ЖҮЙЕДЕН ШЫҒУ", online: "ЖҮЙЕ ҚОСУЛЫ", offline: "БАЙЛАНЫС ЖОҚ" }
};

const getPageHeader = () => `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root { --orange: #ff9900; --bg: #000; --card: #080808; --border: #1a1a1a; }
        body { background: var(--bg); color: #fff; font-family: 'Inter', sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; -webkit-tap-highlight-color: transparent; }
        .container { width: 100%; max-width: 400px; }
        
        .header { text-align: left; margin-bottom: 40px; padding-left: 10px; border-left: 3px solid var(--orange); }
        .main-title { font-family: 'Orbitron', sans-serif; font-size: 28px; letter-spacing: 8px; margin: 0; }
        .main-subtitle { font-size: 8px; letter-spacing: 4px; color: var(--orange); font-weight: 600; margin-top: 5px; opacity: 0.7; }

        .card { background: var(--card); border: 1px solid var(--border); border-radius: 0px; padding: 30px; margin-bottom: 20px; position: relative; }
        
        .status-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .device-name { font-size: 14px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
        .online-status { font-size: 8px; font-weight: 700; letter-spacing: 1px; margin-top: 4px; }

        .power-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); margin-bottom: 30px; }
        .power-btn { background: var(--bg); border: none; color: #444; padding: 20px; cursor: pointer; font-size: 10px; font-weight: 700; letter-spacing: 2px; transition: 0.3s; }
        .power-btn.active { color: var(--orange); background: #0c0c0c; }

        label { font-size: 8px; color: #555; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 15px; letter-spacing: 2px; }

        .color-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 30px; }
        .color-item { height: 35px; border-radius: 0px; cursor: pointer; border: 1px solid transparent; transition: 0.2s; position: relative; }
        .picker-wrapper { background: linear-gradient(45deg, #ff0000, #ff9900, #00ff00, #00ffff, #0000ff, #ff00ff); border: 1px solid #333; }
        .picker-input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }

        .slider-wrap { margin-bottom: 30px; }
        input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 1px; background: #333; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 14px; width: 14px; border-radius: 0; background: var(--orange); cursor: pointer; margin-top: -6px; }

        select { width: 100%; padding: 15px; background: var(--bg); border: 1px solid var(--border); color: #fff; font-family: 'Orbitron', sans-serif; font-size: 10px; letter-spacing: 2px; outline: none; border-radius: 0; appearance: none; text-align-last: center; }

        .logout-link { color: #222; text-decoration: none; font-size: 8px; font-weight: 700; letter-spacing: 3px; margin-top: 50px; display: block; text-align: center; text-transform: uppercase; }
    </style>
`;

const renderLoginPage = (res, error = "") => {
    res.send(`
        ${getPageHeader()}
        <div class="container" style="display:flex; flex-direction:column; justify-content:center; height:80vh;">
            <div class="header">
                <h1 class="main-title">VECTOR</h1>
                <div class="main-subtitle">CORE AUTH</div>
            </div>
            <div class="card">
                <form action="/dashboard/login" method="POST">
                    <input type="password" name="code" placeholder="ACCESS CODE" style="width:100%; background:transparent; border:none; border-bottom:1px solid #222; color:#fff; padding:15px 0; text-align:center; font-size:18px; letter-spacing:10px; outline:none;" required autofocus>
                    <button style="width:100%; background:#fff; border:none; padding:15px; margin-top:30px; font-weight:700; font-size:10px; letter-spacing:2px; cursor:pointer;">EXECUTE</button>
                </form>
                ${error ? `<p style="color:var(--orange); font-size:8px; text-align:center; margin-top:20px; letter-spacing:1px;">${error}</p>` : ''}
            </div>
        </div>
    `);
};

const renderControlPage = (res, devices) => {
    const mainLang = devices[0]?.config?.general?.language || 'ru';
    const mainT = TRANSLATIONS[mainLang] || TRANSLATIONS.ru;

    const devicesHtml = devices.map(d => {
        const led = d.state?.led || { on: false, mode: 'STATIC', speed: 50 };
        const screenOn = d.state?.screen?.on !== false;

        return `
        <div class="card">
            <div class="status-header">
                <div>
                    <div class="device-name">${d.name}</div>
                    <div class="online-status" style="color:${d.is_online ? 'var(--orange)' : '#222'}">${d.is_online ? mainT.online : mainT.offline}</div>
                </div>
                <div style="font-size:8px; color:#222; font-weight:700;">V4.2.0</div>
            </div>

            <div class="power-grid">
                <button class="power-btn ${led.on ? 'active' : ''}" onclick="toggleLight('${d.id}', ${led.on})">LED SYSTEM</button>
                <button class="power-btn ${screenOn ? 'active' : ''}" onclick="toggleScreen('${d.id}', ${screenOn})">CORE SCREEN</button>
            </div>

            <label>Color Palette</label>
            <div class="color-grid">
                ${['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ff9900'].map(hex => `
                    <div class="color-item" style="background:${hex}" onclick="sendHexColor('${d.id}', '${hex}')"></div>
                `).join('')}
                <div class="color-item picker-wrapper">
                    <input type="color" class="picker-input" oninput="sendHexColor('${d.id}', this.value)">
                </div>
            </div>

            <div class="slider-wrap">
                <label>Flow Speed</label>
                <input type="range" min="0" max="100" value="${led.speed || 50}" onchange="sendSpeed('${d.id}', this.value)">
            </div>

            <label>Operation Mode</label>
            <select onchange="sendMode('${d.id}', this.value)">
                <option value="STATIC">SOLID COLOR</option>
                <option value="GEMINI">GEMINI AI</option>
                <option value="SCANNER">RADAR SCAN</option>
                <option value="RAINBOW">SPECTRUM</option>
                <option value="FIRE">FLAME</option>
                <option value="STARS">COSMOS</option>
            </select>
        </div>`;
    }).join('');

    res.send(`
        ${getPageHeader()}
        <div class="container">
            <div class="header">
                <h1 class="main-title">VECTOR</h1>
                <div class="main-subtitle">HARDWARE INTERFACE</div>
            </div>
            ${devicesHtml}
            <a href="/dashboard/logout" class="logout-link">${mainT.logout}</a>
        </div>
        <script>
            const getCookie = (n) => document.cookie.match('(^|;)\\\\s*' + n + '\\\\s*=\\\\s*([^;]+)')?.pop();
            function hexToHsv(hex) {
                let r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
                let max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h, s, v = max;
                if (max === min) h = 0;
                else {
                    switch (max) {
                        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                        case g: h = (b - r) / d + 2; break;
                        case b: h = (r - g) / d + 4; break;
                    }
                    h /= 6;
                }
                return { h: Math.round(h * 360), s: Math.round(max === 0 ? 0 : d / max * 100), v: Math.round(v * 100) };
            }
            async function apiCall(url, body, reload = true) {
                await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getCookie('token') }, body: JSON.stringify(body) });
                if(reload) location.reload();
            }
            const toggleLight = (id, cur) => apiCall('/api/device/'+id, { led: { on: !cur } });
            const toggleScreen = (id, cur) => apiCall('/api/device/'+id, { screen: { on: !cur } });
            const sendMode = (id, mode) => apiCall('/api/device/'+id, { led: { mode } });
            const sendSpeed = (id, val) => apiCall('/api/device/'+id, { led: { speed: parseInt(val) } }, false);
            const sendHexColor = (id, hex) => apiCall('/api/device/'+id, { led: { color: hexToHsv(hex), on: true } }, false);
        </script>
    `);
};

// --- LOGIC EXPORTS ---
export const showDashboard = async (req, res) => {
    const token = req.headers.cookie?.split('token=')[1]?.split(';')[0];
    if (!token) return renderLoginPage(res);
    const userId = await db.getUserByToken(token);
    if (!userId) return renderLoginPage(res, "SESSION EXPIRED");
    const devices = await db.getUserDevices(userId);
    renderControlPage(res, devices);
};

export const handleLogin = async (req, res) => {
    const { code } = req.body;
    const cleanCode = code?.replace(/\s+/g, '');
    const deviceId = await db.getDeviceIdByCode(cleanCode);
    if (!deviceId) return renderLoginPage(res, "INVALID CODE");
    const userId = await db.ensureUserForDevice(deviceId);
    const token = uuidv4();
    await db.saveAccessToken(token, userId);
    await db.deletePendingCode(cleanCode);
    res.setHeader('Set-Cookie', `token=${token}; Path=/; Max-Age=2592000; SameSite=Lax`);
    res.redirect('/dashboard');
};

export const handleLogout = (req, res) => {
    res.setHeader('Set-Cookie', `token=; Path=/; Max-Age=0`);
    res.redirect('/dashboard');
};