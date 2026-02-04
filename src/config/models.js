// src/config/models.js
export const DEVICE_MODELS = {
    'vector_a1': {
        name: 'Vector Smart Mirror', 
        type: 'devices.types.light', // Алиса бірден "Лампа" деп таниды
        capabilities: [
            { 
                type: "devices.capabilities.on_off",
                retrievable: true,
                reportable: true
            },
            { 
                type: "devices.capabilities.color_setting", 
                parameters: { color_model: "hsv" },
                retrievable: true,
                reportable: true
            },
            { 
                type: "devices.capabilities.mode", 
                parameters: { 
                    instance: "program", 
                    modes: [
                        { value: "GEMINI" }, { value: "SCANNER" }, { value: "BREATHING" },
                        { value: "STROBE" }, { value: "FIRE" }, { value: "STARS" },
                        { value: "METEOR" }, { value: "RAINBOW" }, { value: "POLICE" }, { value: "STATIC" }
                    ] 
                },
                retrievable: true,
                reportable: true
            }
        ]
    }
};
export const DEFAULT_MODEL = 'vector_a1';