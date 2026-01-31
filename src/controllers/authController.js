import { v4 as uuidv4 } from "uuid";
import db, { saveDB } from "../services/dbService.js";

export const renderAuthPage = (req, res) => {
  // Получаем UUID из URL (который пришел из QR-кода зеркала)
  const deviceUuid = req.query.uuid || "";

  res.send(`
        <body style="background:#000;color:#ff9900;text-align:center;padding:50px;font-family:sans-serif;">
            <h1 style="letter-spacing: 5px;">VECTOR OS</h1>
            <p>Привязка устройства: <b>${deviceUuid || "Неизвестное устройство"}</b></p>
            <form action="/login" method="post">
                <input type="hidden" name="state" value="${req.query.state || ""}">
                <input type="hidden" name="redirect_uri" value="${req.query.redirect_uri || ""}">
                <input type="hidden" name="device_id" value="${deviceUuid}">
                <button style="padding:15px 40px;background:#ff9900;border:none;cursor:pointer;font-weight:bold;border-radius:10px;">
                    ПОДТВЕРДИТЬ ПРИВЯЗКУ
                </button>
            </form>
        </body>`);
};

export const handleLogin = (req, res) => {
  const { state, redirect_uri, device_id } = req.body;
  if (!device_id)
    return res
      .status(400)
      .send("Ошибка: UUID устройства не найден. Отсканируйте QR заново.");

  const code = uuidv4();
  db.authCodes[code] = device_id; // Привязываем временный код к UUID
  saveDB();
  res.redirect(`${redirect_uri}?state=${state}&code=${code}`);
};

export const handleToken = (req, res) => {
  const deviceId = db.authCodes[req.body.code];
  if (!deviceId) return res.status(400).json({ error: "invalid_code" });

  const accessToken = uuidv4();
  db.tokens[accessToken] = deviceId; // Теперь токен Яндекса навсегда привязан к UUID зеркала
  saveDB();

  res.json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 31536000,
  });
};

export const unlink = async (req, res) => {
  const requestId = req.headers["x-request-id"] || "no-id";
  console.log(`🔌 Yandex Unlink Request: ${requestId}`);

  // Отвечаем Яндексу, что всё ок, аккаунт отвязан
  res.status(200).json({
    request_id: requestId,
  });
};
