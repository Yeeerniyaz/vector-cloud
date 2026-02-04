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
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Inter:wght@300;600;900&display=swap" rel="stylesheet">
    <style>
        :root { --orange: #ff9900; --bg: #000; --card: #050505; --border: #111; }
        body { background: var(--bg); color: #fff; font-family: 'Inter', sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; -webkit-tap-highlight-color: transparent; }
        .container { width: 100%; max-width: 400px; }
        
        .header { text-align: left; margin-bottom: 50px; padding-left: 15px; border-left: 4px solid var(--orange); }
        .main-title { font-family: 'Orbitron', sans-serif; font-size: 30px; letter-spacing: 10px; margin: 0; font-weight: 700; }
        .main-subtitle { font-size: 8px; letter-spacing: 5px; color: var(--orange); font-weight: 900; margin-top: 6px; }

        .card { background: var(--card); border: 1px solid var(--border); padding: 35px 25px; margin-bottom: 20px; position: relative; }
        
        .status-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 45px; }
        .device-name { font-size: 13px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; color: #fff; }
        .online-status { font-size: 7px; font-weight: 900; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase; }

        .control-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); margin-bottom: 40px; }
        .ctrl-btn { background: var(--bg); border: none; color: #333; padding: 22px; cursor: pointer; font-size: 9px; font-weight: 900; letter-spacing: 2px; transition: 0.2s; text-transform: uppercase; }
        .ctrl-btn.active { color: var(--orange); background: #080808; text-shadow: 0 0 10px rgba(255,153,0,0.5); }

        label { font-size: 8px; color: #333; text-transform: uppercase; font-weight: 900; display: block; margin-bottom: 18px; letter-spacing: 3px; }

        .palette { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 40px; }
        .color-node { height: 38px; cursor: pointer; border: 1px solid transparent; transition: 0.2s; position: relative; }
        .color-node:active { transform: scale(0.9); }
        .custom-node { background: conic-gradient(red, yellow, green, cyan, blue, magenta, red); border: 1px solid #222; }
        .color-input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }

        .slider-box { margin-bottom: 40px; }
        input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; cursor: pointer; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 1px; background: #222; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; background: var(--orange); margin-top: -8px; border: 4px solid var(--bg); box-shadow: 0 0 10px rgba(255,153,0,0.3); }

        select { width: 100%; padding: 18px; background: var(--bg); border: 1px solid var(--border); color: #fff; font-family: 'Orbitron', sans-serif; font-size: 9px; letter-spacing: 3px; outline: none; appearance: none; text-align-last: center; cursor: pointer; }

        .logout { color: #1a1a1a; text-decoration: none; font-size: 7px; font-weight: 900; letter-spacing: 4px; margin-top: 60px; display: block; text-align: center; text-transform: uppercase; transition: 0.3s; }
        .logout:hover { color: #ff4444; }
    </style>
`;

const renderLoginPage = (res, error = "") => {
    res.send(`
        ${getPageHeader()}
        <div class="container" style="display:flex; flex-direction:column; justify-content:center; height:85vh;">
            <div class="header">
                <h1 class="main-title">VECTOR</h1>
                <div class="main-subtitle">AUTHENTICATION REQUIRED</div>
            </div>
            <div class="card" style="padding: 50px 30px;">
                <form action="/dashboard/login" method="POST">
                    <input type="password" name="code" placeholder="---" style="width:100%; background:transparent; border:none; border-bottom:2px solid #111; color:#fff; padding:15px 0; text-align:center; font-size:24px; letter-spacing:15px; outline:none; font-family:'Orbitron';" required autofocus>
                    <button style="width:100%; background:#fff; border:none; padding:18px; margin-top:40px; font-weight:900; font-size:9px; letter-spacing:4px; cursor:pointer; font-family:'Inter'; text-transform:uppercase;">Authorize</button>
                </form>
                ${error ? `<p style="color:var(--orange); font-size:7px; text-align:center; margin-top:25px; letter-spacing:2px; font-weight:900;">${error}</p>` : ''}
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
                <div style="font-size:7px; color:#1a1a1a; font-weight:900; letter-spacing:2px;">SYS_V4.2</div>
            </div>

            <div class="control-grid">
                <button class="ctrl-btn ${led.on ? 'active' : ''}" onclick="toggleLight('${d.id}', ${led.on})">LED_ARRAY</button>
                <button class="ctrl-btn ${screenOn ? 'active' : ''}" onclick="toggleScreen('${d.id}', ${screenOn})">MONITOR</button>
            </div>

            <label>Color_Index</label>
            <div class="palette">
                ${['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ff9900'].map(hex => `
                    <div class="color-node" style="background:${hex}" onclick="sendHexColor('${d.id}', '${hex}')"></div>
                `).join('')}
                <div class="color-node custom-node">
                    <input type="color" class="color-input" oninput="sendHexColor('${d.id}', this.value)">
                </div>
            </div>

            <div class="slider-box">
                <label>Cycle_Velocity</label>
                <input type="range" min="0" max="100" value="${led.speed || 50}" onchange="sendSpeed('${d.id}', this.value)">
            </div>

            <label>Execution_Mode</label>
            <select onchange="sendMode('${d.id}', this.value)">
                <option value="STATIC" ${led.mode === 'STATIC' ? 'selected' : ''}>SOLID_STATE</option>
                <option value="GEMINI" ${led.mode === 'GEMINI' ? 'selected' : ''}>GEMINI_NEURAL</option>
                <option value="SCANNER" ${led.mode === 'SCANNER' ? 'selected' : ''}>RADAR_SCAN</option>
                <option value="RAINBOW" ${led.mode === 'RAINBOW' ? 'selected' : ''}>SPECTRUM_SHIFT</option>
                <option value="FIRE" ${led.mode === 'FIRE' ? 'selected' : ''}>THERMAL_FLAME</option>
                <option value="STARS" ${led.mode === 'STARS' ? 'selected' : ''}>DEEP_SPACE</option>
            </select>
        </div>`;
    }).join('');

    res.send(`
        ${getPageHeader()}
        <div class="container">
            <div class="header">
                <h1 class="main-title">VECTOR</h1>
                <div class="main-subtitle">HARDWARE_REMOTE_V2</div>
            </div>
            ${devicesHtml}
            <a href="/dashboard/logout" class="logout">${mainT.logout}</a>
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
            const sendMode = (id, mode) => apiCall('/api/device/'+id, { led: { mode } }, false);
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