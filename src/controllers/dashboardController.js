import { db } from "../services/dbService.js";
import { io } from "../../index.js";
import { v4 as uuidv4 } from "uuid";

// --- 1. АУДАРМАЛАР (СӨЗДІК) ---
const TRANSLATIONS = {
    ru: {
        title: "МОИ ЗЕРКАЛА",
        online: "В СЕТИ",
        offline: "ОФФЛАЙН",
        light_title: "ОСВЕЩЕНИЕ",
        btn_on: "ВКЛЮЧИТЬ СВЕТ",
        btn_off: "ВЫКЛЮЧИТЬ СВЕТ",
        modes: { static: "Статика", breathing: "Дыхание", scanner: "Сканер", rainbow: "Радуга", stars: "Звезды", fire: "Огонь" },
        settings_title: "НАСТРОЙКИ",
        city: "Город",
        lang: "Язык",
        timezone: "Часовой пояс",
        save: "СОХРАНИТЬ НАСТРОЙКИ",
        logout: "Выйти"
    },
    kk: {
        title: "МЕНІҢ АЙНАЛАРЫМ",
        online: "ЖЕЛІДЕ",
        offline: "ӨШІРУЛІ",
        light_title: "ЖАРЫҚ",
        btn_on: "ЖАРЫҚТЫ ҚОСУ",
        btn_off: "ЖАРЫҚТЫ ӨШІРУ",
        modes: { static: "Тұрақты", breathing: "Тыныс алу", scanner: "Сканер", rainbow: "Кемпірқосақ", stars: "Жұлдыздар", fire: "От" },
        settings_title: "БАПТАУЛАР",
        city: "Қала",
        lang: "Тіл",
        timezone: "Уақыт белдеуі",
        save: "САҚТАУ",
        logout: "Шығу"
    },
    en: {
        title: "MY MIRRORS",
        online: "ONLINE",
        offline: "OFFLINE",
        light_title: "LIGHTING",
        btn_on: "TURN ON",
        btn_off: "TURN OFF",
        modes: { static: "Static", breathing: "Breathing", scanner: "Scanner", rainbow: "Rainbow", stars: "Stars", fire: "Fire" },
        settings_title: "SETTINGS",
        city: "City",
        lang: "Language",
        timezone: "Timezone",
        save: "SAVE SETTINGS",
        logout: "Log Out"
    }
};

// --- 2. HTML: Логин беті ---
const renderLoginPage = (res, error = "") => {
    res.send(`
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <body style="background:#111;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
            <h2 style="color:#ff9900;letter-spacing:2px;">VECTOR CONTROL</h2>
            ${error ? `<p style="color:red">${error}</p>` : ''}
            <form action="/dashboard/login" method="POST" style="display:flex;flex-direction:column;gap:10px;">
                <input type="text" name="code" placeholder="Код (123 456)" style="padding:15px;border-radius:10px;border:none;text-align:center;font-size:18px;" required>
                <button style="padding:15px;background:#ff9900;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">LOGIN</button>
            </form>
        </body>
    `);
};

// --- 3. HTML: Басқару панелі ---
const renderControlPage = (res, devices) => {
    const devicesHtml = devices.map(d => {
        const config = d.config || {};
        const general = config.general || { city: 'Almaty', language: 'ru', timezone: 'Asia/Almaty' };
        const currentLang = general.language || 'ru';
        
        const T = TRANSLATIONS[currentLang] || TRANSLATIONS.ru;
        const state = d.state?.led || {};
        
        return `
        <div style="background:#222;padding:20px;border-radius:15px;margin-bottom:20px;width:90%;max-width:500px;border: 1px solid #333;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:1px solid #444;padding-bottom:10px;">
                <h3 style="margin:0;color:#ff9900;">${d.name}</h3>
                <span style="font-size:12px;color:${d.is_online ? '#0f0' : '#888'};">
                    ${d.is_online ? '● ' + T.online : '○ ' + T.offline}
                </span>
            </div>

            <h4 style="color:#aaa;margin:10px 0;font-size:12px;">${T.light_title}</h4>
            <button onclick="sendCommand('${d.id}', 'led', {on: ${!state.on}})" 
                style="width:100%;padding:15px;background:${state.on ? '#ff9900' : '#444'};border:none;border-radius:10px;color:#fff;font-weight:bold;margin-bottom:10px;">
                ${state.on ? T.btn_off : T.btn_on}
            </button>

            <div style="display:flex;gap:5px;margin-bottom:10px;">
                ${['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#FFA500'].map(c => `
                    <div onclick="sendColor('${d.id}', '${c}')" style="flex:1;height:40px;background:${c};border-radius:8px;cursor:pointer;border:1px solid #444;"></div>
                `).join('')}
            </div>

            <select onchange="sendMode('${d.id}', this.value)" style="width:100%;padding:10px;border-radius:10px;background:#333;color:#fff;border:1px solid #555;">
                <option value="STATIC" ${state.mode === 'STATIC' ? 'selected' : ''}>${T.modes.static}</option>
                <option value="BREATHING" ${state.mode === 'BREATHING' ? 'selected' : ''}>${T.modes.breathing}</option>
                <option value="SCANNER" ${state.mode === 'SCANNER' ? 'selected' : ''}>${T.modes.scanner}</option>
                <option value="RAINBOW" ${state.mode === 'RAINBOW' ? 'selected' : ''}>${T.modes.rainbow}</option>
                <option value="STARS" ${state.mode === 'STARS' ? 'selected' : ''}>${T.modes.stars}</option>
                <option value="FIRE" ${state.mode === 'FIRE' ? 'selected' : ''}>${T.modes.fire}</option>
            </select>

            <h4 style="color:#aaa;margin:15px 0 10px 0;border-top:1px solid #444;padding-top:10px;font-size:12px;">${T.settings_title}</h4>
            
            <div style="display:grid;grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                <div>
                    <label style="font-size:11px;color:#888;display:block;margin-bottom:3px;">${T.city}</label>
                    <input type="text" id="city_${d.id}" value="${general.city}" 
                        style="width:100%;padding:10px;background:#333;border:1px solid #555;color:#fff;border-radius:8px;box-sizing:border-box;">
                </div>

                <div>
                    <label style="font-size:11px;color:#888;display:block;margin-bottom:3px;">${T.lang}</label>
                    <select id="lang_${d.id}" style="width:100%;padding:10px;background:#333;border:1px solid #555;color:#fff;border-radius:8px;box-sizing:border-box;">
                        <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>Русский</option>
                        <option value="kk" ${currentLang === 'kk' ? 'selected' : ''}>Қазақша</option>
                        <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-size:11px;color:#888;display:block;margin-bottom:3px;">${T.timezone}</label>
                <select id="tz_${d.id}" style="width:100%;padding:10px;background:#333;border:1px solid #555;color:#fff;border-radius:8px;box-sizing:border-box;">
                    <option value="Asia/Almaty" ${general.timezone === 'Asia/Almaty' ? 'selected' : ''}>Asia/Almaty (+5)</option>
                    <option value="Asia/Oral" ${general.timezone === 'Asia/Oral' ? 'selected' : ''}>Asia/Oral (+4)</option>
                    <option value="Europe/Moscow" ${general.timezone === 'Europe/Moscow' ? 'selected' : ''}>Europe/Moscow (+3)</option>
                </select>
            </div>

            <button onclick="saveSettings('${d.id}')" 
                style="width:100%;padding:15px;background:#007bff;border:none;border-radius:10px;color:#fff;font-weight:bold;cursor:pointer;">
                ${T.save}
            </button>

        </div>`;
    }).join('');

    const firstDevLang = devices[0]?.config?.general?.language || 'ru';
    const MainT = TRANSLATIONS[firstDevLang] || TRANSLATIONS.ru;

    res.send(`
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            select, input { outline: none; }
            button:active { opacity: 0.8; transform: scale(0.98); }
        </style>
        <script>
            function getCookie(name) {
                const value = \`; \${document.cookie}\`;
                const parts = value.split(\`; \${name}=\`);
                if (parts.length === 2) return parts.pop().split(';').shift();
            }

            function sendCommand(realId, subKey, payload) {
                // HttpOnly алынған соң, енді getCookie('token') істейтін болады
                fetch('/api/device/' + realId, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getCookie('token')},
                    body: JSON.stringify({ [subKey]: payload })
                }).then(() => location.reload());
            }

            function sendColor(id, hex) {
                sendCommand(id, 'led', { color: { h: 0, s: 100, v: 100 } }); 
            }

            function sendMode(id, mode) {
                sendCommand(id, 'led', { mode: mode });
            }

            function saveSettings(id) {
                const city = document.getElementById('city_' + id).value;
                const language = document.getElementById('lang_' + id).value;
                const timezone = document.getElementById('tz_' + id).value;

                fetch('/api/device/' + id + '/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getCookie('token')},
                    body: JSON.stringify({ city, language, timezone, showWeather: true })
                }).then(res => res.json())
                  .then(data => {
                      if(data.success) {
                          alert('OK! Refreshing...');
                          location.reload(); 
                      } else {
                          alert('Error!');
                      }
                  });
            }
        </script>
        <body style="background:#111;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;padding:20px;margin:0;">
            <h2 style="color:#ff9900;margin-bottom:20px;letter-spacing:1px;">${MainT.title}</h2>
            ${devicesHtml}
            <a href="/dashboard/logout" style="margin-top:20px;color:#666;text-decoration:none;font-size:12px;">${MainT.logout}</a>
        </body>
    `);
};

// --- LOGIC ---

export const showDashboard = async (req, res) => {
    const token = req.headers.cookie?.split('token=')[1]?.split(';')[0];
    if (!token) return renderLoginPage(res);

    const userId = await db.getUserByToken(token);
    if (!userId) return renderLoginPage(res, "Session expired");

    const devices = await db.getUserDevices(userId);
    renderControlPage(res, devices);
};

export const handleLogin = async (req, res) => {
    const { code } = req.body;
    const cleanCode = code.replace(/\s+/g, '');
    const deviceId = await db.getDeviceIdByCode(cleanCode);
    if (!deviceId) return renderLoginPage(res, "Invalid Code");

    const userId = await db.ensureUserForDevice(deviceId);
    const token = uuidv4();
    await db.saveAccessToken(token, userId);
    await db.deletePendingCode(cleanCode);

    // 🔴 МАҢЫЗДЫ ӨЗГЕРІС: 'HttpOnly' алып тастадық. 
    // Енді браузердегі JS мұны оқи алады.
    res.setHeader('Set-Cookie', `token=${token}; Path=/; Max-Age=2592000`);
    
    res.redirect('/dashboard');
};

export const handleLogout = (req, res) => {
    res.setHeader('Set-Cookie', `token=; Path=/; Max-Age=0`);
    res.redirect('/dashboard');
};