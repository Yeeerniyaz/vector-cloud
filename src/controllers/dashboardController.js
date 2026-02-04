import { db } from "../services/dbService.js";
import { io } from "../../index.js";
import { v4 as uuidv4 } from "uuid";

// --- 1. АУДАРМАЛАР ---
const TRANSLATIONS = {
    ru: {
        title: "VECTOR",
        subtitle: "CONTROL INTERFACE",
        online: "SYSTEM ONLINE",
        offline: "DISCONNECTED",
        light_title: "ILLUMINATION",
        screen_title: "MONITOR",
        speed: "ANIMATION SPEED",
        settings: "SYSTEM CONFIG",
        city: "LOCATION",
        lang: "LANGUAGE",
        save: "APPLY CHANGES",
        logout: "TERMINATE SESSION",
        modes: {
            GEMINI: "GEMINI AI",
            SCANNER: "RADAR SCAN",
            BREATHING: "PULSE",
            STROBE: "STROBE",
            FIRE: "FLAME",
            STARS: "COSMOS",
            METEOR: "METEOR",
            RAINBOW: "SPECTRUM",
            POLICE: "EMERGENCY",
            STATIC: "SOLID COLOR"
        }
    },
    kk: {
        title: "VECTOR",
        subtitle: "БАСҚАРУ ЖҮЙЕСІ",
        online: "ЖҮЙЕ ҚОСУЛЫ",
        offline: "БАЙЛАНЫС ЖОҚ",
        light_title: "ЖАРЫҚ ПАНЕЛІ",
        screen_title: "ДИСПЛЕЙ",
        speed: "АНИМАЦИЯ ЖЫЛДАМДЫҒЫ",
        settings: "ЖҮЙЕ БАПТАУЫ",
        city: "ЛОКАЦИЯ",
        lang: "ТІЛ",
        save: "САҚТАУ",
        logout: "ШЫҒУ",
        modes: {
            GEMINI: "GEMINI AI",
            SCANNER: "РАДАР",
            BREATHING: "ТЫНЫС АЛУ",
            STROBE: "СТРОБО",
            FIRE: "ӨРТ",
            STARS: "ЖҰЛДЫЗДАР",
            METEOR: "МЕТЕОР",
            RAINBOW: "СПЕКТР",
            POLICE: "ПОЛИЦИЯ",
            STATIC: "ТҰРАҚТЫ"
        }
    }
};

const getPageHeader = () => `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Inter:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root { --orange: #ff9900; --dark-bg: #0a0a0a; --glass: rgba(255, 255, 255, 0.03); --border: rgba(255, 255, 255, 0.1); }
        body { background: var(--dark-bg); color: #fff; font-family: 'Inter', sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        
        .container { width: 100%; max-width: 450px; }
        
        .header { text-align: center; margin-bottom: 40px; }
        .main-title { font-family: 'Orbitron', sans-serif; font-size: 32px; letter-spacing: 12px; color: #fff; margin: 0; text-shadow: 0 0 20px rgba(255,153,0,0.3); }
        .main-subtitle { font-size: 9px; letter-spacing: 5px; color: var(--orange); font-weight: 700; margin-top: 8px; opacity: 0.8; }

        .card { background: var(--glass); border: 1px solid var(--border); border-radius: 24px; padding: 24px; margin-bottom: 25px; backdrop-filter: blur(10px); position: relative; overflow: hidden; }
        .card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--orange); }

        .status-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .device-info .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; box-shadow: 0 0 10px currentColor; }
        .device-name { font-weight: 700; font-size: 18px; letter-spacing: 1px; }

        .control-group { display: flex; gap: 12px; }
        .action-btn { background: var(--glass); border: 1px solid var(--border); color: #fff; padding: 12px 18px; border-radius: 12px; cursor: pointer; font-size: 10px; font-weight: 800; letter-spacing: 1px; transition: 0.3s; }
        .action-btn.active { background: var(--orange); color: #000; border-color: var(--orange); box-shadow: 0 0 20px rgba(255,153,0,0.4); }

        label { font-size: 9px; color: #666; text-transform: uppercase; font-weight: 800; display: block; margin: 20px 0 12px 2px; letter-spacing: 2px; }

        .color-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
        .color-item { height: 40px; border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.15); transition: 0.2s; position: relative; }
        .color-item:active { transform: scale(0.9); }
        .picker-wrapper { background: conic-gradient(red, yellow, green, cyan, blue, magenta, red); }
        .picker-input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }

        input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; height: 30px; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 2px; background: #333; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: var(--orange); cursor: pointer; margin-top: -9px; box-shadow: 0 0 10px rgba(255,153,0,0.5); border: 4px solid var(--dark-bg); }

        select, input[type=text] { width: 100%; padding: 16px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: #fff; border-radius: 14px; font-size: 13px; font-family: inherit; transition: 0.3s; }
        select:focus, input[type=text]:focus { border-color: var(--orange); outline: none; background: rgba(255,255,255,0.08); }

        .save-btn { background: #fff; color: #000; border: none; padding: 16px; border-radius: 14px; width: 100%; font-weight: 800; font-size: 12px; letter-spacing: 2px; cursor: pointer; margin-top: 10px; transition: 0.3s; }
        .save-btn:hover { background: var(--orange); }

        .logout-link { color: #444; text-decoration: none; font-size: 10px; font-weight: 700; letter-spacing: 2px; margin-top: 40px; transition: 0.3s; }
        .logout-link:hover { color: #ff4444; }
    </style>
`;

const renderControlPage = (res, devices) => {
    const devicesHtml = devices.map(d => {
        const config = d.config || {};
        const gen = config.general || { city: 'Almaty', language: 'ru' };
        const T = TRANSLATIONS[gen.language] || TRANSLATIONS.ru;
        const led = d.state?.led || { on: false, mode: 'STATIC', speed: 50 };
        const screenOn = d.state?.screen?.on !== false;

        return `
        <div class="card">
            <div class="status-bar">
                <div class="device-info">
                    <span class="status-dot" style="color:${d.is_online ? '#0f0' : '#ff4444'}"></span>
                    <span class="device-name">${d.name}</span>
                    <div style="font-size:9px; color:#444; margin-top:4px; letter-spacing:1px;">ID: ${d.id.slice(0,8).toUpperCase()}</div>
                </div>
                <div class="control-group">
                    <button class="action-btn ${led.on ? 'active' : ''}" onclick="toggleLight('${d.id}', ${led.on})">LED</button>
                    <button class="action-btn ${screenOn ? 'active' : ''}" onclick="toggleScreen('${d.id}', ${screenOn})">SCR</button>
                </div>
            </div>

            <label>${T.light_title}</label>
            <div class="color-grid">
                ${['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ff9900'].map(hex => `
                    <div class="color-item" style="background:${hex}" onclick="sendHexColor('${d.id}', '${hex}')"></div>
                `).join('')}
                <div class="color-item picker-wrapper">
                    <input type="color" class="picker-input" oninput="sendHexColor('${d.id}', this.value)">
                    <div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:16px;">🎨</div>
                </div>
            </div>

            <label>${T.speed}</label>
            <input type="range" min="0" max="100" value="${led.speed || 50}" onchange="sendSpeed('${d.id}', this.value)">

            <label>MODES</label>
            <select onchange="sendMode('${d.id}', this.value)">
                ${Object.entries(T.modes).map(([val, name]) => `
                    <option value="${val}" ${led.mode === val ? 'selected' : ''}>${name}</option>
                `).join('')}
            </select>

            <label style="margin-top:30px; opacity:0.3">${T.settings}</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div>
                    <input type="text" id="city_${d.id}" value="${gen.city}" placeholder="${T.city}">
                </div>
                <div>
                    <select id="lang_${d.id}">
                        <option value="ru" ${gen.language === 'ru' ? 'selected' : ''}>RU</option>
                        <option value="kk" ${gen.language === 'kk' ? 'selected' : ''}>KZ</option>
                    </select>
                </div>
            </div>
            <button class="save-btn" onclick="saveSettings('${d.id}')">${T.save}</button>
        </div>`;
    }).join('');

    res.send(`
        ${getPageHeader()}
        <div class="container">
            <div class="header">
                <h1 class="main-title">VECTOR</h1>
                <div class="main-subtitle">CONTROL HUB V2.0</div>
            </div>
            
            ${devicesHtml}

            <center>
                <a href="/dashboard/logout" class="logout-link">${TRANSLATIONS.ru.logout}</a>
            </center>
        </div>

        <script>
            const getCookie = (n) => document.cookie.match('(^|;)\\\\s*' + n + '\\\\s*=\\\\s*([^;]+)')?.pop();

            function hexToHsv(hex) {
                let r = parseInt(hex.slice(1, 3), 16) / 255;
                let g = parseInt(hex.slice(3, 5), 16) / 255;
                let b = parseInt(hex.slice(5, 7), 16) / 255;
                let max = Math.max(r, g, b), min = Math.min(r, g, b);
                let h, s, v = max;
                let d = max - min;
                s = max === 0 ? 0 : d / max;
                if (max === min) { h = 0; }
                else {
                    switch (max) {
                        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                        case g: h = (b - r) / d + 2; break;
                        case b: h = (r - g) / d + 4; break;
                    }
                    h /= 6;
                }
                return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
            }

            async function apiCall(url, body, reload = true) {
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getCookie('token') },
                    body: JSON.stringify(body)
                });
                if(reload) location.reload();
            }

            const toggleLight = (id, cur) => apiCall('/api/device/'+id, { led: { on: !cur } });
            const toggleScreen = (id, cur) => apiCall('/api/device/'+id, { screen: { on: !cur } });
            const sendMode = (id, mode) => apiCall('/api/device/'+id, { led: { mode } });
            const sendSpeed = (id, val) => apiCall('/api/device/'+id, { led: { speed: parseInt(val) } }, false);
            
            const sendHexColor = (id, hex) => {
                const hsv = hexToHsv(hex);
                apiCall('/api/device/'+id, { led: { color: hsv, on: true } }, false);
            };

            function saveSettings(id) {
                const data = {
                    city: document.getElementById('city_'+id).value,
                    language: document.getElementById('lang_'+id).value,
                    timezone: "Asia/Almaty",
                    showWeather: true
                };
                apiCall('/api/device/' + id + '/settings', data);
            }
        </script>
    `);
};

// --- REST OF LOGIC (showDashboard, handleLogin, handleLogout) ---
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