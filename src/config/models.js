// src/config/models.js

export const DEVICE_MODELS = {
    'vector_a1': {
        name: 'Vector A1', 
        subDevices: {
            // 1. ЖАРЫҚ (Типін нақтылап жазамыз)
            led: {
                name_suffix: " Свет", 
                type: "devices.types.light", // Яндекс үшін бұл "Лампа"
                capabilities: [
                    { 
                        type: "devices.capabilities.on_off",
                        parameters: { split: false }
                    },
                    { 
                        type: "devices.capabilities.color_setting", 
                        parameters: { color_model: "hsv" } 
                    },
                    { 
                        type: "devices.capabilities.mode", 
                        parameters: { 
                            instance: "program", 
                            modes: [
                                { value: "GEMINI" },
                                { value: "SCANNER" },
                                { value: "BREATHING" },
                                { value: "STROBE" },
                                { value: "FIRE" },
                                { value: "STARS" },
                                { value: "METEOR" },
                                { value: "RAINBOW" },
                                { value: "POLICE" },
                                { value: "STATIC" }
                            ] 
                        } 
                    }
                ]
            },
            // 2. ЭКРАН (Switch типі жақсырақ)
            screen: {
                name_suffix: " Экран", 
                type: "devices.types.switch",
                capabilities: [
                    { 
                        type: "devices.capabilities.on_off",
                        parameters: { split: false }
                    }
                ]
            }
        }
    }
};

export const DEFAULT_MODEL = 'vector_a1';