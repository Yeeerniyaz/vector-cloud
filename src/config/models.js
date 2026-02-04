// src/config/models.js

export const DEVICE_MODELS = {
    'vector_a1': {
        name: 'Vector A1', 
        
        // Яндекс пен Dashboard осы subDevices арқылы 2 құрылғы көреді
        subDevices: {
            
            // --- 1-ҚҰРЫЛҒЫ: LED ЛЕНТА ---
            led: {
                name_suffix: " Light", // Алисада "Vector Light" болады
                type: "devices.types.light", 
                capabilities: [
                    // 1. Қосу/Өшіру
                    { 
                        type: "devices.capabilities.on_off",
                        parameters: { split: false }
                    },
                    // 2. Түс (RGB/HSV) - Static, Breathing, Scanner үшін керек
                    { 
                        type: "devices.capabilities.color_setting", 
                        parameters: { color_model: "hsv" } 
                    },
                    // 3. Режимдер (LedControl.jsx тізімімен бірдей)
                    { 
                        type: "devices.capabilities.mode", 
                        parameters: { 
                            instance: "program", // Алисаға "Включи режим X" деу үшін
                            modes: [
                                // PRO
                                { value: "GEMINI", name: "Джемини" },
                                { value: "SCANNER", name: "Сканер" },
                                { value: "BREATHING", name: "Дыхание" },
                                { value: "STROBE", name: "Стробоскоп" },
                                
                                // CLASSIC
                                { value: "FIRE", name: "Огонь" },
                                { value: "STARS", name: "Звезды" },
                                { value: "METEOR", name: "Метеор" },
                                { value: "RAINBOW", name: "Радуга" },
                                { value: "POLICE", name: "Полиция" },
                                
                                // BASIC
                                { value: "STATIC", name: "Статика" }
                            ] 
                        } 
                    }
                ]
            },

            // --- 2-ҚҰРЫЛҒЫ: МОНИТОР (ЭКРАН) ---
            screen: {
                name_suffix: " Screen", // Алисада "Vector Screen" болады
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