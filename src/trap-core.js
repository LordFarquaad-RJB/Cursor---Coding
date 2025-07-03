// src/trap-core.js
// Core configuration and state for TrapSystem v2

export const Config = {
  DEBUG: false,
  DEFAULT_GRID_SIZE: 70,
  DEFAULT_SCALE: 5,
  MIN_MOVEMENT_FACTOR: 0.3,
  aura: {
    TARGET_RADIUS_GRID_UNITS: 1.0,   // default aura size in GU
    VISIBILITY_BOOST_GU: 0.3        // extra radius so aura is always visible
  },
  AURA_COLORS: {
    ARMED: '#00ff00',
    ARMED_INTERACTION: '#6aa84f',
    DISARMED: '#ff0000',
    DISARMED_INTERACTION: '#a61c00',
    PAUSED: '#ffa500',
    DETECTION: '#808080',
    DETECTED: '#c0c0c0',
    DISARMED_UNDETECTED: '#00008B',
    DISARMED_DETECTED: '#A9A9A9',
    DETECTION_OFF: '#222222',
    PASSIVE_DISABLED: '#5b0f00'
  },
  SKILL_TYPES: {
    'Flat Roll': '🎲',
    Acrobatics: '🤸',
    'Animal Handling': '🐎',
    Arcana: '✨',
    Athletics: '💪',
    Deception: '🎭',
    History: '📚',
    Insight: '👁️',
    Intimidation: '😠',
    Investigation: '🔍',
    Medicine: '⚕️',
    Nature: '🌿',
    Perception: '👀',
    Performance: '🎪',
    Persuasion: '💬',
    Religion: '⛪',
    'Sleight of Hand': '🎯',
    Stealth: '👥',
    Survival: '🏕️',
    'Strength Check': '💪',
    'Strength Saving Throw': '🛡️💪',
    'Dexterity Check': '🤸',
    'Dexterity Saving Throw': '🛡️🤸',
    'Constitution Check': '🏋️',
    'Constitution Saving Throw': '🛡️🏋️',
    'Intelligence Check': '🧠',
    'Intelligence Saving Throw': '🛡️🧠',
    'Wisdom Check': '👁️',
    'Wisdom Saving Throw': '🛡️👁️',
    'Charisma Check': '💬',
    'Charisma Saving Throw': '🛡️💬'
  }
};

// Simple central state store (will be fleshed out later)
export const State = {
  warnedInvalidGridPages: {},
  pendingChecks: {},           // GM playerid -> pending check data
  pendingChecksByChar: {},     // character id -> pending check data  
  displayDCForCheck: {},       // playerid -> boolean (show DC in menus)
  lockedTokens: {},           // token id -> lock data
  triggersEnabled: true       // global trigger state
};

export const core = {
  Config,
  State
};

export default core;