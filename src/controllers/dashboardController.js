import { db } from "../services/dbService.js";
import { io } from "../../index.js";
import { v4 as uuidv4 } from "uuid";

// --- 1. АУДАРМАЛАР МЕН РЕЖИМДЕР ---
const TRANSLATIONS = {
    ru: {
        title: "VECTOR PANEL",
        online: "В СЕТИ",
        offline: "ОФФЛАЙН",
        light_title: "УПРАВЛЕНИЕ СВЕТОМ",
        btn_on: "ВКЛЮЧИТЬ",
        btn_off: "ВЫКЛЮЧИТЬ",
        screen_title: "ЭКРАН (HDMI)",
        settings_title: "КОНФИГУРАЦИЯ",
        city: "Город (Weather)",
        lang: "Язык интерфейса",
        save: "СОХРАНИТЬ",
        logout: "Выйти",
        brightness: "Яркость",
        speed: "Скорость",
        modes: {
            GEMINI: "GEMINI",
            SCANNER: "СКАНЕР",
            BREATHING: "ДЫХАНИЕ",
            STROBE: "СТРОБО",
            FIRE: "ОГОНЬ",
            STARS: "ЗВЕЗДЫ",
            METEOR: "МЕТЕОР",
            RAINBOW: "РАДУГА",
            POLICE: "ПОЛИЦИЯ",
            STATIC: "СТАТИКА"
        }
    },
    kk: {
        title: "VECTOR ПАНЕЛІ",
        online: "ЖЕЛІДЕ",
        offline: "ӨШІРУЛІ",
        light_title: "ЖАРЫҚТЫ БАСҚАРУ",
        btn_on: "ҚОСУ",
        btn_off: "ӨШІРУ",
        screen_title: "ЭКРАН (HDMI)",
        settings_title: "КОНФИГУРАЦИЯ",
        city: "Қала (Ауа райы)",
        lang: "Интерфейс тілі",
        save: "САҚТАУ",
        logout: "Шығу",
        brightness: "Жарықтық",
        speed: "Жылдамдық",
        modes: {
            GEMINI: "GEMINI",
            SCANNER: "СКАНЕР",
            BREATHING: "ТЫНЫС АЛУ",
            STROBE: "СТРОБО",
            FIRE: "ӨРТ",
            STARS: "ЖҰЛДЫЗ",
            METEOR: "МЕТЕОР",
            RAINBOW: "КЕМПІРҚОСАҚ",
            POLICE: "ПОЛИЦИЯ",
            STATIC: "ТҰРАҚТЫ"
        }
    }
};

// --- 2. HTML СТИЛЬДЕРІ ---
const getPageHeader = () => `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        body { background: #000; color: #fff; font-family: -apple-system, sans-serif; margin: 0; padding: 15px; display: flex; flex-direction: column; align-items: center; }
        .card { background: #050505; border: 1px solid #222; border-radius: 12px; padding: 20px; width: 100%; max-width: 500px; box-sizing: border-box; margin-bottom: 20px; }
        .title { font-size: 24px; letter-spacing: 6px; text-transform: uppercase; color: #fff; font-weight: 300; margin-bottom: 5px; }
        .subtitle { font-size: 10px; letter-spacing: 3px; color: #666; font-weight: 700; margin-bottom: 25px; }
        label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 10px; letter-spacing: 1px; }
        .btn { border: 1px solid #333; background: transparent; color: #fff; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px; transition: 0.2s; width: 100%; text-transform: uppercase; outline: none; }
        .btn-active { background: #fff; color: #000; border-color: #fff; }
        .color-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
        .color-item { height: 45px; border-radius: 8px; cursor: pointer; border: 1px solid #222; }
        select, input { width: 100%; padding: 12px; background: #000; border: 1px solid #222; color: #fff; border-radius: 8px; margin-bottom: 15px; font-size: 14px; box-sizing: border-box; outline: none; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; margin: 10px 0; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: #222; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; border-radius: 50%; background: #fff; cursor: pointer; margin-top: -7px; }
    </style>
`;

const renderLoginPage = (res, error = "") => {
    res.send(`
        ${getPageHeader()}
        <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%;">
            <h1 class="title">VECTOR</h1>
            <p class="subtitle">SYSTEM LOGIN</p>
            <div class="card">
                ${error ? `<p style="color:red; font-size:12px; text-align:center;">${error}</p>` : ''}
                <form action="/dashboard/login" method="POST">
                    <input type="text" name="code" placeholder="ENTER CODE" style="text-align:center; font-size:20px; letter-spacing:4px;" required>
                    <button class="btn btn-active">LOGIN</button>
                </form>
            </div>
        </div>
    `);
};

const renderControlPage = (res, devices) => {
    const devicesHtml = devices.map(d => {
        const config = d.config || {};
        const gen = config.general || { city: 'Almaty', language: 'ru' };
        const T = TRANSLATIONS[gen.language] || TRANSLATIONS.ru;
        const led = d.state?.led || { on: false, mode: 'STATIC', brightness: 128, speed: 50 };
        const screenOn = d.state?.screen?.on !== false;

        return `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:25px;">
                <div>
                    <div style="font-size:10px; font-weight:700; color:${d.is_online ? '#0f0' : '#444'}">${d.is_online ? T.online : T.offline}</div>
                    <div style="font-size:18px; font-weight:700; margin-top:5px; letter-spacing:1px;">${d.name}</div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn ${led.on ? 'btn-active' : ''}" style="width:70px; padding:8px;" onclick="toggleLight('${d.id}', ${led.on})">LED</button>
                    <button class="btn ${screenOn ? 'btn-active' : ''}" style="width:70px; padding:8px;" onclick="toggleScreen('${d.id}', ${screenOn})">SCR</button>
                </div>
            </div>

            <label>${T.light_title} - ПАЛИТРА</label>
            <div class="color-grid">
                ${['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffa500'].map(hex => `
                    <div class="color-item" style="background:${hex}" onclick="sendHexColor('${d.id}', '${hex}')"></div>
                `).join('')}
            </div>

            <div class="grid-2">
                <div>
                    <label>${T.brightness}</label>
                    <input type="range" min="0" max="255" value="${led.brightness || 128}" onchange="sendBrightness('${d.id}', this.value)">
                </div>
                <div>
                    <label>${T.speed}</label>
                    <input type="range" min="0" max="100" value="${led.speed || 50}" onchange="sendSpeed('${d.id}', this.value)">
                </div>
            </div>

            <label>АНИМАЦИЯ</label>
            <select onchange="sendMode('${d.id}', this.value)">
                ${Object.entries(T.modes).map(([val, name]) => `
                    <option value="${val}" ${led.mode === val ? 'selected' : ''}>${name}</option>
                `).join('')}
            </select>

            <div style="border-top: 1px solid #222; margin-top: 10px; padding-top: 20px;">
                <label>${T.settings_title}</label>
                <div class="grid-2">
                    <div>
                        <label>${T.city}</label>
                        <input type="text" id="city_${d.id}" value="${gen.city}">
                    </div>
                    <div>
                        <label>${T.lang}</label>
                        <select id="lang_${d.id}">
                            <option value="ru" ${gen.language === 'ru' ? 'selected' : ''}>Русский</option>
                            <option value="kk" ${gen.language === 'kk' ? 'selected' : ''}>Қазақша</option>
                        </select>
                    </div>
                </div>
                <button class="btn" style="border-color:#444" onclick="saveSettings('${d.id}')">${T.save}</button>
            </div>
        </div>`;
    }).join('');

    res.send(`
        ${getPageHeader()}
        <script>
            const getCookie = (n) => document.cookie.match('(^|;)\\\\s*' + n + '\\\\s*=\\\\s*([^;]+)')?.pop();

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
            const sendBrightness = (id, val) => apiCall('/api/device/'+id, { led: { brightness: parseInt(val) } }, false);
            const sendSpeed = (id, val) => apiCall('/api/device/'+id, { led: { speed: parseInt(val) } }, false);
            
            const sendHexColor = (id, hex) => {
                const colors = {
                    '#ffffff': {h:0, s:0, v:100},
                    '#ff0000': {h:0, s:100, v:100},
                    '#00ff00': {h:120, s:100, v:100},
                    '#0000ff': {h:240, s:100, v:100},
                    '#ffa500': {h:38, s:100, v:100}
                };
                apiCall('/api/device/'+id, { led: { color: colors[hex], on: true } });
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
        <div class="title" style="margin-top:20px;">VECTOR</div>
        <div class="subtitle">CONTROL HUB</div>
        ${devicesHtml}
        <a href="/dashboard/logout" style="color:#444; text-decoration:none; font-size:10px; margin-top:20px; font-weight:700;">LOGOUT</a>
    `);
};

// --- 3. EXPORT LOGIC ---
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