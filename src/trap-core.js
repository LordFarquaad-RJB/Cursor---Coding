// src/trap-core.js
// Core configuration and state for TrapSystem v2

export const Config = {
  DEBUG: false,
  DEFAULT_GRID_SIZE: 70,
  DEFAULT_SCALE: 5,
  MIN_MOVEMENT_FACTOR: 0.1,
  aura: {
    TARGET_RADIUS_GRID_UNITS: 1.0,   // default aura size in GU
    VISIBILITY_BOOST_GU: 0.2        // extra radius so aura is always visible
  },
  AURA_COLORS: {
    ARMED: '#ff0000',           // Red for armed traps
    ARMED_INTERACTION: '#ff8800', // Orange for armed interaction traps
    DISARMED: '#808080',        // Gray for disarmed traps
    DISARMED_INTERACTION: '#a0a0a0', // Light gray for disarmed interaction traps
    PAUSED: '#ffff00',          // Yellow for paused traps
    TRIGGERED: '#ff00ff',       // Magenta for triggered traps
    DEPLETED: '#000000',        // Black for depleted traps
    LOCKED: '#00ffff',          // Cyan for locked tokens
    DETECTION: '#0000ff',       // Blue for detection range
    DETECTED: '#00ff00',        // Green for detected traps
    DISARMED_DETECTED: '#90ee90', // Light green for disarmed detected traps
    DISARMED_UNDETECTED: '#d3d3d3', // Light gray for disarmed undetected traps
    PASSIVE_DISABLED: '#800080'  // Purple for passive detection disabled
  },
  SKILL_TYPES: {
    'acrobatics': '🤸',
    'animal_handling': '�',
    'arcana': '🔮',
    'athletics': '💪',
    'deception': '🎭',
    'history': '📚',
    'insight': '👁️',
    'intimidation': '😠',
    'investigation': '🔍',
    'medicine': '⚕️',
    'nature': '🌿',
    'perception': '👀',
    'performance': '🎪',
    'persuasion': '💬',
    'religion': '⛪',
    'sleight_of_hand': '✋',
    'stealth': '🥷',
    'survival': '🏕️',
    'thieves_tools': '�',
    'strength': '',
    'dexterity': '🤸',
    'constitution': '❤️',
    'intelligence': '🧠',
    'wisdom': '🦉',
    'charisma': '✨'
  },
  messages: {
    templates: {
      PLAYER_ALERT: "⚠️ Alert!",
      GM_SPOT: "🎯 Passive Spot"
    },
    defaults: {
      playerNotice: "You notice something suspicious nearby. Take a closer look?",
      gmNotice: "{charName} (PP {charPP}) spotted {trapName} (DC {trapDC}) at {distanceToTrap}ft."
    },
    placeholders: {
      charName: "Character's name",
      trapName: "Trap's name",
      charPP: "Character's passive perception",
      trapDC: "Trap's detection DC",
      distanceToTrap: "Distance to trap in feet",
      luckBonus: "Luck bonus applied",
      basePP: "Base passive perception before bonuses"
    },
    passiveNoticeDebounceTime: 100000 // 100 seconds
  }
};

// Simple central state store (will be fleshed out later)
export const State = {
  warnedInvalidGridPages: {},
  pendingChecks: {},           // GM playerid -> pending check data
  pendingChecksByChar: {},     // character id -> pending check data  
  displayDCForCheck: {},       // playerid -> boolean (show DC in menus)
  lockedTokens: {},           // token id -> lock data
  triggersEnabled: true,       // global trigger state
  safeMoveTokens: new Set(),
  passivelyNoticedTraps: {},
  recentlyNoticedPlayerMessages: {},
  detectionAurasTemporarilyHidden: false,
  hideAurasTimeout: null
};

export const core = {
  Config,
  State
};

export default core;