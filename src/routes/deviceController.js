import db, { saveDB } from '../services/dbService.js';
import { sendCommand } from '../services/mqttService.js';

export const getDevices = (req, res) => {
    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            user_id: req.deviceId,
            devices: [{
                id: req.deviceId,
                name: "Зеркало Вектор",
                type: "devices.types.light",
                capabilities: [{ type: "devices.capabilities.on_off", retrievable: true, reportable: true }]
            }]
        }
    });
};

export const actionDevices = (req, res) => {
    const isOn = req.body.payload.devices[0].capabilities[0].state.value;
    db.deviceStates[req.deviceId] = isOn;
    saveDB();
    
    sendCommand(req.deviceId, isOn ? "ON" : "OFF");
    
    res.json({
        request_id: req.headers['x-request-id'],
        payload: {
            devices: [{
                id: req.deviceId,
                capabilities: [{ 
                    type: "devices.capabilities.on_off", 
                    state: { instance: "on", action_result: { status: "DONE" } } 
                }]
            }]
        }
    });
};