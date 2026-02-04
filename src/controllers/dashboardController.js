import { db } from "../services/dbService.js";
import { io } from "../../index.js";
import { v4 as uuidv4 } from "uuid";

// --- 1. АУДАРМАЛАР ---
const TRANSLATIONS = {
    ru: {
        title: "VECTOR PANEL",
        online: "В СЕТИ",
        offline: "ОФФЛАЙН",
        light_title: "УПРАВЛЕНИЕ СВЕТОМ",
        btn_on: "ВКЛЮЧИТЬ",
        btn_off: "ВЫКЛЮЧИТЬ",
        modes: { static: "Статика", breathing: "Дыхание", scanner: "Сканер", rainbow: "Радуга", stars: "Звезды", fire: "Огонь" },
        settings_title: "КОНФИГУРАЦИЯ",
        city: "Город (Weather)",
        lang: "Язык интерфейса",
        timezone: "Часовой пояс",
        save: "СОХРАНИТЬ И ОБНОВИТЬ",
        logout: "Выйти из аккаунта"
    },
    kk: {
        title: "VECTOR ПАНЕЛІ",
        online: "ЖЕЛІДЕ",
        offline: "ӨШІРУЛІ",
        light_title: "ЖАРЫҚТЫ БАСҚАРУ",
        btn_on: "ҚОСУ",
        btn_off: "ӨШІРУ",
        modes: { static: "Тұрақты", breathing: "Тыныс алу", scanner: "Сканер", rainbow: "Кемпірқосақ", stars: "Жұлдыздар", fire: "От" },
        settings_title: "КОНФИГУРАЦИЯ",
        city: "Қала (Ауа райы)",
        lang: "Интерфейс тілі",
        timezone: "Уақыт белдеуі",
        save: "САҚТАУ ЖӘНЕ ЖАҢАРТУ",
        logout: "Аккаунттан шығу"
    }
};

// --- 2. КӨМЕКШІ ФУНКЦИЯЛАР (HTML Templates) ---
const getPageHeader = () => `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        body { background: #0f0f0f; color: #e0e0e0; font-family: 'Inter', -apple-system, sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .card { background: #1a1a1a; border-radius: 20px; padding: 24px; width: 100%; max-width: 400px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 20px; }
        .btn { border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 14px; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }
        .btn-primary { background: #ff9900; color: #000; width: 100%; padding: 16px; }
        .btn-save { background: #222; color: #ff9900; border: 1px solid #ff9900; width: 100%; padding: 14px; margin-top: 10px; }
        .btn:active { transform: scale(0.96); opacity: 0.8; }
        .input-group { margin-bottom: 16px; }
        label { font-size: 11px; color: #777; text-transform: uppercase; margin-bottom: 6px; display: block; letter-spacing: 0.5px; }
        input, select { width: 100%; padding: 12px; background: #252525; border: 1px solid #333; color: #fff; border-radius: 10px; box-sizing: border-box; font-size: 14px; }
        .color-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 15px 0; }
        .color-circle { height: 45px; border-radius: 10px; cursor: pointer; border: 2px solid transparent; }
        .color-circle.active { border-color: #fff; }
        .status { font-size: 11px; padding: 4px 10px; border-radius: 20px; font-weight: bold; }
        .status.online { background: rgba(0,255,0,0.1); color: #00ff00; }
        .status.offline { background: rgba(255,255,255,0.05); color: #666; }
    </style>
`;

const renderLoginPage = (res, error = "") => {
    res.send(`
        ${getPageHeader()}
        <div style="height: 80vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="font-size: 40px; margin-bottom: 10px;">⚡</div>
            <h2 style="color:#ff9900; letter-spacing: 4px; margin-bottom: 30px;">VECTOR</h2>
            <div class="card">
                ${error ? `<p style="color:#ff4444; text-align:center; font-size:14px;">${error}</p>` : ''}
                <form action="/dashboard/login" method="POST">
                    <div class="input-group">
                        <label>Код со стекла айна</label>
                        <input type="text" name="code" placeholder="000 000" inputmode="numeric" required 
                               style="text-align:center; font-size: 24px; letter-spacing: 5px;">
                    </div>
                    <button class="btn btn-primary">Войти в систему</button>
                </form>
            </div>
        </div>
    `);
};

const renderControlPage = (res, devices) => {
    const devicesHtml = devices.map(d => {
        const config = d.config || {};
        const gen = config.general || { city: 'Almaty', language: 'ru', timezone: 'Asia/Almaty' };
        const L = TRANSLATIONS[gen.language] || TRANSLATIONS.ru;
        const led = d.state?.led || { on: false, mode: 'STATIC', color: { h: 0, s: 100, v: 100 } };
        
        return `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="margin:0; font-size:18px;">${d.name}</h3>
                <span class="status ${d.is_online ? 'online' : 'offline'}">
                    ${d.is_online ? L.online : L.offline}
                </span>
            </div>

            <label>${L.light_title}</label>
            <button class="btn btn-primary" style="background: ${led.on ? '#ff9900' : '#333'}; color: ${led.on ? '#000' : '#fff'}"
                    onclick="toggleLight('${d.id}', ${led.on})">
                ${led.on ? L.btn_off : L.btn_on}
            </button>

            <div class="color-grid">
                ${['#FF0000', '#00FF00', '#0000FF', '#FFA500', '#FFFFFF'].map(hex => `
                    <div class="color-circle" style="background:${hex}" onclick="sendHexColor('${d.id}', '${hex}')"></div>
                `).join('')}
            </div>

            <select onchange="sendMode('${d.id}', this.value)">
                ${Object.entries(L.modes).map(([val, name]) => `
                    <option value="${val.toUpperCase()}" ${led.mode === val.toUpperCase() ? 'selected' : ''}>${name}</option>
                `).join('')}
            </select>

            <div style="margin: 25px 0 15px; border-top: 1px solid #333; padding-top: 20px;">
                <label>${L.settings_title}</label>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                    <div class="input-group">
                        <label>${L.city}</label>
                        <input type="text" id="city_${d.id}" value="${gen.city}">
                    </div>
                    <div class="input-group">
                        <label>${L.lang}</label>
                        <select id="lang_${d.id}">
                            <option value="ru" ${gen.language === 'ru' ? 'selected' : ''}>Русский</option>
                            <option value="kk" ${gen.language === 'kk' ? 'selected' : ''}>Қазақша</option>
                        </select>
                    </div>
                </div>
                <div class="input-group">
                    <label>${L.timezone}</label>
                    <select id="tz_${d.id}">
                        <option value="Asia/Almaty" ${gen.timezone === 'Asia/Almaty' ? 'selected' : ''}>Almaty (GMT+5)</option>
                        <option value="Asia/Aqtobe" ${gen.timezone === 'Asia/Aqtobe' ? 'selected' : ''}>Aqtobe (GMT+5)</option>
                        <option value="Europe/Moscow" ${gen.timezone === 'Europe/Moscow' ? 'selected' : ''}>Moscow (GMT+3)</option>
                    </select>
                </div>
                <button class="btn btn-save" onclick="saveSettings('${d.id}')">${L.save}</button>
            </div>
        </div>`;
    }).join('');

    res.send(`
        ${getPageHeader()}
        <script>
            const getCookie = (n) => document.cookie.match('(^|;)\\\\s*' + n + '\\\\s*=\\\\s*([^;]+)')?.pop();

            async function apiCall(url, body) {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + getCookie('token')
                    },
                    body: JSON.stringify(body)
                });
                if (res.ok) location.reload();
            }

            const toggleLight = (id, cur) => apiCall('/api/device/'+id, { led: { on: !cur } });
            const sendMode = (id, mode) => apiCall('/api/device/'+id, { led: { mode } });
            
            const sendHexColor = (id, hex) => {
                const colors = {
                    '#FF0000': {h:0, s:100, v:100},
                    '#00FF00': {h:120, s:100, v:100},
                    '#0000FF': {h:240, s:100, v:100},
                    '#FFA500': {h:38, s:100, v:100},
                    '#FFFFFF': {h:0, s:0, v:100}
                };
                apiCall('/api/device/'+id, { led: { color: colors[hex], on: true } });
            };

            function saveSettings(id) {
                const data = {
                    city: document.getElementById('city_'+id).value,
                    language: document.getElementById('lang_'+id).value,
                    timezone: document.getElementById('tz_'+id).value,
                    showWeather: true
                };
                apiCall('/api/device/' + id + '/settings', data);
            }
        </script>
        <h2 style="color:#ff9900; margin: 10px 0 30px; letter-spacing: 2px;">VECTOR HUB</h2>
        ${devicesHtml}
        <a href="/dashboard/logout" style="color:#555; text-decoration:none; font-size:12px; margin-bottom: 40px;">${TRANSLATIONS.ru.logout}</a>
    `);
};

// --- 3. EXPORTED LOGIC ---

export const showDashboard = async (req, res) => {
    const token = req.headers.cookie?.split('token=')[1]?.split(';')[0];
    if (!token) return renderLoginPage(res);

    const userId = await db.getUserByToken(token);
    if (!userId) return renderLoginPage(res, "Сессия устарела, войдите снова");

    const devices = await db.getUserDevices(userId);
    renderControlPage(res, devices);
};

export const handleLogin = async (req, res) => {
    const { code } = req.body;
    if (!code) return renderLoginPage(res, "Введите код");
    
    const cleanCode = code.replace(/\s+/g, '');
    const deviceId = await db.getDeviceIdByCode(cleanCode);
    
    if (!deviceId) return renderLoginPage(res, "Код не найден или устарел");

    const userId = await db.ensureUserForDevice(deviceId);
    const token = uuidv4();
    
    await db.saveAccessToken(token, userId);
    await db.deletePendingCode(cleanCode);

    // Cookie сақтау: JS оқи алуы үшін HttpOnly жоқ, қауіпсіздік үшін SameSite=Lax
    res.setHeader('Set-Cookie', `token=${token}; Path=/; Max-Age=2592000; SameSite=Lax`);
    res.redirect('/dashboard');
};

export const handleLogout = (req, res) => {
    res.setHeader('Set-Cookie', `token=; Path=/; Max-Age=0`);
    res.redirect('/dashboard');
};