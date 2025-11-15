/**
 * Configuration for all interactive simulation controls
 * Defines control types, behaviors, and metadata in a centralized location
 */

/**
 * Custom control types with specialized behaviors
 */
export const ControlTypes = {
    NUMBER: 'number',
    ANGLE: 'angle',      // Number with wrapping behavior (-180 to 180)
    BOOLEAN: 'boolean',
    SELECT: 'select'
};

/**
 * Base control definition
 * @typedef {Object} ControlDefinition
 * @property {string} id - Unique identifier for the control
 * @property {string} label - Display label for UI
 * @property {string} type - Control type from ControlTypes
 * @property {*} defaultValue - Default value
 * @property {number} [min] - Minimum value (for number/angle types)
 * @property {number} [max] - Maximum value (for number/angle types)
 * @property {number} [step] - Step increment (for number/angle types)
 * @property {string} [unit] - Display unit (e.g., '°', 'm/s', '%')
 * @property {Array} [options] - Options array for select type
 * @property {boolean} [canBeDisabled] - Whether control can be disabled
 * @property {Function} [normalize] - Custom normalization function for value
 * @property {Function} [validate] - Custom validation function
 */

/**
 * Normalize angle values to -180 to 180 range
 * @param {number} value - Input angle value
 * @returns {number} Normalized angle
 */
function normalizeAngle(value) {
    let normalized = value % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized < -180) normalized += 360;
    return normalized;
}

/**
 * Apply relative adjustment to angle with wrapping
 * @param {number} currentValue - Current angle value
 * @param {number} adjustment - Adjustment amount
 * @returns {number} New angle value
 */
function adjustAngle(currentValue, adjustment) {
    const newValue = currentValue + adjustment;
    return normalizeAngle(newValue);
}

/**
 * Main controls configuration
 * Add new controls here to automatically generate UI and behaviors
 */
export const CONTROLS_CONFIG = {
    bankAngle: {
        id: 'bankAngle',
        label: 'BANK ANGLE',
        type: ControlTypes.ANGLE,
        defaultValue: 0,
        min: -180,
        max: 180,
        step: 1,
        unit: '°',
        canBeDisabled: true,
        normalize: normalizeAngle,
        adjust: adjustAngle,
        keyboardShortcuts: {
            increase: ['d', 'D'],
            decrease: ['a', 'A']
        },
        keyboardStep: 5, // degrees per keypress
        stateKey: 'bankAngle', // Key in simulation state
        historyKey: 'bankingHistory' // Key for storing adjustment history
    }
    
    // Future controls can be added here, for example:
    // angleOfAttack: {
    //     id: 'angleOfAttack',
    //     label: 'ANGLE OF ATTACK',
    //     type: ControlTypes.ANGLE,
    //     defaultValue: -16,
    //     min: -30,
    //     max: 30,
    //     step: 0.5,
    //     unit: '°',
    //     canBeDisabled: true,
    //     normalize: normalizeAngle,
    //     adjust: adjustAngle,
    //     keyboardShortcuts: {
    //         increase: ['w', 'W'],
    //         decrease: ['s', 'S']
    //     },
    //     keyboardStep: 1,
    //     stateKey: 'angleOfAttack',
    //     historyKey: 'angleOfAttackHistory'
    // },
    
    // throttle: {
    //     id: 'throttle',
    //     label: 'THROTTLE',
    //     type: ControlTypes.NUMBER,
    //     defaultValue: 0,
    //     min: 0,
    //     max: 100,
    //     step: 1,
    //     unit: '%',
    //     canBeDisabled: true,
    //     keyboardShortcuts: {
    //         increase: ['=', '+'],
    //         decrease: ['-', '_']
    //     },
    //     keyboardStep: 5,
    //     stateKey: 'throttle',
    //     historyKey: 'throttleHistory'
    // }
};

/**
 * Get control configuration by ID
 * @param {string} controlId - Control identifier
 * @returns {ControlDefinition|null} Control configuration or null
 */
export function getControlConfig(controlId) {
    return CONTROLS_CONFIG[controlId] || null;
}

/**
 * Get all control IDs
 * @returns {string[]} Array of control IDs
 */
export function getAllControlIds() {
    return Object.keys(CONTROLS_CONFIG);
}

/**
 * Get default values for all controls
 * @returns {Object} Object with control IDs as keys and default values
 */
export function getDefaultControlValues() {
    const defaults = {};
    for (const [id, config] of Object.entries(CONTROLS_CONFIG)) {
        defaults[id] = config.defaultValue;
    }
    return defaults;
}

/**
 * Validate control value against configuration
 * @param {string} controlId - Control identifier
 * @param {*} value - Value to validate
 * @returns {boolean} Whether value is valid
 */
export function validateControlValue(controlId, value) {
    const config = CONTROLS_CONFIG[controlId];
    if (!config) return false;
    
    // Custom validation if provided
    if (config.validate) {
        return config.validate(value);
    }
    
    // Type-based validation
    switch (config.type) {
        case ControlTypes.NUMBER:
        case ControlTypes.ANGLE:
            if (typeof value !== 'number' || isNaN(value)) return false;
            if (config.min !== undefined && value < config.min) return false;
            if (config.max !== undefined && value > config.max) return false;
            return true;
            
        case ControlTypes.BOOLEAN:
            return typeof value === 'boolean';
            
        case ControlTypes.SELECT:
            return config.options && config.options.includes(value);
            
        default:
            return true;
    }
}

/**
 * Normalize control value according to its type
 * @param {string} controlId - Control identifier
 * @param {*} value - Value to normalize
 * @returns {*} Normalized value
 */
export function normalizeControlValue(controlId, value) {
    const config = CONTROLS_CONFIG[controlId];
    if (!config) return value;
    
    if (config.normalize) {
        return config.normalize(value);
    }
    
    return value;
}

/**
 * Apply relative adjustment to control value
 * @param {string} controlId - Control identifier
 * @param {*} currentValue - Current value
 * @param {number} adjustment - Adjustment amount
 * @returns {*} New value
 */
export function adjustControlValue(controlId, currentValue, adjustment) {
    const config = CONTROLS_CONFIG[controlId];
    if (!config) return currentValue;
    
    // Use custom adjust function if provided
    if (config.adjust) {
        return config.adjust(currentValue, adjustment);
    }
    
    // Default adjustment for numeric types
    if (config.type === ControlTypes.NUMBER || config.type === ControlTypes.ANGLE) {
        let newValue = currentValue + adjustment;
        
        // Clamp to min/max if defined
        if (config.min !== undefined) newValue = Math.max(config.min, newValue);
        if (config.max !== undefined) newValue = Math.min(config.max, newValue);
        
        return newValue;
    }
    
    return currentValue;
}
