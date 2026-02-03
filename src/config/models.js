// src/config/models.js

/**
 * DEVICE_MODELS
 * Айнаның "паспорты". 
 * Мұнда Vector A1 екі бөлек виртуалды құрылғыға (LED және Screen) бөлінген.
 */

export const DEVICE_MODELS = {
    'vector_a1': {
        name: 'Vector A1', // Базадағы жалпы атауы
        
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
                    // 2. Түс (RGB/HSV) - Кейбір режимдер үшін керек (Static, Breathing...)
                    { 
                        type: "devices.capabilities.color_setting", 
                        parameters: { color_model: "hsv" } 
                    },
                    // 3. Режимдер (Сенің тізімің)
                    { 
                        type: "devices.capabilities.mode", 
                        parameters: { 
                            instance: "program", // Алисаға "Включи режим X" деу үшін
                            modes: [
                                // PRO режимер
                                { value: "GEMINI", name: "Gemini" },
                                { value: "SCANNER", name: "Сканер" },
                                { value: "BREATHING", name: "Дыхание" },
                                { value: "STROBE", name: "Стробо" },
                                
                                // CLASSIC режимдер
                                { value: "FIRE", name: "Огонь" },
                                { value: "STARS", name: "Звезды" },
                                { value: "METEOR", name: "Метеор" },
                                { value: "RAINBOW", name: "Радуга" },
                                { value: "POLICE", name: "Полиция" },
                                
                                // BASIC режимдер
                                { value: "STATIC", name: "Статика" }
                            ] 
                        } 
                    }
                ]
            },

            // --- 2-ҚҰРЫЛҒЫ: МОНИТОР (ЭКРАН) ---
            screen: {
                name_suffix: " Screen", // Алисада "Vector Screen" болады
                type: "devices.types.switch", // Типі: Ажыратқыш
                capabilities: [
                    // Экранның питаниесін басқару (HDMI CEC немесе Relay)
                    { 
                        type: "devices.capabilities.on_off",
                        parameters: { split: false }
                    }
                ]
            }
        }
    }
};

// Егер айна моделін айтпаса, осыны қолданамыз
export const DEFAULT_MODEL = 'vector_a1';