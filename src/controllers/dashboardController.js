import { db } from "../services/dbService.js";
import { io } from "../../index.js";
import { v4 as uuidv4 } from "uuid";

// --- 1. АУДАРМАЛАР ЖӘНЕ РЕЖИМДЕР ---
const TRANSLATIONS = {
    ru: {
        title: "VECTOR PANEL",
        online: "В СЕТИ",
        offline: "ОФФЛАЙН",
        light_title: "УПРАВЛЕНИЕ СВЕТОМ",
        btn_on: "ВКЛЮЧИТЬ",
        btn_off: "ВЫКЛЮЧИТЬ",
        settings_title: "КОНФИГУРАЦИЯ",
        city: "Город (Weather)",
        lang: "Язык интерфейса",
        timezone: "Часовой пояс",
        save: "СОХРАНИТЬ",
        logout: "Выйти",
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
        settings_title: "КОНФИГУРАЦИЯ",
        city: "Қала (Ауа райы)",
        lang: "Интерфейс тілі",
        timezone: "Уақыт белдеуі",
        save: "САҚТАУ",
        logout: "Шығу",
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

// --- 2. HTML ТЕГИ (Стильдер) ---
const getPageHeader = () => `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        body { background: #000; color: #fff; font-family: sans-serif; margin: 0; padding: 15px; display: flex; flex-direction: column; align-items: center; }
        .card { background: #050505; border: 1px solid #222; border-radius: 12px; padding: 20px; width: 100%; max-width: 500px; box-sizing: border-box; margin-bottom: 20px; }
        .title { font-size: 24px; letter-spacing: 6px; text-transform: uppercase; color: #fff; font-weight: 300; margin-bottom: 5px; }
        .subtitle { font-size: 10px; letter-spacing: 3px; color: #666; font-weight: 700; margin-bottom: 20px; }
        label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 8px; letter-spacing: 1px; }
        .btn { border: 1px solid #333; background: transparent; color: #666; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px; transition: 0.2s; width: 100%; text-transform: uppercase; }
        .btn-on { background: #fff; color: #000; border-color: #fff; }
        .color-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 15px; }
        .color-item { height: 40px; border-radius: 6px; cursor: pointer; border: 1px solid #222; }
        select, input { width: 100%; padding: 12px; background: #000; border: 1px solid #222; color: #fff; border-radius: 8px; margin-bottom: 15px; font-size: 14px; box-sizing: border-box; }
        .status { font-size: 10px; font-weight: 700; letter-spacing: 1px; }
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
                    <button class="btn btn-on">LOGIN</button>
                </form>
            </div>
        </div>
    `);
};

const renderControlPage = (res, devices) => {
    const devicesHtml = devices.map(d => {
        const config = d.config || {};
        const gen = config.general || { city: 'Almaty', language: 'ru', timezone: 'Asia/Almaty' };
        const T = TRANSLATIONS[gen.language] || TRANSLATIONS.ru;
        const state = d.state?.led || { on: false, mode: 'STATIC' };

        return `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
                <div>
                    <div class="status" style="color:${d.is_online ? '#0f0' : '#444'}">${d.is_online ? T.online : T.offline}</div>
                    <div style="font-size:18px; font-weight:700; margin-top:5px;">${d.name}</div>
                </div>
                <button class="btn ${state.on ? 'btn-on' : ''}" style="width:80px; padding:8px;" onclick="toggleLight('${d.id}', ${state.on})">
                    ${state.on ? 'OFF' : 'ON'}
                </button>
            </div>

            <label>Палитра цветов</label>
            <div class="color-grid">
                ${['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffa500'].map(hex => `
                    <div class="color-item" style="background:${hex}" onclick="sendHexColor('${d.id}', '${hex}')"></div>
                `).join('')}
            </div>

            <label>Анимация</label>
            <select onchange="sendMode('${d.id}', this.value)">
                ${Object.entries(T.modes).map(([val, name]) => `
                    <option value="${val}" ${state.mode === val ? 'selected' : ''}>${name}</option>
                `).join('')}
            </select>

            <div style="border-top: 1px solid #222; margin-top: 10px; padding-top: 20px;">
                <label>${T.settings_title}</label>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
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
                <button class="btn" style="color:#fff; border-color:#444" onclick="saveSettings('${d.id}')">${T.save}</button>
            </div>
        </div>`;
    }).join('');

    res.send(`
        ${getPageHeader()}
        <script>
            const getCookie = (n) => document.cookie.match('(^|;)\\\\s*' + n + '\\\\s*=\\\\s*([^;]+)')?.pop();

            async function apiCall(url, body) {
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getCookie('token') },
                    body: JSON.stringify(body)
                });
                location.reload();
            }

            const toggleLight = (id, cur) => apiCall('/api/device/'+id, { led: { on: !cur } });
            const sendMode = (id, mode) => apiCall('/api/device/'+id, { led: { mode } });
            
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
        <a href="/dashboard/logout" style="color:#333; text-decoration:none; font-size:10px; margin-top:20px; font-weight:700;">LOGOUT</a>
    `);
};

// --- 3. ЛОГИКА ---

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