var TrapSystem = (function (exports) {
  'use strict';

  // src/trap-core.js
  // Core configuration and state for TrapSystem v2

  const Config = {
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
  const State = {
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
    hideAurasTimeout: null,
    macroExportedMacros: [],
    macroExportStates: {},
    macroExportDoorStates: {},
    macroExportTokensOrderedToFront: [],
    macroExportTokensOrderedToBack: [],
    macroExportRecordOrdering: false
  };

  // src/trap-utils.js
  // Shared helper functions used across TrapSystem modules.
  // Initially contains only a subset (quick-win helpers) – we will migrate
  // the rest of the giant utils object here piece-by-piece.


  function log(message, type = 'info') {
    const prefix = {
      info: '📜',
      error: '❌',
      success: '✅',
      warning: '⚠️',
      debug: '🔍'
    }[type] || '📜';
    console.log(`${prefix} TrapSystem: ${message}`);
  }

  // Quick-win utility #1 – centralised trap-token validation
  function validateTrapToken(token, actionName = 'action') {
    if (!token) {
      log(`Error: No token supplied for ${actionName}.`, 'error');
      return false;
    }
    if (!globalThis.TrapSystem || !globalThis.TrapSystem.utils || typeof globalThis.TrapSystem.utils.isTrap !== 'function') {
      // During early bootstrap the monolith may not be loaded. We simply assume OK.
      return true;
    }
    if (!globalThis.TrapSystem.utils.isTrap(token)) {
      log(`Error: Selected token is not a trap. (${actionName})`, 'error');
      return false;
    }
    return true;
  }

  // Quick-win utility #2 – parameter length guard for chat commands
  function validateCommandArgs(args, minLength, commandName = 'command') {
    if (args.length < minLength) {
      log(`Error: Missing parameters for ${commandName}.`, 'error');
      return false;
    }
    return true;
  }

  const TrapUtils = {
    log,
    validateTrapToken,
    validateCommandArgs
  };

  // ------------------------------------------------------------------
  // Legacy util functions migrated from v1 (minimal initial subset)
  // ------------------------------------------------------------------

  // NOTE: These still rely on Roll20 API globals (getObj, sendChat, etc.) –
  // that is OK because after bundling they run inside the Roll-20 sandbox.

  function playerIsGM(playerId) {
    const player = getObj && getObj('player', playerId);
    if (!player) return false;
    return player.get('_online') && player.get('_type') === 'player' && player.get('_isGM');
  }

  function chat(message) {
    if (typeof message !== 'string') return;
    sendChat('TrapSystem', `/w gm ${message}`);
  }

  function getGMPlayerIds() {
    const allPlayers = findObjs ? findObjs({ _type: 'player' }) : [];
    return allPlayers.filter(p => playerIsGM(p.id)).map(p => p.id);
  }

  function whisper(recipientId, message) {
    if (!recipientId || !message) return;
    // First assume playerId
    const player = getObj && getObj('player', recipientId);
    if (player) {
      sendChat('TrapSystem', `/w "${player.get('displayname')}" ${message}`);
      return;
    }
    // Maybe a token representing a character → whisper to controllers.
    const token = getObj && getObj('graphic', recipientId);
    if (token && token.get('represents')) {
      const char = getObj('character', token.get('represents'));
      if (char) {
        const controllers = (char.get('controlledby') || '').split(',').map(s => s.trim()).filter(Boolean);
        controllers.forEach(pid => {
          const p = getObj('player', pid);
          if (p) sendChat('TrapSystem', `/w "${p.get('displayname')}" ${message}`);
        });
        return;
      }
    }
    // Fallback to GM
    chat(`Could not find a valid recipient for ID ${recipientId}. Msg: ${message}`);
  }

  function decodeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Quick check to see if a token is a trap (based on gmnotes)
  function isTrap(token) {
    if (!token) return false;
    const notes = token.get ? token.get('gmnotes') : '';
    if (!notes) return false;
    let decoded = '';
    try { decoded = decodeURIComponent(notes); } catch (e) { decoded = notes; }
    return decoded.includes('!traptrigger');
  }

  // Utility for images (used by menus)
  function getTokenImageURL(token, size = 'med') {
    if (!token) return '👤';
    const sanitize = url => {
      if (!url) return null;
      let processed = url.replace(/(thumb|max)(?=\.[^/]+$)/, size);
      processed = processed.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27').replace(/"/g, '%22');
      return processed;
    };
    let img = token.get('imgsrc');
    if (!img) {
      const charId = token.get('represents');
      if (charId) {
        const char = getObj('character', charId);
        if (char) {
          img = char.get('avatar') || char.get('imgsrc');
        }
      }
    }
    const sanitized = sanitize(img);
    return sanitized || '👤';
  }

  // Build a tag-to-ID map for macro replacement
  function buildTagToIdMap$1(trapToken, trappedToken, extraTokens) {
    const map = {};
    if (trapToken) map.trap = trapToken.id || trapToken;
    if (trappedToken) map.trapped = trappedToken.id || trappedToken;
    if (extraTokens && typeof extraTokens === 'object') {
      Object.keys(extraTokens).forEach(tag => {
        const val = extraTokens[tag];
        map[tag] = val && val.id ? val.id : val;
      });
    }
    return map;
  }

  // Execute a macro with tag replacement
  function executeMacro$1(commandString, tagToIdMap = {}) {
    if (!commandString || typeof commandString !== 'string') return false;
    
    let processedCommand = commandString.trim();
    
    // Handle macro references (#MacroName)
    if (processedCommand.startsWith('#')) {
      const macroName = processedCommand.substring(1);
      const macro = findObjs({ _type: 'macro', name: macroName })[0];
      if (macro) {
        processedCommand = macro.get('action');
      } else {
        log(`Macro "${macroName}" not found`, 'error');
        return false;
      }
    }
    
    // Handle disguised commands ($command -> !command)
    if (processedCommand.startsWith('$')) {
      processedCommand = '!' + processedCommand.substring(1);
    }
    
    // Handle disguised templates (^{template} -> &{template})
    if (processedCommand.startsWith('^')) {
      processedCommand = '&' + processedCommand.substring(1);
    }
    
    // Replace tags with IDs
    for (const [tag, tokenId] of Object.entries(tagToIdMap)) {
      if (tokenId) {
        const escapedTag = escapeRegExp(tag);
        const tagRegex = new RegExp(`<&${escapedTag}>`, 'g');
        processedCommand = processedCommand.replace(tagRegex, tokenId);
      }
    }
    
    // Remove quotes if the entire command is wrapped in them
    if (processedCommand.startsWith('"') && processedCommand.endsWith('"')) {
      processedCommand = processedCommand.slice(1, -1);
    }
    
    try {
      // Execute the command
      if (processedCommand.startsWith('!')) {
        // API command
        sendChat('TrapSystem', processedCommand);
      } else if (processedCommand.startsWith('&{template:')) {
        // Roll template
        sendChat('TrapSystem', processedCommand);
      } else {
        // Plain text
        sendChat('TrapSystem', processedCommand);
      }
      return true;
    } catch (error) {
      log(`Error executing macro: ${error.message}`, 'error');
      return false;
    }
  }

  // Merge into export object
  Object.assign(TrapUtils, {
    playerIsGM,
    chat,
    getGMPlayerIds,
    whisper,
    decodeHtml,
    isTrap,
    getTokenImageURL,
    buildTagToIdMap: buildTagToIdMap$1,
    executeMacro: executeMacro$1
  });

  // ------------------------------------------------------------------
  // Geometry helpers (migrated)
  // ------------------------------------------------------------------

  function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (!denom) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }
    return null;
  }

  function getTokenCenter(token) {
    return { x: token.get('left'), y: token.get('top') };
  }

  function getOBBCorners(token) {
    if (!token) return null;
    const centerX = token.get('left');
    const centerY = token.get('top');
    const width = token.get('width');
    const height = token.get('height');
    const rotationDeg = token.get('rotation') || 0;
    const rotationRad = rotationDeg * (Math.PI / 180);

    const halfW = width / 2;
    const halfH = height / 2;

    const localCorners = [
      { x: -halfW, y: -halfH }, // TL
      { x: halfW, y: -halfH },  // TR
      { x: halfW, y: halfH },   // BR
      { x: -halfW, y: halfH }   // BL
    ];

    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);
    return localCorners.map(c => ({
      x: centerX + c.x * cosR - c.y * sinR,
      y: centerY + c.x * sinR + c.y * cosR
    }));
  }

  function isPointInOBB(point, corners) {
    if (!point || !Array.isArray(corners) || corners.length !== 4) return false;
    const c0 = corners[0];
    const c1 = corners[1];
    const c3 = corners[3];
    const ABx = c1.x - c0.x;
    const ABy = c1.y - c0.y;
    const ADx = c3.x - c0.x;
    const ADy = c3.y - c0.y;
    const APx = point.x - c0.x;
    const APy = point.y - c0.y;
    const dotAB_AP = APx * ABx + APy * ABy;
    const dotAD_AP = APx * ADx + APy * ADy;
    const magSqAB = ABx * ABx + ABy * ABy;
    const magSqAD = ADx * ADx + ADy * ADy;
    return (0 <= dotAB_AP && dotAB_AP <= magSqAB && 0 <= dotAD_AP && dotAD_AP <= magSqAD);
  }

  function getPageSettings(pageId) {
    const page = getObj ? getObj('page', pageId) : null;
    if (!page) {
      if (!State.warnedInvalidGridPages[pageId || 'unknown']) {
        log(`Page ${pageId} not found, using defaults`, 'warning');
        State.warnedInvalidGridPages[pageId || 'unknown'] = true;
      }
      return {
        gridSize: Config.DEFAULT_GRID_SIZE,
        scale: Config.DEFAULT_SCALE,
        gridType: 'square',
        valid: false
      };
    }
    let gridSize = page.get('gridsize');
    const snap = page.get('snapping_increment');
    if (snap === 0 || !gridSize || gridSize < 2) {
      gridSize = Config.DEFAULT_GRID_SIZE;
    }
    return {
      gridSize,
      scale: page.get('scale_number') || Config.DEFAULT_SCALE,
      gridType: page.get('grid_type'),
      valid: true
    };
  }

  function getTokenGridCoords(token) {
    if (!token) return null;
    const ps = getPageSettings(token.get('_pageid'));
    const g = ps.gridSize;
    const left = token.get('left');
    const top = token.get('top');
    const w = token.get('width');
    const h = token.get('height');
    return {
      x: Math.round((left - w / 2) / g),
      y: Math.round((top - h / 2) / g),
      width: Math.ceil(w / g),
      height: Math.ceil(h / g),
      gridSize: g,
      scale: ps.scale,
      gridType: ps.gridType,
      pixelX: left,
      pixelY: top,
      tokenWidth: w,
      tokenHeight: h
    };
  }

  function calculateTokenDistance(token1, token2) {
    if (!token1 || !token2 || token1.get('_pageid') !== token2.get('_pageid')) return { pixelDistance: Infinity, mapUnitDistance: Infinity };
    const ps = getPageSettings(token1.get('_pageid'));
    const c1 = getTokenGridCoords(token1);
    const c2 = getTokenGridCoords(token2);
    const dx = c1.pixelX - c2.pixelX;
    const dy = c1.pixelY - c2.pixelY;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    const mapUnitDistance = (pixelDistance / ps.gridSize) * ps.scale;
    return { pixelDistance, mapUnitDistance };
  }

  TrapUtils.geometry = {
    lineIntersection,
    getTokenCenter,
    getOBBCorners,
    isPointInOBB,
    getPageSettings,
    getTokenGridCoords,
    calculateTokenDistance
  };

  function getSafeMacroDisplayName(macroString, maxLength = 25) {
    if (!macroString || typeof macroString !== 'string') return '(DE)';
    let display = macroString.trim();
    // Macro
    if (display.startsWith('#')) return `Macro: ${display.slice(1)}`;
    // API command disguised with $ or true !
    if (display.startsWith('$')) display = `Cmd: !${display.slice(1)}`;
    else if (display.startsWith('!')) display = `Cmd: ${display}`;
    // Template
    else if (display.startsWith('&{')) {
      const nameMatch = display.match(/\{\{name=([^}]+)\}\}/);
      return nameMatch ? `Template: "${nameMatch[1].trim()}"` : 'Chat Template';
    } else {
      display = `Text: "${display}"`;
    }
    if (display.length > maxLength) return display.slice(0, maxLength - 3) + '...';
    return display;
  }

  TrapUtils.getSafeMacroDisplayName = getSafeMacroDisplayName;

  // ------------------------------------------------------------------
  // Migrated core parsing + state helpers (simplified v1)
  // ------------------------------------------------------------------

  // Quick/partial GM-notes parser for the modern {!traptrigger …} format.
  // It extracts: type, currentUses, maxUses, isArmed, position, etc.
  function parseTrapNotes(rawNotes, token = null) {
    if (!rawNotes) return null;
    let decoded = rawNotes;
    try { decoded = decodeURIComponent(rawNotes); } catch (_) {}
    decoded = decoded.replace(/<br\s*\/?>/gi, ' ').replace(/\n/g, ' ').trim();

    // Look for the first {!traptrigger …} block
    const triggerMatch = decoded.match(/\{!traptrigger\s+([^}]*)\}/i);
    const detectionMatch = decoded.match(/\{!trapdetection\s+([^}]*)\}/i);
    
    if (!triggerMatch && !detectionMatch) return null;
    
    const getSetting = (body, key) => {
      const escapedKey = escapeRegExp(key);
      const s = new RegExp(`${escapedKey}:\\s*\\[([^\\]]*)\\]`, 'i').exec(body);
      return s ? s[1].trim() : null;
    };
    
    // Parse trigger block
    let trapData = {
      type: 'standard',
      currentUses: 0,
      maxUses: 0,
      isArmed: true,
      primaryMacro: null,
      successMacro: null,
      failureMacro: null,
      options: [],
      checks: [],
      position: 'intersection',
      movementTrigger: true,
      autoTrigger: false,
      // Detection properties
      isPassive: false,
      passiveSpotDC: null,
      passiveMaxRange: null,
      passiveNoticePlayer: null,
      passiveNoticeGM: null,
      ppTokenBarFallback: null,
      enableLuckRoll: false,
      luckRollDie: '1d6',
      showDetectionAura: false,
      passiveEnabled: true,
      detected: false
    };
    
    if (triggerMatch) {
      const triggerBody = triggerMatch[1];
      trapData.type = getSetting(triggerBody, 'type') || 'standard';
      
      const usesStr = getSetting(triggerBody, 'uses') || '0/0';
      const usesParts = usesStr.match(/(\d+)\/(\d+)/) || [0, 0, 0];
      trapData.currentUses = parseInt(usesParts[1], 10);
      trapData.maxUses = parseInt(usesParts[2], 10);
      trapData.isArmed = (getSetting(triggerBody, 'armed') || 'on').toLowerCase() === 'on';
      
      // Extract macros
      const primaryMacro = getSetting(triggerBody, 'primaryMacro');
      trapData.primaryMacro = primaryMacro ? { macro: primaryMacro } : null;
      trapData.successMacro = getSetting(triggerBody, 'successMacro');
      trapData.failureMacro = getSetting(triggerBody, 'failureMacro');
      
      const optionsStr = getSetting(triggerBody, 'options');
      trapData.options = optionsStr ? optionsStr.split(';').map(opt => ({ macro: opt.trim() })).filter(o => o.macro) : [];
      
      // Extract checks
      const checksStr = getSetting(triggerBody, 'checks');
      trapData.checks = checksStr ? checksStr.split(';').map(chk => {
        const parts = chk.split(':');
        return parts.length === 2 ? { type: parts[0].trim(), dc: parseInt(parts[1], 10) } : null;
      }).filter(Boolean) : [];
      
      // Extract position
      const posStr = getSetting(triggerBody, 'position') || 'intersection';
      trapData.position = posStr;
      const coordMatch = posStr.match(/(\d+)\s*,\s*(\d+)/);
      if (coordMatch) trapData.position = { x: parseInt(coordMatch[1], 10), y: parseInt(coordMatch[2], 10) };
      
      // Extract flags
      trapData.movementTrigger = (getSetting(triggerBody, 'movementTrigger') || 'on').toLowerCase() === 'on';
      trapData.autoTrigger = (getSetting(triggerBody, 'autoTrigger') || 'off').toLowerCase() === 'on';
    }
    
    // Parse detection block
    if (detectionMatch) {
      const detectionBody = detectionMatch[1];
      trapData.isPassive = true;
      
      const dc = parseInt(getSetting(detectionBody, 'passiveSpotDC'), 10);
      trapData.passiveSpotDC = isNaN(dc) ? null : dc;
      
      const range = parseFloat(getSetting(detectionBody, 'passiveMaxRange'));
      trapData.passiveMaxRange = isNaN(range) ? null : range;
      
      trapData.passiveNoticePlayer = getSetting(detectionBody, 'passiveNoticePlayer');
      trapData.passiveNoticeGM = getSetting(detectionBody, 'passiveNoticeGM');
      trapData.ppTokenBarFallback = getSetting(detectionBody, 'ppTokenBarFallback');
      trapData.enableLuckRoll = (getSetting(detectionBody, 'enableLuckRoll') || 'false').toLowerCase() === 'true';
      trapData.luckRollDie = getSetting(detectionBody, 'luckRollDie') || '1d6';
      trapData.showDetectionAura = (getSetting(detectionBody, 'showDetectionAura') || 'false').toLowerCase() === 'true';
      trapData.passiveEnabled = (getSetting(detectionBody, 'passiveEnabled') || 'on').toLowerCase() === 'on';
      trapData.detected = (getSetting(detectionBody, 'detected') || 'off').toLowerCase() === 'on';
    }

    // Minimal visual sync (update aura) if token provided
    if (token) {
      const color = trapData.isArmed ? Config.AURA_COLORS.ARMED : Config.AURA_COLORS.DISARMED;
      token.set({
        aura1_color: color,
        aura1_radius: calculateDynamicAuraRadius(token),
        showplayers_aura1: false,
        bar1_value: trapData.currentUses,
        bar1_max: trapData.maxUses,
        showplayers_bar1: false
      });
    }
    return trapData;
  }

  function calculateDynamicAuraRadius(token) {
    if (!token) return Config.aura.TARGET_RADIUS_GRID_UNITS * (Config.DEFAULT_SCALE || 1);
    const ps = getPageSettings(token.get('_pageid'));
    if (!ps.valid) return Config.aura.TARGET_RADIUS_GRID_UNITS * ps.scale;
    const wGU = token.get('width') / ps.gridSize;
    const hGU = token.get('height') / ps.gridSize;
    const minGU = Math.min(wGU, hGU);
    // If token larger than aura diameter keep aura inside borders using negative radius hack
    if (minGU >= Config.aura.TARGET_RADIUS_GRID_UNITS * 2) {
      return -(minGU * 0.5) + Config.aura.VISIBILITY_BOOST_GU * ps.scale;
    }
    // Otherwise use positive radius scaled to units
    return Config.aura.TARGET_RADIUS_GRID_UNITS * ps.scale;
  }

  function updateTrapUses(token, current, max, armed = null) {
    if (!token) return;
    let notes = token.get('gmnotes') || '';
    let dec = notes;
    try { dec = decodeURIComponent(notes); } catch (_) {}
    const repl = (field, value) => {
      const escapedField = escapeRegExp(field);
      const re = new RegExp(`${escapedField}:\\s*\\[[^\\]]*\\]`);
      if (re.test(dec)) dec = dec.replace(re, `${field}:[${value}]`);
      else dec = dec.replace(/\{!traptrigger/, `{!traptrigger ${field}:[${value}]`);
    };
    repl('uses', `${current}/${max}`);
    if (armed !== null) repl('armed', armed ? 'on' : 'off');
    token.set('gmnotes', encodeURIComponent(dec));

    // sync bars & aura
    token.set({
      bar1_value: current,
      bar1_max: max,
      aura1_color: armed === false ? Config.AURA_COLORS.DISARMED : Config.AURA_COLORS.ARMED,
      aura1_radius: calculateDynamicAuraRadius(token),
      showplayers_bar1: false,
      showplayers_aura1: false
    });
  }

  // Attach to export object
  Object.assign(TrapUtils, {
    parseTrapNotes,
    calculateDynamicAuraRadius,
    updateTrapUses
  });

  /**
   * Escape special regex characters to prevent ReDoS attacks
   */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // src/trap-ui.js
  // Chat/menu rendering utilities.


  function buildDefaultTemplate(sections) {
    // sections: array of strings already formatted like "name=..." or "Token=..."
    return `&{template:default} {{${sections.join('}} {{')}}}`;
  }

  function sendGM(menuString) {
    TrapUtils.chat(menuString);
  }

  // Build a trap status menu with current configuration
  function buildTrapStatusMenu(trapToken) {
    if (!trapToken) return null;
    
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
      return 'Legacy utilities not available';
    }
    
    const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
    if (!trapData) return 'Invalid trap configuration';
    
    const tokenImage = TrapUtils.getTokenImageURL(trapToken, 'thumb');
    const statusEmoji = trapData.isArmed ? '🔴' : '🟢';
    const usesText = trapData.currentUses > 0 ? `${trapData.currentUses}/${trapData.maxUses}` : 'Depleted';
    
    const sections = [
      `name=${statusEmoji} ${trapData.name || 'Unnamed Trap'}`,
      `Token=<img src="${tokenImage}" style="width:40px;height:40px;">`,
      `Status=${trapData.isArmed ? 'Armed' : 'Disarmed'}`,
      `Uses=${usesText}`,
      `DC=${trapData.dc || 'N/A'}`,
      `Type=${trapData.triggerType || 'Unknown'}`,
      `Actions=[Toggle](!trapsystem toggle @{selected|token_id}) [Edit](!trapsystem edit @{selected|token_id})`
    ];
    
    return buildDefaultTemplate(sections);
  }

  // Build a skill check menu
  function buildSkillCheckMenu(characterToken, trapToken, skillType = 'Investigation') {
    if (!characterToken || !trapToken) return null;
    
    const charImage = TrapUtils.getTokenImageURL(characterToken, 'thumb');
    const trapImage = TrapUtils.getTokenImageURL(trapToken, 'thumb');
    const skillEmoji = Config.SKILL_TYPES[skillType] || '🎲';
    
    const sections = [
      `name=${skillEmoji} ${skillType} Check`,
      `Character=<img src="${charImage}" style="width:30px;height:30px;"> ${characterToken.get('name')}`,
      `Target=<img src="${trapImage}" style="width:30px;height:30px;"> Trap`,
      `Roll=[${skillType}](!roll 1d20+@{selected|${skillType.toLowerCase()}_mod} vs DC ?{DC|15})`,
      `Actions=[Auto-Resolve](!trapsystem skill-check ${characterToken.id} ${trapToken.id} ${skillType})`
    ];
    
    return buildDefaultTemplate(sections);
  }

  // Build an interaction menu for a trap
  function buildInteractionMenu(trapToken, characterTokens = []) {
    if (!trapToken) return null;
    
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
      return 'Legacy utilities not available';
    }
    
    const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
    if (!trapData) return 'Invalid trap configuration';
    
    const trapImage = TrapUtils.getTokenImageURL(trapToken, 'thumb');
    const statusEmoji = trapData.isArmed ? '🔴' : '🟢';
    
    const characterList = characterTokens.map(token => 
      `<img src="${TrapUtils.getTokenImageURL(token, 'thumb')}" style="width:20px;height:20px;"> ${token.get('name')}`
    ).join('<br>');
    
    const sections = [
      `name=${statusEmoji} Trap Interaction`,
      `Trap=<img src="${trapImage}" style="width:40px;height:40px;"> ${trapData.name || 'Unnamed'}`,
      `Characters=${characterList || 'None nearby'}`,
      `Detection=[Perception Check](!trapsystem perception-check @{selected|token_id} ${trapToken.id})`,
      `Disarm=[Disable Check](!trapsystem disable-check @{selected|token_id} ${trapToken.id})`,
      `Actions=[Trigger Manually](!trapsystem trigger ${trapToken.id}) [Reset](!trapsystem reset ${trapToken.id})`
    ];
    
    return buildDefaultTemplate(sections);
  }

  // Send a formatted error message
  function sendError(message, recipient = 'gm') {
    const errorMsg = `❌ **Error:** ${message}`;
    if (recipient === 'gm') {
      TrapUtils.chat(errorMsg);
    } else {
      TrapUtils.whisper(recipient, errorMsg);
    }
  }

  // Send a formatted success message
  function sendSuccess(message, recipient = 'gm') {
    const successMsg = `✅ **Success:** ${message}`;
    if (recipient === 'gm') {
      TrapUtils.chat(successMsg);
    } else {
      TrapUtils.whisper(recipient, successMsg);
    }
  }

  // Send a formatted info message
  function sendInfo(message, recipient = 'gm') {
    const infoMsg = `ℹ️ **Info:** ${message}`;
    if (recipient === 'gm') {
      TrapUtils.chat(infoMsg);
    } else {
      TrapUtils.whisper(recipient, infoMsg);
    }
  }

  const ui = {
    buildDefaultTemplate,
    sendGM,
    buildTrapStatusMenu,
    buildSkillCheckMenu,
    buildInteractionMenu,
    sendError,
    sendSuccess,
    sendInfo
  };

  // src/trap-triggers.js
  // Initial migration of trigger-control helpers (wrapper around legacy for now)


  function toggleTrap(token) {
    if (!TrapUtils.validateTrapToken(token, 'toggleTrap')) return;
    const data = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (!data) {
      TrapUtils.chat('❌ Invalid trap configuration.');
      return;
    }
    const newArmed = !data.isArmed;
    let newUses = data.currentUses;
    if (newArmed && newUses <= 0) newUses = 1;
    TrapUtils.updateTrapUses(token, newUses, data.maxUses, newArmed);
    TrapUtils.chat(`${newArmed ? '🎯 Armed' : '🔴 Disarmed'} (uses ${newUses}/${data.maxUses})`);
  }

  function getTrapStatus(token) {
    if (!token) return;
    const d = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (!d) {
      TrapUtils.chat('❌ Invalid trap config.');
      return;
    }
    const msg = [];
    msg.push('&{template:default} {{name=Trap Status}}');
    msg.push(`{{State=${d.isArmed ? '🎯 ARMED' : '🔴 DISARMED'}}}`);
    msg.push(`{{Uses=${d.currentUses}/${d.maxUses}}}`);
    if (d.type === 'interaction') {
      if (d.primaryMacro && d.primaryMacro.macro) msg.push(`{{Primary=${TrapUtils.getSafeMacroDisplayName(d.primaryMacro.macro)}}}`);
      if (d.successMacro) msg.push(`{{Success=${TrapUtils.getSafeMacroDisplayName(d.successMacro)}}}`);
      if (d.failureMacro) msg.push(`{{Failure=${TrapUtils.getSafeMacroDisplayName(d.failureMacro)}}}`);
      if (d.checks && d.checks.length) {
        const checkInfo = d.checks.map(c => `${Config.SKILL_TYPES[c.type] || '🎲'} ${c.type} (DC ${c.dc})`).join('<br>');
        msg.push(`{{Checks=${checkInfo}}}`);
      }
    }
    msg.push(`{{Movement Trigger=${d.movementTrigger ? 'On' : 'Off'}}}`);
    msg.push(`{{Auto Trigger=${d.autoTrigger ? 'On' : 'Off'}}}`);
    msg.push(`{{Position=${typeof d.position === 'object' ? `(${d.position.x},${d.position.y})` : d.position}}}`);
    sendChat('TrapSystem', `/w gm ${msg.join(' ')}`);
  }

  function manualTrigger(trapToken) {
    if (!trapToken) {
      TrapUtils.chat('❌ No trap token selected.');
      return;
    }
    const data = TrapUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
    if (!data) {
      TrapUtils.chat('❌ Invalid trap configuration.');
      return;
    }

    // Auto-trigger shortcut
    if (data.autoTrigger && data.primaryMacro && data.primaryMacro.macro) {
      manualMacroTrigger(trapToken.id, 'primary');
      return;
    }

    // Interaction trap shows menu
    if (data.type === 'interaction') {
      // Use the migrated interaction menu system
      const interactionSystem = globalThis.TrapSystem && globalThis.TrapSystem.interaction;
      if (interactionSystem && typeof interactionSystem.showInteractionMenu === 'function') {
        interactionSystem.showInteractionMenu(trapToken);
      } else {
        TrapUtils.chat('🔧 Interaction menu system not available');
        getTrapStatus(trapToken);
      }
      return;
    }

    // Standard trap control panel
    const panel = [];
    panel.push('&{template:default} {{name=Trap Control Panel}}');
    panel.push(`{{State=🎯 ${data.isArmed ? 'ARMED' : '🔴 DISARMED'} Uses: ${data.currentUses}/${data.maxUses}}}`);
    panel.push(`{{Management=[🔄 Toggle](!trapsystem toggle ${trapToken.id}) [📊 Status](!trapsystem status ${trapToken.id})}}`);

    if (data.isArmed && data.currentUses > 0) {
      panel.push(`{{Reminder=⚠️ Ensure correct trap token selected for macros!}}`);
      panel.push(`{{After Trigger=${data.currentUses > 1 ? '🎯 ARMED' : '🔴 AUTO-DISARMED'} Uses: ${data.currentUses - 1}/${data.maxUses}}}`);
      
      let triggerOpts = '';
      if (data.primaryMacro && data.primaryMacro.macro) {
        triggerOpts += `[🎯 ${TrapUtils.getSafeMacroDisplayName(data.primaryMacro.macro)}](!trapsystem manualtrigger ${trapToken.id} primary)`;
      }
      if (data.options && data.options.length > 0) {
        data.options.forEach((opt, i) => {
          if (triggerOpts) triggerOpts += ' ';
          triggerOpts += `[🎯 ${TrapUtils.getSafeMacroDisplayName(opt.macro)}](!trapsystem manualtrigger ${trapToken.id} option ${i})`;
        });
      }
      panel.push(`{{Trigger Options=${triggerOpts || '(DE)'}}}`);
    } else {
      panel.push(`{{Note=Trap disarmed or out of uses. Toggle to enable triggers.}}`);
    }
    
    panel.push('}}');
    sendChat('API', `/w gm ${panel.join(' ')}`);
  }

  function manualMacroTrigger(trapId, macroIdentifier) {
    const trapToken = getObj('graphic', trapId);
    if (!trapToken) {
      TrapUtils.chat('❌ Trap token not found.');
      return;
    }
    const data = TrapUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
    if (!data || !data.isArmed || data.currentUses <= 0) {
      TrapUtils.chat('❌ Trap cannot be triggered (disarmed or no uses).');
      return;
    }

    const tagMap = TrapUtils.buildTagToIdMap(trapToken, null, []);
    let macroToExecute = null;
    
    if (macroIdentifier === 'primary') {
      macroToExecute = data.primaryMacro?.macro;
    } else if (macroIdentifier.startsWith('option')) {
      const optIndex = parseInt(macroIdentifier.split(' ')[1], 10);
      macroToExecute = data.options?.[optIndex]?.macro;
    }
    
    if (macroToExecute) {
      const executed = TrapUtils.executeMacro(macroToExecute, tagMap);
      if (executed) {
        const newUses = data.currentUses - 1;
        const stillArmed = newUses > 0;
        TrapUtils.updateTrapUses(trapToken, newUses, data.maxUses, stillArmed);
        if (!stillArmed) {
          TrapUtils.chat('💥 Trap depleted and disarmed.');
        }
      } else {
        TrapUtils.chat('❌ Macro execution failed.');
      }
    } else {
      TrapUtils.chat('❌ Invalid macro identifier.');
    }
  }

  // Helper to process macro strings for trap setup
  function processMacro(macroCmd) {
    if (!macroCmd || typeof macroCmd !== 'string' || macroCmd.trim().toLowerCase() === 'none' || macroCmd.trim() === '') {
      return null;
    }

    let content = macroCmd.trim();

    // Handle disguised templates like ^{template:...}
    if (content.startsWith('^')) {
      content = '&' + content.substring(1);
    }

    if (content.startsWith('"') && content.endsWith('"')) {
      content = content.substring(1, content.length - 1).trim();
    }

    if (content.startsWith('&{')) { // Roll template
      return `"${content.replace(/"/g, '\\"')}"`;
    }
    if (content.startsWith('!')) {
      return `"$${content.substring(1)}"`;
    }
    if (content.startsWith('$')) {
      return `"${content}"`;
    }
    if (content.startsWith('#')) {
      const macroName = content.substring(1).trim();
      if (findObjs({ _type: 'macro', name: macroName }).length === 0) {
        TrapUtils.chat(`⚠️ Warning: Macro "${macroName}" not found.`);
      }
      return content;
    }
    if (findObjs({ _type: 'macro', name: content }).length > 0) {
      return '#' + content;
    }
    return `"${content.replace(/"/g, '\\"')}"`;
  }

  function setupTrap(token, uses, mainMacro, optionalMacro2, optionalMacro3, movement, autoTrigger) {
    if (!token) {
      TrapUtils.chat('❌ No token selected.');
      return;
    }

    // Preserve existing detection block if any
    const existingNotes = token.get('gmnotes') || '';
    let decoded = '';
    try { decoded = decodeURIComponent(existingNotes); } catch (_) { decoded = existingNotes; }
    const detectionMatch = decoded.match(/(\{!trapdetection\s+(?:(?!\{!}).)*\})/);
    const existingDetection = detectionMatch ? detectionMatch[0] : '';

    const maxUses = parseInt(uses, 10);
    if (isNaN(maxUses) || maxUses < 1) {
      TrapUtils.chat('❌ Uses must be a positive number.');
      return;
    }

    const primaryProcessed = processMacro(mainMacro);
    if (!primaryProcessed) {
      TrapUtils.chat('❌ Primary macro required for standard trap.');
      return;
    }

    let parts = [
      'type:[standard]',
      `uses:[${maxUses}/${maxUses}]`,
      'armed:[on]',
      `primaryMacro:[${primaryProcessed}]`
    ];

    // Process optional macros
    const options = [];
    const opt2 = processMacro(optionalMacro2);
    if (opt2) options.push(opt2);
    const opt3 = processMacro(optionalMacro3);
    if (opt3) options.push(opt3);
    if (options.length > 0) {
      parts.push(`options:[${options.join(';')}]`);
    }

    // Movement setting
    let movementSetting = 'intersection';
    if (movement) {
      const movLower = movement.toLowerCase();
      if (movLower === 'center' || movLower === 'grid') {
        movementSetting = movLower === 'grid' ? '0,0' : 'center';
      } else if (movLower.match(/^\d+,\d+$/)) {
        movementSetting = movLower;
      }
    }
    parts.push(`position:[${movementSetting}]`);
    parts.push('movementTrigger:[on]');
    parts.push(`autoTrigger:[${autoTrigger && (autoTrigger.toString().toLowerCase() === 'true' || autoTrigger === true) ? 'on' : 'off'}]`);

    const newBlock = `{!traptrigger ${parts.join(' ')}}`;
    const finalNotes = `${newBlock} ${existingDetection}`.trim();

    try {
      const encoded = encodeURIComponent(finalNotes);
      token.set({
        gmnotes: encoded,
        bar1_value: maxUses,
        bar1_max: maxUses,
        showplayers_bar1: false,
        aura1_radius: TrapUtils.calculateDynamicAuraRadius(token),
        aura1_color: Config.AURA_COLORS.ARMED,
        showplayers_aura1: false
      });
      getTrapStatus(token);
    } catch (e) {
      TrapUtils.chat('❌ Error setting trap properties.');
      TrapUtils.log(`setupTrap error: ${e.message}`, 'error');
    }
  }

  function setupInteractionTrap(token, uses, primaryMacro, successMacro, failureMacro, check1Type, check1DC, check2Type, check2DC, movementTriggerEnabled = true, movement = 'intersection', autoTriggerEnabled = false) {
    if (!token) {
      TrapUtils.chat('❌ No token selected.');
      return;
    }

    // Preserve existing detection block
    const existingNotes = token.get('gmnotes') || '';
    let decoded = '';
    try { decoded = decodeURIComponent(existingNotes); } catch (_) { decoded = existingNotes; }
    const detectionMatch = decoded.match(/(\{!trapdetection\s+(?:(?!\{!}).)*\})/);
    const existingDetection = detectionMatch ? detectionMatch[0] : '';

    let positionValue = movement ? movement.toLowerCase() : 'intersection';
    if (positionValue === 'grid') positionValue = '0,0';

    const maxUses = parseInt(uses, 10);
    if (isNaN(maxUses) || maxUses < 1) {
      TrapUtils.chat('❌ Uses must be a positive number.');
      return;
    }

    let parts = [
      'type:[interaction]',
      `uses:[${maxUses}/${maxUses}]`,
      'armed:[on]'
    ];

    // Process macros
    const primaryProcessed = processMacro(primaryMacro);
    if (primaryProcessed) parts.push(`primaryMacro:[${primaryProcessed}]`);
    
    const successProcessed = processMacro(successMacro);
    if (successProcessed) parts.push(`successMacro:[${successProcessed}]`);
    
    const failureProcessed = processMacro(failureMacro);
    if (failureProcessed) parts.push(`failureMacro:[${failureProcessed}]`);

    // Process checks
    const checks = [];
    if (check1Type && check1Type.toLowerCase() !== 'none') {
      const dc1 = parseInt(check1DC, 10);
      if (isNaN(dc1)) {
        TrapUtils.chat('❌ First check DC must be a number.');
        return;
      }
      checks.push(`${check1Type.trim()}:${dc1}`);
    }
    if (check2Type && check2Type.toLowerCase() !== 'none') {
      const dc2 = parseInt(check2DC, 10);
      if (isNaN(dc2)) {
        TrapUtils.chat('❌ Second check DC must be a number.');
        return;
      }
      checks.push(`${check2Type.trim()}:${dc2}`);
    }
    if (checks.length > 0) {
      parts.push(`checks:[${checks.join(';')}]`);
    }

    const movementEnabled = (typeof movementTriggerEnabled === 'string' && movementTriggerEnabled.toLowerCase() === 'true') || movementTriggerEnabled === true;
    parts.push(`movementTrigger:[${movementEnabled ? 'on' : 'off'}]`);
    
    const autoEnabled = (typeof autoTriggerEnabled === 'string' && autoTriggerEnabled.toLowerCase() === 'true') || autoTriggerEnabled === true;
    parts.push(`autoTrigger:[${autoEnabled ? 'on' : 'off'}]`);
    parts.push(`position:[${positionValue}]`);

    const newBlock = `{!traptrigger ${parts.join(' ')}}`;
    const finalNotes = `${newBlock} ${existingDetection}`.trim();

    try {
      const encoded = encodeURIComponent(finalNotes);
      token.set({
        gmnotes: encoded,
        aura1_radius: TrapUtils.calculateDynamicAuraRadius(token),
        aura1_color: Config.AURA_COLORS.ARMED,
        showplayers_aura1: false,
        bar1_value: maxUses,
        bar1_max: maxUses,
        showplayers_bar1: false
      });
      getTrapStatus(token);
    } catch (e) {
      TrapUtils.chat('❌ Error setting trap properties.');
      TrapUtils.log(`setupInteractionTrap error: ${e.message}`, 'error');
    }
  }

  const triggers = {
    toggleTrap,
    getTrapStatus,
    manualTrigger,
    manualMacroTrigger,
    setupTrap,
    setupInteractionTrap
  };

  // src/trap-detector.js
  // Migration of movement-based detection helpers.


  const MovementDetector = {
      /**
       * Main movement detection function - checks if a token's movement triggers any traps
       * @param {object} movedToken - The token that moved
       * @param {number} prevX - Previous X position
       * @param {number} prevY - Previous Y position
       */
      async checkTrapTrigger(movedToken, prevX, prevY) {
          if (!movedToken) return;

          // Ignore if the moved token itself is a trap
          if (TrapUtils.isTrap(movedToken)) {
              TrapUtils.log('Ignoring movement of trap token', 'debug');
              return;
          }

          // Must be in objects layer
          if (movedToken.get("layer") !== "objects") {
              TrapUtils.log('Not in token layer', 'debug');
              return;
          }

          // If token is trap-immune
          if (this.isTrapImmune(movedToken)) {
              TrapUtils.log('Token is immune to traps', 'debug');
              return;
          }

          // If safe move token, skip
          if (State.safeMoveTokens.has(movedToken.id)) {
              State.safeMoveTokens.delete(movedToken.id);
              return;
          }

          // Check movement distance
          const ps = TrapUtils.geometry.getPageSettings(movedToken.get("_pageid"));
          const dx = movedToken.get("left") - prevX;
          const dy = movedToken.get("top") - prevY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < ps.gridSize * Config.MIN_MOVEMENT_FACTOR) {
              TrapUtils.log(`Movement too small (${dist}px)`, 'debug');
              return;
          }

          // Find traps on page
          const pageTokens = findObjs({ _type: "graphic", _pageid: movedToken.get("_pageid") });
          const trapTokens = pageTokens.filter(t => TrapUtils.isTrap(t));

          // For each trap, see if line or overlap triggers
          for (let trapToken of trapTokens) {
              TrapUtils.log(`[DEBUG] Checking trap: ${trapToken.id} (${trapToken.get('name') || 'Unnamed'}) at L:${trapToken.get('left')}, T:${trapToken.get('top')}, W:${trapToken.get('width')}, H:${trapToken.get('height')}`, 'debug');
              
              const data = TrapUtils.parseTrapNotes(trapToken.get("gmnotes"), trapToken, false);
              if (!data || !data.isArmed || data.currentUses <= 0) {
                  continue;
              }

              // Check if movement trigger is disabled for this interaction trap
              if (data.type === "interaction" && data.movementTrigger === false) {
                  TrapUtils.log(`Movement trigger disabled for interaction trap: ${trapToken.id}`, 'debug');
                  continue;
              }

              // Check path intersection
              if (prevX !== undefined && prevY !== undefined) {
                  const i = this.checkLineIntersection(
                      prevX, prevY,
                      movedToken.get("left"), movedToken.get("top"),
                      trapToken
                  );
                  TrapUtils.log(`[DEBUG] Intersection point 'i' from checkLineIntersection: ${i ? JSON.stringify(i) : 'null'} for trap ${trapToken.id}`, 'debug');
                  
                  if (i) {
                      const pos = this.calculateTrapPosition(movedToken, trapToken, i);
                      TrapUtils.log(`[DEBUG] pos.initial: ${JSON.stringify(pos.initial)}, pos.final: ${JSON.stringify(pos.final)} for trap ${trapToken.id}`, 'debug');
                      
                      movedToken.set({ left: pos.initial.x, top: pos.initial.y });
                      setTimeout(() => {
                          movedToken.set({ left: pos.final.x, top: pos.final.y });
                      }, 500);
                      
                      this.handleTrapTrigger(movedToken, trapToken, i);
                      return; // Important: Return after handling a trigger to prevent multiple triggers from one move
                  }
              }

              // Direct overlap
              if (this.checkGridOverlap(movedToken, trapToken)) {
                  const centerOfMovedToken = TrapUtils.geometry.getTokenCenter(movedToken);
                  TrapUtils.log(`[DEBUG] Direct overlap with trap ${trapToken.id}. Center of moved token (used as intersection): ${JSON.stringify(centerOfMovedToken)}`, 'debug');
                  
                  const pos = this.calculateTrapPosition(movedToken, trapToken, centerOfMovedToken);
                  TrapUtils.log(`[DEBUG] pos.initial: ${JSON.stringify(pos.initial)}, pos.final: ${JSON.stringify(pos.final)} for trap ${trapToken.id} (overlap case)`, 'debug');
                  
                  movedToken.set({ left: pos.initial.x, top: pos.initial.y });
                  setTimeout(() => {
                      movedToken.set({ left: pos.final.x, top: pos.final.y });
                  }, 500);
                  
                  this.handleTrapTrigger(movedToken, trapToken, centerOfMovedToken);
                  return; // Important: Return after handling a trigger
              }
          }
      },

      /**
       * Run passive detection checks for a token that moved
       * This should be called whenever a token moves to check for passive trap detection
       * @param {object} movedToken - The token that moved
       */
      async runPassiveChecks(movedToken) {
          // Get the passive detection system from the global TrapSystem
          const passiveSystem = globalThis.TrapSystem?.passive;
          if (passiveSystem && typeof passiveSystem.runPassiveChecksForToken === 'function') {
              await passiveSystem.runPassiveChecksForToken(movedToken);
          }
      },

      /**
       * Handle when a trap is triggered - placeholder that will call the appropriate trigger system
       * @param {object} triggeredToken - The token that triggered the trap
       * @param {object} trapToken - The trap token
       * @param {object} intersectionPoint - The intersection point
       */
      handleTrapTrigger(triggeredToken, trapToken, intersectionPoint) {
          // For now, just log and use basic handling
          TrapUtils.log(`Trap ${trapToken.id} triggered by token ${triggeredToken.id} at intersection ${JSON.stringify(intersectionPoint)}`, 'info');
          
          // Basic trap triggering - just show status for now
          // In the future this will call the full trigger system
          triggers.getTrapStatus(trapToken);
          
          // Show basic notification to GM
          const trapName = trapToken.get('name') || 'Unnamed Trap';
          const tokenName = triggeredToken.get('name') || 'Unknown Token';
          TrapUtils.chat(`⚠️ ${tokenName} triggered ${trapName}!`);
      },

      /**
       * Check if a token is immune to traps
       * @param {object} token - The token to check
       * @returns {boolean} - True if token is trap immune
       */
      isTrapImmune(token) {
          if (!token) return false;
          const hasMarker = token.get("statusmarkers")?.includes("blue") || false;
          const notes = token.get("gmnotes") || "";
          let decoded = notes;
          try { decoded = decodeURIComponent(notes); } catch (e) { /* ignore */ }
          const hasTag = decoded.includes("{ignoretraps}");
          return (hasMarker && hasTag);
      },

      /**
       * Check if a line segment intersects with a trap token
       * @param {number} startX - Start X coordinate
       * @param {number} startY - Start Y coordinate  
       * @param {number} endX - End X coordinate
       * @param {number} endY - End Y coordinate
       * @param {object} trapToken - The trap token to check against
       * @returns {object|null} - Intersection point or null
       */
      checkLineIntersection(startX, startY, endX, endY, trapToken) {
          const coords = TrapUtils.geometry.getTokenGridCoords(trapToken);
          if (!coords) return null;
          
          const dx = endX - startX;
          const dy = endY - startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < coords.gridSize * Config.MIN_MOVEMENT_FACTOR) {
              return null;
          }

          const obbCorners = TrapUtils.geometry.getOBBCorners(trapToken);
          if (!obbCorners) {
              TrapUtils.log('checkLineIntersection: Could not get OBB corners for trap token.', 'warn');
              return null;
          }

          // Use OBB intersection logic
          const intersectionPoint = this.lineSegmentIntersectsOBB(startX, startY, endX, endY, obbCorners);
          return intersectionPoint;
      },

      /**
       * Check if a line segment intersects with an OBB (Oriented Bounding Box)
       * @param {number} p1x - Start X coordinate
       * @param {number} p1y - Start Y coordinate
       * @param {number} p2x - End X coordinate
       * @param {number} p2y - End Y coordinate
       * @param {Array} obbCorners - Array of 4 corner points
       * @returns {object|null} - Intersection point or null
       */
      lineSegmentIntersectsOBB(p1x, p1y, p2x, p2y, obbCorners) {
          if (!Array.isArray(obbCorners) || obbCorners.length !== 4) return null;
          
          const edges = [
              [obbCorners[0], obbCorners[1]], // Top edge
              [obbCorners[1], obbCorners[2]], // Right edge
              [obbCorners[2], obbCorners[3]], // Bottom edge
              [obbCorners[3], obbCorners[0]]  // Left edge
          ];
          
          for (const [edgeStart, edgeEnd] of edges) {
              const intersection = TrapUtils.geometry.lineIntersection(
                  p1x, p1y, p2x, p2y,
                  edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y
              );
              if (intersection) {
                  return intersection;
              }
          }
          return null;
      },

      /**
       * Check if two tokens overlap on the grid
       * @param {object} t1 - First token
       * @param {object} t2 - Second token
       * @returns {boolean} - True if tokens overlap
       */
      checkGridOverlap(t1, t2) {
          const c1 = TrapUtils.geometry.getTokenGridCoords(t1);
          const c2 = TrapUtils.geometry.getTokenGridCoords(t2);
          if (!c1 || !c2) return false;
          
          return !(c1.x + c1.width <= c2.x || c2.x + c2.width <= c1.x ||
                   c1.y + c1.height <= c2.y || c2.y + c2.height <= c1.y);
      },

      /**
       * Calculate where to position a token when it triggers a trap
       * @param {object} movedToken - The token that moved
       * @param {object} trapToken - The trap token
       * @param {object} intersection - The intersection point
       * @returns {object} - Object with initial and final positions
       */
      calculateTrapPosition(movedToken, trapToken, intersection) {
          TrapUtils.log(`[CalcTrapPos-ENTRY] trap.id: ${trapToken.id}, raw_intersection_arg: (${intersection.x.toFixed(2)}, ${intersection.y.toFixed(2)})`, 'debug');
          
          const trapData = TrapUtils.parseTrapNotes(trapToken.get("gmnotes"), trapToken);
          TrapUtils.log(`[CalcTrapPos-ENTRY] trap.id: ${trapToken.id}, parsed trapData.position: ${trapData ? trapData.position : 'N/A (no trapData)'}`, 'debug');

          const trapCoords = TrapUtils.geometry.getTokenGridCoords(trapToken);
          if (!trapCoords) {
              TrapUtils.log("calculateTrapPosition: Trap coordinates not found.", "warning");
              return { initial: intersection, final: intersection };
          }

          const currentGridSize = trapCoords.gridSize;
          const rawIntersectionPoint = { x: intersection.x, y: intersection.y };
          
          let initialCalculatedPos;
          let finalPos;

          const getOccupiedPixelPositions = () => {
              return Object.entries(State.lockedTokens)
                  .filter(([id, v]) => v.trapToken === trapToken.id && id !== movedToken.id)
                  .map(([id, _]) => {
                      const t = getObj("graphic", id);
                      return t ? { x: t.get("left"), y: t.get("top") } : null;
                  })
                  .filter(Boolean);
          };

          const isPixelPosOccupied = (candidatePixelX, candidatePixelY, occupiedList) => {
              return occupiedList.some(o => {
                  const dx = o.x - candidatePixelX;
                  const dy = o.y - candidatePixelY;
                  return Math.sqrt(dx * dx + dy * dy) < (currentGridSize * 0.5);
              });
          };

          const findUnoccupiedCellNear = (basePixelX, basePixelY, tc, occupiedList, searchTrapBoundsOnly = true) => {
              TrapUtils.log(`[CalcTrapPos-findUnoccupiedCellNear] basePixel: (${basePixelX.toFixed(2)}, ${basePixelY.toFixed(2)}), tc.x: ${tc.x}, tc.y: ${tc.y}, tc.width: ${tc.width}, tc.height: ${tc.height}, searchTrapBoundsOnly: ${searchTrapBoundsOnly}`, 'debug');
              
              let targetCellCol = Math.round(basePixelX / currentGridSize - 0.5);
              let targetCellRow = Math.round(basePixelY / currentGridSize - 0.5);
              TrapUtils.log(`[CalcTrapPos-findUnoccupiedCellNear] Initial absolute target cell from basePixel: (${targetCellCol}, ${targetCellRow})`, 'debug');

              if (searchTrapBoundsOnly) {
                  const relTargetCol = targetCellCol - tc.x;
                  const relTargetRow = targetCellRow - tc.y;
                  const clampedRelCol = Math.min(Math.max(0, relTargetCol), tc.width - 1);
                  const clampedRelRow = Math.min(Math.max(0, relTargetRow), tc.height - 1);
                  targetCellCol = tc.x + clampedRelCol;
                  targetCellRow = tc.y + clampedRelRow;
                  TrapUtils.log(`[CalcTrapPos-findUnoccupiedCellNear] Clamped absolute target cell (within trap bounds): (${targetCellCol}, ${targetCellRow})`, 'debug');
              }
              
              let primaryTargetPixelX = targetCellCol * currentGridSize + currentGridSize / 2;
              let primaryTargetPixelY = targetCellRow * currentGridSize + currentGridSize / 2;
              TrapUtils.log(`[CalcTrapPos-findUnoccupiedCellNear] Primary target pixel center: (${primaryTargetPixelX.toFixed(2)}, ${primaryTargetPixelY.toFixed(2)})`, 'debug');

              let newPos = { x: primaryTargetPixelX, y: primaryTargetPixelY };

              if (isPixelPosOccupied(primaryTargetPixelX, primaryTargetPixelY, occupiedList)) {
                  TrapUtils.log(`[CalcTrapPos-findUnoccupiedCellNear] Primary target is occupied. Searching adjacent...`, 'debug');
                  const adjacentOffsets = [
                      { dx: 0, dy: 0 },
                      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
                      { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
                      { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
                  ];

                  for (const offset of adjacentOffsets) {
                      const checkCellCol = targetCellCol + offset.dx;
                      const checkCellRow = targetCellRow + offset.dy;

                      if (searchTrapBoundsOnly) {
                          const checkRelCellX = checkCellCol - tc.x;
                          const checkRelCellY = checkCellRow - tc.y;
                          if (checkRelCellX < 0 || checkRelCellX >= tc.width ||
                              checkRelCellY < 0 || checkRelCellY >= tc.height) {
                              TrapUtils.log(`[CalcTrapPos-findUnoccupiedCellNear] Skipping adjacent cell (${checkCellCol},${checkCellRow}) as it's outside trap bounds.`, 'debug');
                              continue;
                          }
                      }
                          
                      const candidatePixelX = checkCellCol * currentGridSize + currentGridSize / 2;
                      const candidatePixelY = checkCellRow * currentGridSize + currentGridSize / 2;

                      if (!isPixelPosOccupied(candidatePixelX, candidatePixelY, occupiedList)) {
                          newPos = { x: candidatePixelX, y: candidatePixelY };
                          TrapUtils.log(`[CalcTrapPos-findUnoccupiedCellNear] Found unoccupied adjacent cell: (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}) at grid (${checkCellCol},${checkCellRow})`, 'debug');
                          break;
                      }
                  }
              } else {
                  TrapUtils.log(`[CalcTrapPos-findUnoccupiedCellNear] Primary target is NOT occupied. Using it.`, 'debug');
              }
              return newPos;
          };

          const effectiveTrapPositionType = (trapData && trapData.position) ? trapData.position : 'intersection';
          const occupiedPixelPosList = getOccupiedPixelPositions();

          if (effectiveTrapPositionType === 'center') {
              TrapUtils.log(`[CalcTrapPos-MAIN] Position type: 'center'. Trap: ${trapToken.id}`, 'debug');
              const trapTokenCenterX = trapToken.get("left");
              const trapTokenCenterY = trapToken.get("top");
              initialCalculatedPos = findUnoccupiedCellNear(trapTokenCenterX, trapTokenCenterY, trapCoords, occupiedPixelPosList, true);
              finalPos = { ...initialCalculatedPos };
          
          } else if (typeof effectiveTrapPositionType === 'object' && 
                     effectiveTrapPositionType.x !== undefined && 
                     effectiveTrapPositionType.y !== undefined) {
              TrapUtils.log(`[CalcTrapPos-MAIN] Position type: 'specific coords' ${JSON.stringify(effectiveTrapPositionType)}. Trap: ${trapToken.id}`, 'debug');
              const targetRelCellX = Math.min(Math.max(0, effectiveTrapPositionType.x), trapCoords.width - 1);
              const targetRelCellY = Math.min(Math.max(0, effectiveTrapPositionType.y), trapCoords.height - 1);
              
              const specificTargetPixelX = (trapCoords.x + targetRelCellX) * currentGridSize + currentGridSize / 2;
              const specificTargetPixelY = (trapCoords.y + targetRelCellY) * currentGridSize + currentGridSize / 2;
              
              initialCalculatedPos = findUnoccupiedCellNear(specificTargetPixelX, specificTargetPixelY, trapCoords, occupiedPixelPosList, true);
              finalPos = { ...initialCalculatedPos };

          } else { // Includes 'intersection' and any other unrecognized, defaulting to intersection behavior
              if (effectiveTrapPositionType !== 'intersection') {
                  TrapUtils.log(`[CalcTrapPos-MAIN] Position type: '${effectiveTrapPositionType}' (unrecognized, defaulting to OBB-sensitive intersection). Trap: ${trapToken.id}`, 'warn');
              } else {
                  TrapUtils.log(`[CalcTrapPos-MAIN] Position type: 'intersection' (OBB-sensitive). Trap: ${trapToken.id}`, 'debug');
              }
              
              TrapUtils.log(`[CalcTrapPos-OBBIntersection] Raw geometric intersection point: (${rawIntersectionPoint.x.toFixed(2)}, ${rawIntersectionPoint.y.toFixed(2)})`, 'debug');
              const obbCorners = TrapUtils.geometry.getOBBCorners(trapToken);

              if (!obbCorners) {
                  TrapUtils.log('[CalcTrapPos-OBBIntersection] Could not get OBB corners for trap. Defaulting to basic grid snap of raw intersection.', 'error');
                  const snappedCellCol_abs = Math.round(rawIntersectionPoint.x / currentGridSize - 0.5);
                  const snappedCellRow_abs = Math.round(rawIntersectionPoint.y / currentGridSize - 0.5);
                  initialCalculatedPos = {
                      x: snappedCellCol_abs * currentGridSize + currentGridSize / 2,
                      y: snappedCellRow_abs * currentGridSize + currentGridSize / 2
                  };
              } else {
                  let bestCellCenter = null;
                  let minDistanceSqToIntersection = Infinity;
                  const searchRadiusCells = 1; // Search 1 cell around (3x3 area), including the center cell.

                  const centerCellCol = Math.round(rawIntersectionPoint.x / currentGridSize - 0.5);
                  const centerCellRow = Math.round(rawIntersectionPoint.y / currentGridSize - 0.5);

                  for (let dRow = -searchRadiusCells; dRow <= searchRadiusCells; dRow++) {
                      for (let dCol = -searchRadiusCells; dCol <= searchRadiusCells; dCol++) {
                          const currentCellCol = centerCellCol + dCol;
                          const currentCellRow = centerCellRow + dRow;
                          const candidateCellCenter = {
                              x: currentCellCol * currentGridSize + currentGridSize / 2,
                              y: currentCellRow * currentGridSize + currentGridSize / 2
                          };

                          if (TrapUtils.geometry.isPointInOBB(candidateCellCenter, obbCorners)) {
                              const dx = candidateCellCenter.x - rawIntersectionPoint.x;
                              const dy = candidateCellCenter.y - rawIntersectionPoint.y;
                              const distSq = dx * dx + dy * dy;

                              if (distSq < minDistanceSqToIntersection) {
                                  minDistanceSqToIntersection = distSq;
                                  bestCellCenter = candidateCellCenter;
                              }
                              TrapUtils.log(`[CalcTrapPos-OBBIntersection] Candidate cell (${currentCellCol},${currentCellRow}), center (${candidateCellCenter.x.toFixed(2)},${candidateCellCenter.y.toFixed(2)}) IS IN OBB. DistSq: ${distSq.toFixed(2)}`, 'debug');
                          } else {
                              TrapUtils.log(`[CalcTrapPos-OBBIntersection] Candidate cell (${currentCellCol},${currentCellRow}), center (${candidateCellCenter.x.toFixed(2)},${candidateCellCenter.y.toFixed(2)}) is NOT in OBB.`, 'debug');
                          }
                      }
                  }

                  if (bestCellCenter) {
                      initialCalculatedPos = bestCellCenter;
                      TrapUtils.log(`[CalcTrapPos-OBBIntersection] Best cell center found in OBB: (${bestCellCenter.x.toFixed(2)}, ${bestCellCenter.y.toFixed(2)})`, 'debug');
                  } else {
                      TrapUtils.log('[CalcTrapPos-OBBIntersection] No cell center within search radius found inside OBB. Defaulting to basic grid snap of raw intersection.', 'warn');
                      const snappedCellCol_abs = Math.round(rawIntersectionPoint.x / currentGridSize - 0.5);
                      const snappedCellRow_abs = Math.round(rawIntersectionPoint.y / currentGridSize - 0.5);
                      initialCalculatedPos = {
                          x: snappedCellCol_abs * currentGridSize + currentGridSize / 2,
                          y: snappedCellRow_abs * currentGridSize + currentGridSize / 2
                      };
                  }
              }
              
              TrapUtils.log(`[CalcTrapPos-OBBIntersection] Snapped initialCalculatedPos: (${initialCalculatedPos.x.toFixed(2)}, ${initialCalculatedPos.y.toFixed(2)})`, 'debug');

              if (!isPixelPosOccupied(initialCalculatedPos.x, initialCalculatedPos.y, occupiedPixelPosList)) {
                  finalPos = { ...initialCalculatedPos };
                  TrapUtils.log(`[CalcTrapPos-OBBIntersection] Snapped initial position is NOT occupied. Using it as finalPos.`, 'debug');
              } else {
                  TrapUtils.log(`[CalcTrapPos-OBBIntersection] Snapped initial position IS OCCUPIED. Calling findUnoccupiedCellNear (searchTrapBoundsOnly=false for adjacency search).`, 'debug');
                  finalPos = findUnoccupiedCellNear(initialCalculatedPos.x, initialCalculatedPos.y, trapCoords, occupiedPixelPosList, false);
              }
          }

          TrapUtils.log(`[CalcTrapPos-EXIT] trap.id: ${trapToken.id}, final initialCalculatedPos: (${initialCalculatedPos.x.toFixed(2)},${initialCalculatedPos.y.toFixed(2)}), final finalPos: (${finalPos.x.toFixed(2)},${finalPos.y.toFixed(2)})`, 'debug');
          return { initial: initialCalculatedPos, final: finalPos };
      }
  };

  // src/trap-detection.js
  // Passive detection system for automatic trap discovery via perception checks


  const PassiveDetection = {
      /**
       * Handle when a character notices a trap passively
       * @param {object} triggeringToken - The token that noticed the trap
       * @param {object} noticedTrap - The trap token that was noticed
       * @param {object} perceptionData - Object with finalPP, basePP, luckBonus
       * @param {object} trapConfig - The trap configuration
       * @param {number} distanceToTrap - Distance to the trap in map units
       */
      handlePassiveNotice(triggeringToken, noticedTrap, perceptionData, trapConfig, distanceToTrap) {
          const charId = triggeringToken.get('represents');
          const observerId = charId || triggeringToken.id;

          // Ensure passivelyNoticedTraps is initialized
          if (typeof State.passivelyNoticedTraps !== 'object' || State.passivelyNoticedTraps === null) {
              State.passivelyNoticedTraps = {};
          }

          // Update state that this character has noticed this trap
          if (!State.passivelyNoticedTraps[noticedTrap.id]) {
              State.passivelyNoticedTraps[noticedTrap.id] = {};
          }
          State.passivelyNoticedTraps[noticedTrap.id][observerId] = true;

          // Persistently mark the trap as detected in its notes
          let notes = noticedTrap.get("gmnotes");
          let decodedNotes = "";
          try { 
              decodedNotes = decodeURIComponent(notes); 
          } catch (e) { 
              decodedNotes = notes; 
          }

          // Update detection block to mark as detected
          const detectionBlockRegex = /\{!trapdetection\s+((?:(?!\{!}).)*)\}/;
          const match = decodedNotes.match(detectionBlockRegex);

          if (match && match[1] && !/detected:\s*\[on\]/.test(match[1])) {
              const originalFullBlock = match[0];
              const originalBlockContent = match[1];
              
              // Add the detected flag to the content
              const newBlockContent = originalBlockContent.trim() + ' detected:[on]';
              const newFullBlock = `{!trapdetection ${newBlockContent}}`;
              
              // Replace the old block with the new one in the notes
              const updatedNotes = decodedNotes.replace(originalFullBlock, newFullBlock);
              
              noticedTrap.set("gmnotes", encodeURIComponent(updatedNotes));
              // Re-parse the notes to get the most up-to-date config
              trapConfig = TrapUtils.parseTrapNotes(updatedNotes, noticedTrap, false);
          }

          // Update the trap's aura2 color to show it's been detected
          noticedTrap.set({
              aura2_color: Config.AURA_COLORS.DETECTED
          });

          const character = charId ? getObj('character', charId) : null;
          const observerName = character ? character.get('name') : triggeringToken.get('name') || "Unnamed Token";
          const trapName = noticedTrap.get('name') || 'Unnamed Trap';

          // Build placeholder replacements
          const placeholders = {
              '{charName}': observerName,
              '{trapName}': trapName,
              '{charPP}': String(perceptionData.finalPP),
              '{trapDC}': String(trapConfig.passiveSpotDC),
              '{distanceToTrap}': distanceToTrap.toFixed(1),
              '{luckBonus}': String(perceptionData.luckBonus),
              '{basePP}': String(perceptionData.basePP)
          };

          // Replace all placeholders in the message
          const replacePlaceholders = (str) => {
              if (!str) return '';
              let result = str;
              for (const [key, value] of Object.entries(placeholders)) {
                  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  result = result.replace(new RegExp(escapedKey, 'g'), value);
              }
              return result;
          };

          // Define message templates
          const PLAYER_MSG_TEMPLATE_NAME = "⚠️ Alert!";
          const PLAYER_MSG_PREFIX = `&{template:default} {{name=${PLAYER_MSG_TEMPLATE_NAME}}} {{message=`;
          
          // Get player's token image for GM message header
          const playerTokenImgUrl = TrapUtils.getTokenImageURL(triggeringToken, 'thumb');
          const playerTokenImage = playerTokenImgUrl === '👤' ? '' : `<img src='${playerTokenImgUrl}' width='30' height='30' style='vertical-align: middle; margin-left: 5px;'>`;
          const GM_MSG_TEMPLATE_NAME = `🎯 Passive Spot ${playerTokenImage}`;

          const GM_MSG_PREFIX = `&{template:default} {{name=${GM_MSG_TEMPLATE_NAME}}} {{message=`;
          const MSG_SUFFIX = "}}";

          const defaultPlayerMsgContent = Config.messages.defaults.playerNotice;
          const defaultGmMsgContent = Config.messages.defaults.gmNotice;

          // Build player message
          let playerMsgContent = trapConfig.passiveNoticePlayer || defaultPlayerMsgContent;
          let finalPlayerMsg = PLAYER_MSG_PREFIX + replacePlaceholders(playerMsgContent) + MSG_SUFFIX;
          
          // Get controlling players
          let controllingPlayerIds = [];
          if (character) {
              controllingPlayerIds = (character.get('controlledby') || "").split(',')
                  .map(pid => pid.trim())
                  .filter(pid => pid && !TrapUtils.playerIsGM(pid));
          } else {
              controllingPlayerIds = (triggeringToken.get('controlledby') || "").split(',')
                  .map(pid => pid.trim())
                  .filter(pid => pid && !TrapUtils.playerIsGM(pid));
          }

          // Debounce player messages
          const currentTime = Date.now();
          const debounceTime = Config.messages.passiveNoticeDebounceTime || 100000; // Default 100s

          if (!State.recentlyNoticedPlayerMessages[charId]) {
              State.recentlyNoticedPlayerMessages[charId] = [];
          }

          // Filter out old messages
          State.recentlyNoticedPlayerMessages[charId] = State.recentlyNoticedPlayerMessages[charId].filter(
              entry => (currentTime - entry.timestamp) < debounceTime
          );

          const alreadySentRecently = State.recentlyNoticedPlayerMessages[charId].some(
              entry => entry.messageContent === finalPlayerMsg
          );

          if (alreadySentRecently) {
              TrapUtils.log(`Passive Notice SUPPRESSED for player(s) of ${observerName} (charId: ${charId}) - identical message sent recently`, 'debug');
          } else if (controllingPlayerIds.length > 0) {
              controllingPlayerIds.forEach(pid => {
                  const player = getObj("player", pid);
                  if (player) {
                      sendChat("TrapSystem", `/w "${player.get("displayname") || pid}" ${finalPlayerMsg}`);
                  } else {
                      TrapUtils.log(`Passive Notice: Could not find player object for ID ${pid}`, 'warn');
                  }
              });
              // Record this message as sent
              State.recentlyNoticedPlayerMessages[charId].push({ 
                  messageContent: finalPlayerMsg, 
                  timestamp: currentTime 
              });
          } else {
              TrapUtils.chat(`⚠️ No players control '${observerName}', which would have spotted '${trapName}'.`);
              TrapUtils.log(`Passive Notice: No non-GM players control observer ${observerName} to send notice.`, 'info');
          }

          // Send GM message
          let gmMsgContent = trapConfig.passiveNoticeGM || defaultGmMsgContent;
          let finalGmMsg = GM_MSG_PREFIX + replacePlaceholders(gmMsgContent) + MSG_SUFFIX;
          TrapUtils.chat(finalGmMsg);

          TrapUtils.log(`Passive Notice: ${observerName} (BasePP ${perceptionData.basePP}, Luck ${perceptionData.luckBonus}, FinalPP ${perceptionData.finalPP}) spotted ${trapName} (DC ${trapConfig.passiveSpotDC}) at ${distanceToTrap.toFixed(1)}ft.`, 'info');
      },

      /**
       * Get a character's passive perception with luck bonuses
       * @param {object} token - The token to check
       * @param {object} trapConfig - The trap configuration for luck roll settings
       * @returns {object} Object with finalPP, basePP, luckBonus
       */
      async getCharacterPassivePerception(token, trapConfig) {
          if (Config.DEBUG) {
              TrapUtils.log(`[getCharacterPassivePerception] Received trapConfig: ${JSON.stringify(trapConfig)}`, 'debug');
          }
          
          const charId = token.get('represents');
          let basePP = null;
          let luckBonus = 0;

          // 1. Try Beacon API (getSheetItem) first
          if (typeof getSheetItem === 'function') {
              try {
                  const item = await getSheetItem(charId, "passive_wisdom");
                  const ppRaw = (item && typeof item.value !== 'undefined') ? item.value : item;
                  if (ppRaw !== undefined && ppRaw !== null && ppRaw !== "") {
                      const parsedPP = parseInt(ppRaw, 10);
                      if (!isNaN(parsedPP)) {
                          TrapUtils.log(`Got PP ${parsedPP} from 'passive_wisdom' (getSheetItem) for char ${charId}.`, 'debug');
                          basePP = parsedPP;
                      }
                  }
                  if (basePP === null) {
                      TrapUtils.log(`'passive_wisdom' (getSheetItem) for char ${charId} was empty or not a number: '${ppRaw}'.`, 'debug');
                  }
              } catch (err) {
                  TrapUtils.log(`Error with getSheetItem for 'passive_wisdom' on char ${charId}: ${err}. Falling back.`, 'warn');
              }
          }

          // 2. Try to get 'passive_wisdom' attribute directly using getAttrByName
          if (basePP === null && typeof getAttrByName === 'function') {
              const passiveWisdomRaw = getAttrByName(charId, "passive_wisdom");
              if (passiveWisdomRaw !== undefined && passiveWisdomRaw !== null && passiveWisdomRaw !== "") {
                  const parsedPP = parseInt(passiveWisdomRaw, 10);
                  if (!isNaN(parsedPP)) {
                      TrapUtils.log(`Got PP ${parsedPP} from 'passive_wisdom' (getAttrByName) for char ${charId}.`, 'debug');
                      basePP = parsedPP;
                  } else {
                      TrapUtils.log(`'passive_wisdom' (getAttrByName) for char ${charId} ('${passiveWisdomRaw}') is not a valid number.`, 'warn');
                  }
              } else {
                  TrapUtils.log(`'passive_wisdom' (getAttrByName) not found or empty for char ${charId}.`, 'debug');
              }
          }
          
          // 3. Try Token Bar Fallback
          if (basePP === null && trapConfig && trapConfig.ppTokenBarFallback && trapConfig.ppTokenBarFallback !== "none") {
              const barKey = trapConfig.ppTokenBarFallback.endsWith('_value') 
                  ? trapConfig.ppTokenBarFallback 
                  : `${trapConfig.ppTokenBarFallback}_value`;
              const barValue = token.get(barKey);
              if (barValue !== undefined && barValue !== null && barValue !== "") {
                  const parsedBarPP = parseInt(barValue, 10);
                  if (!isNaN(parsedBarPP)) {
                      TrapUtils.log(`Got PP ${parsedBarPP} from token bar '${barKey}' for char ${charId} (fallback).`, 'debug');
                      basePP = parsedBarPP;
                  } else {
                      TrapUtils.log(`Value from token bar '${barKey}' for char ${charId} is not a number: '${barValue}'`, 'warn');
                  }
              } else {
                  TrapUtils.log(`Token bar '${barKey}' not found or empty for char ${charId} (fallback).`, 'debug');
              }
          }

          if (basePP === null) {
              TrapUtils.log(`Could not determine Passive Perception for char ${charId} after all methods.`, 'warn');
              return { finalPP: null, basePP: null, luckBonus: 0 };
          }

          // Check for luck roll properties
          if (trapConfig && trapConfig.enableLuckRoll) {
              const dieString = trapConfig.luckRollDie || '1d6';
              luckBonus = this.parseAndRollLuckDie(dieString);
          }
          
          const finalPP = basePP + luckBonus;
          TrapUtils.log(`PP Calcs: BasePP=${basePP}, LuckBonus=${luckBonus}, FinalPP=${finalPP} for char ${charId}`, 'debug');
          return { finalPP, basePP, luckBonus };
      },

      /**
       * Parse and roll a luck die string (e.g., "1d6")
       * @param {string} dieString - The die string to parse and roll
       * @returns {number} The rolled result
       */
      parseAndRollLuckDie(dieString) {
          if (!dieString || typeof dieString !== 'string') return 0;
          
          const match = dieString.match(/(\d+)d(\d+)([+-]\d+)?/i);
          if (!match) return 0;
          
          const numDice = parseInt(match[1], 10);
          const dieSize = parseInt(match[2], 10);
          const modifier = match[3] ? parseInt(match[3], 10) : 0;
          
          let total = 0;
          for (let i = 0; i < numDice; i++) {
              total += Math.floor(Math.random() * dieSize) + 1;
          }
          total += modifier;
          
          TrapUtils.log(`Luck roll: ${dieString} = ${total}`, 'debug');
          return total;
      },

      /**
       * Update the detection aura for a trap token
       * @param {object} trapToken - The trap token to update
       */
      updateAuraForDetectionRange(trapToken) {
          if (!trapToken || !TrapUtils.isTrap(trapToken)) return;

          // Check for global hide
          if (State.detectionAurasTemporarilyHidden) {
              trapToken.set({ aura2_radius: '' });
              return;
          }

          const trapData = TrapUtils.parseTrapNotes(trapToken.get("gmnotes"), trapToken, false);
          if (!trapData) {
              // If it's not a valid trap, ensure the aura is off
              trapToken.set({ aura2_radius: '', aura2_color: '#000000' });
              return;
          }

          // Only show the aura if showDetectionAura is explicitly true
          if (trapData.showDetectionAura !== true) {
              trapToken.set({ aura2_radius: '' });
              TrapUtils.log(`Hiding detection aura for ${trapToken.id} because showDetectionAura is not explicitly true.`, 'debug');
              return;
          }
          
          // Determine the correct color and radius based on trap state
          const isArmedAndHasUses = trapData.isArmed && trapData.currentUses > 0;
          const isDetected = trapData.detected;
          let aura2Color = '#000000';
          let aura2Radius = '';

          if (isArmedAndHasUses) {
              aura2Color = isDetected ? Config.AURA_COLORS.DETECTED : Config.AURA_COLORS.DETECTION;
              // Calculate radius based on range
              const pageSettings = TrapUtils.geometry.getPageSettings(trapToken.get('_pageid'));
              if (pageSettings.valid && trapData.passiveMaxRange > 0) {
                  const pixelsPerFoot = pageSettings.gridSize / pageSettings.scale;
                  const tokenRadiusPixels = Math.max(trapToken.get('width'), trapToken.get('height')) / 2;
                  const tokenRadiusFt = tokenRadiusPixels / pixelsPerFoot;
                  aura2Radius = Math.max(0, trapData.passiveMaxRange - tokenRadiusFt);
              }
          } else { // Disarmed or no uses
              aura2Radius = 0; // Show a visible dot to indicate state
              aura2Color = isDetected ? Config.AURA_COLORS.DISARMED_DETECTED : Config.AURA_COLORS.DISARMED_UNDETECTED;
          }
          
          // Override color if passive detection is manually disabled for the trap
          if (trapData.passiveEnabled === false) {
              aura2Color = Config.AURA_COLORS.PASSIVE_DISABLED;
          }

          trapToken.set({
              aura2_color: aura2Color,
              aura2_radius: aura2Radius
          });

          TrapUtils.log(`Detection Aura Recalculated for ${trapToken.id}: Range ${trapData.passiveMaxRange || 0}ft, Radius ${aura2Radius}, Color ${aura2Color}`, 'debug');
      },

      /**
       * Run a single passive check between an observer and a trap
       * @param {object} observerToken - The token making the check
       * @param {object} trapToken - The trap token being checked against
       */
      async runSinglePassiveCheck(observerToken, trapToken) {
          if (!observerToken || !trapToken) return;

          // Ensure the trap token is actually a trap
          if (!TrapUtils.isTrap(trapToken)) return;

          const trapData = TrapUtils.parseTrapNotes(trapToken.get("gmnotes"), trapToken, false);

          // Check if trap has passive detection enabled
          if (!trapData || !trapData.isPassive || trapData.passiveEnabled === false) {
              return; // No passive detection configured
          }

          // Use character ID if available, otherwise use token ID
          const observerId = observerToken.get('represents') || observerToken.id;

          // Check if observer has already noticed this trap
          const alreadyNoticed = State.passivelyNoticedTraps[trapToken.id] && 
                                State.passivelyNoticedTraps[trapToken.id][observerId];
          if (alreadyNoticed) {
              if (Config.DEBUG) {
                  TrapUtils.log(`Passive Notice SKIPPED for trap ${trapToken.id}: Observer ${observerId} has already noticed it.`, 'debug');
              }
              return;
          }

          // Check for Line of Sight
          const hasLOS = this.hasLineOfSight(observerToken, trapToken);
          if (!hasLOS) {
              if (Config.DEBUG) {
                  TrapUtils.log(`Passive detection of trap ${trapToken.id} by ${observerToken.id} failed: No Line of Sight.`, 'debug');
              }
              return;
          }
          
          if (Config.DEBUG) {
              TrapUtils.log(`Passive detection check for trap ${trapToken.id} by ${observerToken.id}: Has Line of Sight.`, 'debug');
          }
          
          // Check distance vs max range
          const { mapUnitDistance } = TrapUtils.geometry.calculateTokenDistance(observerToken, trapToken);
          if (trapData.passiveMaxRange && mapUnitDistance > trapData.passiveMaxRange) {
              if (Config.DEBUG) {
                  TrapUtils.log(`Passive detection of trap ${trapToken.id} by ${observerToken.id} failed: Out of max range (${mapUnitDistance.toFixed(1)}ft > ${trapData.passiveMaxRange}ft).`, 'debug');
              }
              return;
          }

          // Perform perception check
          const perceptionResult = await this.getCharacterPassivePerception(observerToken, trapData);
          if (perceptionResult.finalPP !== null && perceptionResult.finalPP >= trapData.passiveSpotDC) {
              this.handlePassiveNotice(observerToken, trapToken, perceptionResult, trapData, mapUnitDistance);
          }
      },

      /**
       * Basic line of sight check (placeholder - can be enhanced)
       * @param {object} observerToken - The observing token
       * @param {object} targetToken - The target token
       * @returns {boolean} True if line of sight exists
       */
      hasLineOfSight(observerToken, targetToken) {
          // For now, just check if they're on the same page
          // This can be enhanced with actual line-of-sight calculations
          return observerToken.get('_pageid') === targetToken.get('_pageid');
      },

      /**
       * Run passive checks for a token against all traps on the page
       * @param {object} observerToken - The token to run checks for
       */
      async runPassiveChecksForToken(observerToken) {
          if (!observerToken) return;

          const pageId = observerToken.get('_pageid');
          const trapTokens = findObjs({ _type: "graphic", _pageid: pageId }).filter(t => TrapUtils.isTrap(t));

          if (trapTokens.length === 0) {
              return; // No traps on the page
          }
          
          if (Config.DEBUG) {
              TrapUtils.log(`[DEBUG] Running passive checks for moving token '${observerToken.get('name')}' against ${trapTokens.length} traps.`, 'debug');
          }

          const checkPromises = trapTokens.map(trap => {
              return this.runSinglePassiveCheck(observerToken, trap);
          });
          await Promise.all(checkPromises);
      },

      /**
       * Run page-wide passive checks for all player tokens against all traps
       * @param {string} pageId - The page ID to run checks on
       */
      runPageWidePassiveChecks(pageId) {
          if (!pageId) return;
          TrapUtils.log(`Running page-wide passive checks for page ${pageId}.`, 'info');

          // Find all tokens on the page that represent a character
          const allTokensOnPage = findObjs({ _type: 'graphic', _pageid: pageId, layer: 'objects' });
          const playerTokens = allTokensOnPage.filter(t => t.get('represents'));

          // Find all traps on the page
          const trapTokens = allTokensOnPage.filter(t => TrapUtils.isTrap(t));

          if (playerTokens.length > 0 && trapTokens.length > 0) {
              TrapUtils.log(`Found ${playerTokens.length} player tokens and ${trapTokens.length} traps. Checking LOS for all pairs.`, 'debug');
              // For each token, check against each trap
              playerTokens.forEach(pToken => {
                  trapTokens.forEach(tToken => {
                      // Fire-and-forget the async check for each pair
                      this.runSinglePassiveCheck(pToken, tToken);
                  });
              });
          }
      },

      /**
       * Reset detection state for traps
       * @param {object} selectedToken - Optional specific trap token to reset
       * @param {string} playerId - Player ID for messaging
       */
      handleResetDetection(selectedToken, playerId) {
          TrapUtils.log('handleResetDetection called.', 'debug');
          let message = '';

          if (selectedToken && TrapUtils.isTrap(selectedToken)) {
              const trapId = selectedToken.id;
              const trapName = selectedToken.get("name") || `Trap ID ${trapId}`;
              
              if (State.passivelyNoticedTraps && State.passivelyNoticedTraps[trapId]) {
                  // Remove the persistent 'detected' flag from notes
                  let notes = selectedToken.get("gmnotes");
                  let decodedNotes = "";
                  try { 
                      decodedNotes = decodeURIComponent(notes); 
                  } catch (e) { 
                      decodedNotes = notes; 
                  }
                  
                  if (decodedNotes.includes("detected:[on]")) {
                      const updatedNotes = decodedNotes.replace(/\s*detected:\s*\[on\]/, '');
                      selectedToken.set("gmnotes", encodeURIComponent(updatedNotes));
                      TrapUtils.parseTrapNotes(updatedNotes, selectedToken);
                  }
                  
                  delete State.passivelyNoticedTraps[trapId];
                  TrapUtils.log(`Passively noticed state for trap ID '${trapId}' has been cleared.`, 'info');
                  message = `✅ Passive detection state for selected trap '${trapName}' has been reset.`;
              } else {
                  TrapUtils.log(`No passively noticed state found for specific trap ID '${trapId}' to clear.`, 'info');
                  message = `ℹ️ No passive detection state to reset for selected trap '${trapName}'.`;
              }
          } else {
              // Clear the entire passively noticed traps state
              if (Object.keys(State.passivelyNoticedTraps).length > 0) {
                  // Find all traps and reset their auras if they were previously detected
                  const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapUtils.isTrap(t));
                  allTraps.forEach(trapToken => {
                      // Remove persistent flags from all traps
                      let notes = trapToken.get("gmnotes");
                      let decodedNotes = "";
                      try { 
                          decodedNotes = decodeURIComponent(notes); 
                      } catch (e) { 
                          decodedNotes = notes; 
                      }
                      
                      if (decodedNotes.includes("detected:[on]")) {
                          const updatedNotes = decodedNotes.replace(/\s*detected:\s*\[on\]/, '');
                          trapToken.set("gmnotes", encodeURIComponent(updatedNotes));
                          TrapUtils.parseTrapNotes(updatedNotes, trapToken);
                      }
                  });
                  
                  State.passivelyNoticedTraps = {};
                  TrapUtils.log('All passivelyNoticedTraps have been cleared.', 'info');
                  message = '✅ All passive detection states have been reset. Characters will need to re-detect all traps.';
              } else {
                  TrapUtils.log('passivelyNoticedTraps was already empty.', 'info');
                  message = 'ℹ️ No passive detection states were active to reset.';
              }
          }

          // Notify the GM
          if (playerId) {
              TrapUtils.whisper(playerId, message);
          } else {
              TrapUtils.chat(message);
          }
      },

      /**
       * Hide all detection auras temporarily
       * @param {number} durationMinutes - Duration to hide auras (0 for indefinite)
       * @param {string} playerId - Player ID for messaging
       */
      hideAllAuras(durationMinutes, playerId) {
          if (State.hideAurasTimeout) {
              clearTimeout(State.hideAurasTimeout);
              State.hideAurasTimeout = null;
          }

          State.detectionAurasTemporarilyHidden = true;

          const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapUtils.isTrap(t));
          allTraps.forEach(trapToken => {
              this.updateAuraForDetectionRange(trapToken);
          });

          let message = "👁️ All detection auras are now hidden.";
          
          const durationMs = parseFloat(durationMinutes) * 60 * 1000;
          if (!isNaN(durationMs) && durationMs > 0) {
              State.hideAurasTimeout = setTimeout(() => {
                  this.showAllAuras(playerId, true);
              }, durationMs);
              message += ` They will automatically reappear in ${durationMinutes} minute(s).`;
          }

          TrapUtils.whisper(playerId, message);
      },

      /**
       * Show all detection auras
       * @param {string} playerId - Player ID for messaging
       * @param {boolean} isAuto - Whether this was called automatically
       */
      showAllAuras(playerId, isAuto = false) {
          if (State.hideAurasTimeout) {
              clearTimeout(State.hideAurasTimeout);
              State.hideAurasTimeout = null;
          }

          State.detectionAurasTemporarilyHidden = false;

          const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapUtils.isTrap(t));
          allTraps.forEach(trapToken => {
              this.updateAuraForDetectionRange(trapToken);
          });
          
          const message = isAuto 
              ? "⏰ Timer expired. All detection auras have been restored."
              : "👁️ All detection auras are now restored.";

          TrapUtils.whisper(playerId, message);
      },

      /**
       * Show the passive detection setup menu
       * @param {object} trapToken - The trap token to configure
       * @param {string} playerId - Player ID for messaging
       * @param {object} providedTrapData - Optional pre-parsed trap data
       */
      showPassiveSetupMenu(trapToken, playerId, providedTrapData = null) {
          if (!trapToken) {
              TrapUtils.chat("❌ No trap token selected for passive setup.", playerId);
              return;
          }

          const trapConfig = providedTrapData || TrapUtils.parseTrapNotes(trapToken.get("gmnotes")) || {};

          const currentDC = trapConfig.passiveSpotDC || 10;
          const currentRange = trapConfig.passiveMaxRange || 0;
          const currentTokenBar = trapConfig.ppTokenBarFallback || "none";
          const currentLuckRoll = trapConfig.enableLuckRoll || false;
          const currentLuckDie = trapConfig.luckRollDie || "1d6";
          const currentShowAura = trapConfig.showDetectionAura || false;
          trapConfig.passiveEnabled === false ? false : true;

          const PLAYER_MSG_TEMPLATE_NAME = Config.messages.templates.PLAYER_ALERT;
          const PLAYER_MSG_PREFIX = `&{template:default} {{name=${PLAYER_MSG_TEMPLATE_NAME}}} {{message=`;
          const GM_MSG_TEMPLATE_NAME = Config.messages.templates.GM_SPOT;
          const GM_MSG_PREFIX = `&{template:default} {{name=${GM_MSG_TEMPLATE_NAME}}} {{message=`;
          const MSG_SUFFIX = "}}";

          const defaultPlayerMsgContent = Config.messages.defaults.playerNotice;
          const defaultGmMsgContent = Config.messages.defaults.gmNotice;

          // Helper to clean internal backslashes like {placeholder\\} to {placeholder}
          const cleanInternalPlaceholderEscapes = (text) => {
              if (typeof text !== 'string') return text;
              return text.replace(/\\{(\w+)\\\\\\/g, '{$1}');
          };

          const extractMessageContent = (fullStoredMsg, prefix, suffix, defaultContent) => {
              let extractedContent = defaultContent; 

              if (typeof fullStoredMsg === 'string') {
                  if (fullStoredMsg.startsWith(prefix) && fullStoredMsg.endsWith(suffix)) {
                      extractedContent = fullStoredMsg.substring(prefix.length, fullStoredMsg.length - suffix.length);
                  } else { 
                      extractedContent = fullStoredMsg; 
                  }

                  const pipeIndex = extractedContent.indexOf('|');
                  if (pipeIndex !== -1) {
                      let part1 = extractedContent.substring(0, pipeIndex);
                      let part2 = extractedContent.substring(pipeIndex + 1);
                      
                      let cleanedPart1 = cleanInternalPlaceholderEscapes(part1);
                      let cleanedPart2 = cleanInternalPlaceholderEscapes(part2);

                      if (cleanedPart1 === cleanedPart2) { 
                          TrapUtils.log(`[DEBUG] extractMessageContent: Duplicated content (after cleaning internal \\): "${cleanedPart1}". Using cleaned first part.`, 'debug');
                          extractedContent = cleanedPart1; 
                      } else {
                           TrapUtils.log(`[DEBUG] extractMessageContent: Pipe found, but parts differ after cleaning. P1_cleaned: "${cleanedPart1}", P2_cleaned: "${cleanedPart2}". Keeping original and cleaning it: "${extractedContent}"`, 'debug');
                           extractedContent = cleanInternalPlaceholderEscapes(extractedContent);
                      }
                  } else {
                      extractedContent = cleanInternalPlaceholderEscapes(extractedContent);
                  }
              }
              return extractedContent;
          };
          
          let currentPlayerMsgContent = extractMessageContent(trapConfig.passiveNoticePlayer, PLAYER_MSG_PREFIX, MSG_SUFFIX, defaultPlayerMsgContent);
          let currentGmMsgContent = extractMessageContent(trapConfig.passiveNoticeGM, GM_MSG_PREFIX, MSG_SUFFIX, defaultGmMsgContent);
          
          const getSafeQueryDefault = (content) => {
              return content.replace(/\|/g, '##PIPE##') 
                            .replace(/\}/g, '##RBRACE##') 
                            .replace(/\{/g, '##LBRACE##')
                            .replace(/\?/g, '##QMARK##') 
                            .replace(/"/g, '##DQUOTE##')  
                            .replace(/\)/g, '##RPAREN##') 
                            .replace(/\(/g, '##LPAREN##'); 
          };

          const playerMsgQueryDefault = getSafeQueryDefault(currentPlayerMsgContent);
          const gmMsgQueryDefault = getSafeQueryDefault(currentGmMsgContent);

          const sanitizeForMenuPreview = (str, maxLength = 35) => {
              if (!str) return "(Not Set)";
              let preview = str.replace(/&{template:[^}]+}/g, "").replace(/{{[^}]+}}/g, " [...] ");
              preview = preview.replace(/<[^>]+>/g, ""); 
              preview = preview.replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1"); 
              preview = preview.trim();
              if (preview.length > maxLength) preview = preview.substring(0, maxLength - 3) + "...";
              return preview.replace(/&/g, '&amp;').replace(/{/g, '&#123;').replace(/}/g, '&#125;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          };

          const playerMsgPreview = sanitizeForMenuPreview(currentPlayerMsgContent);
          const gmMsgPreview = sanitizeForMenuPreview(currentGmMsgContent);

          // Build placeholder help text
          const placeholderHelp = Object.entries(Config.messages.placeholders)
              .map(([key, desc]) => `- {${key}}: ${desc}`)
              .join("\n");

          const debounceTimeSeconds = (Config.messages.passiveNoticeDebounceTime || 100000) / 1000;

          const menu = [
              "&{template:default}",
              `{{name=🛠️ Passive Setup: ${trapToken.get('name') || 'Unnamed Trap'}}}`,
              `{{Current DC=${currentDC}}}`,
              `{{Current Range from center=${currentRange}ft (0 for none)}}`,
              `{{Detection Aura=${currentShowAura ? 'Enabled' : 'Disabled'}}}`,
              `{{PC Msg Content=${playerMsgPreview}}}`,
              `{{GM Msg Content=${gmMsgPreview}}}`,
              `{{Token Fallback=${currentTokenBar}}}`,
              `{{Luck Roll=${currentLuckRoll ? 'Enabled' : 'Disabled'}}}`,
              `{{Luck Die=${currentLuckDie}}}`,
              "{{Actions=",
              `[Set Trap DC](!trapsystem setpassive dc ${trapToken.id} ?{DC|${currentDC}})`,
              `[Set Range](!trapsystem setpassive range ${trapToken.id} ?{Range ft from Center - 0 for none|${currentRange}})`,
              `[Set PC Msg](!trapsystem setpassive playermsg ${trapToken.id} ?{Player Message with {placeholders}|${playerMsgQueryDefault}})`,
              `[Set GM Msg](!trapsystem setpassive gmmsg ${trapToken.id} ?{GM Message with {placeholders}|${gmMsgQueryDefault}})`,
              `[Toggle Luck](!trapsystem setpassive luckroll ${trapToken.id} ${!currentLuckRoll})`,
              `[Set Luck 🎲](!trapsystem setpassive luckdie ${trapToken.id} ?{Luck Die - e.g., 1d6|${currentLuckDie}})`,
              `[Toggle Detection Range Aura](!trapsystem setpassive showaura ${trapToken.id} ${!currentShowAura})`,
              `[Toggle Passive](!trapsystem setpassive toggle ${trapToken.id})`,
              `[Set TokenBar](!trapsystem setpassive tokenbar ${trapToken.id} ?{Token Bar Fallback - e.g., bar1|bar1 🟢|bar2 🔵|bar3 🔴|none})`,
              "}}",
              "{{⚠️ Notes=",
              "- For custom messages, please avoid using emojis. Your message will be wrapped in a standard alert template which may not display emojis correctly.\n",
              `- Player alerts for identical messages are debounced. If the same alert is triggered for the same character within ${debounceTimeSeconds} seconds, it will be suppressed for that player (GM alerts are not debounced), note distance placeholders will not be treated as identical messages.`,
              "}}",
              `{{⚠️ Help=Available placeholders: \n ${placeholderHelp}}}`
          ];
          TrapUtils.chat(menu.join(" "), playerId);
      },

      /**
       * Handle setting passive detection properties
       * @param {Array} commandParams - Command parameters [property, trapId, ...values]
       * @param {string} playerId - Player ID for messaging
       */
      handleSetPassiveProperty(commandParams, playerId) {
          TrapUtils.log(`[DEBUG] handleSetPassiveProperty received commandParams: ${JSON.stringify(commandParams)}`, 'debug');

          const tempUnescape = (s) => {
              if (typeof s !== 'string') return s;
              let temp = s;
              temp = temp.replace(/##PIPE##/g, "|")
                         .replace(/##RBRACE##/g, "}")
                         .replace(/##LBRACE##/g, "{")
                         .replace(/##QMARK##/g, "?")
                         .replace(/##DQUOTE##/g, '"')
                         .replace(/##RPAREN##/g, ")")
                         .replace(/##LPAREN##/g, "(");
              return temp;
          };

          if (commandParams.length < 2) {
              TrapUtils.chat("❌ Insufficient arguments for setpassive. Expected: property trapId [value]", playerId);
              return;
          }

          const property = commandParams[0].toLowerCase();
          const trapId = commandParams[1];
          let rawValueFromArgs = commandParams.length > 2 ? commandParams.slice(2).join(" ") : "";
          let finalValueToStore = rawValueFromArgs;

          const trapToken = getObj("graphic", trapId);
          if (!trapToken) {
              TrapUtils.chat(`❌ Trap token with ID ${trapId} not found.`, playerId);
              return;
          }

          let trapData = TrapUtils.parseTrapNotes(trapToken.get("gmnotes"));
          
          if (trapData) {
              TrapUtils.log(`[DEBUG] HPSP: trapData directly from parseTrapNotes: passiveNoticeGM='${trapData.passiveNoticeGM}', passiveNoticePlayer='${trapData.passiveNoticePlayer}', passiveSpotDC='${trapData.passiveSpotDC}'`, 'debug');
          } else {
              TrapUtils.log(`[DEBUG] HPSP: parseTrapNotes returned null. Will initialize new trapData.`, 'debug');
          }

          if (!trapData) {
              TrapUtils.log(`No valid trap data found for ${trapId} or notes empty/malformed. Initializing new trapData for passive setup.`, 'warn');
              trapData = {
                  type: "standard", currentUses: 0, maxUses: 0, isArmed: true,
                  primaryMacro: null, options: [], successMacro: null, failureMacro: null,
                  checks: [], movementTrigger: true, autoTrigger: false, position: "intersection",
                  passiveSpotDC: null, passiveMaxRange: null, passiveNoticePlayer: null,
                  passiveNoticeGM: null, ppTokenBarFallback: null, showDetectionAura: false,
                  enableLuckRoll: false, luckRollDie: "1d6",
                  rawTriggerBlock: null, rawDetectionBlock: null
              };
          }
          
          if (property === "playermsg" || property === "gmmsg") {
              let unescapedFullRawInput = tempUnescape(rawValueFromArgs);
              TrapUtils.log(`[DEBUG] HPSP: Unescaped input for ${property}: "${unescapedFullRawInput}"`, 'debug');
              finalValueToStore = unescapedFullRawInput;

              const pipeIndex = finalValueToStore.indexOf('|');
              if (pipeIndex !== -1) {
                  finalValueToStore = finalValueToStore.substring(0, pipeIndex);
                  TrapUtils.log(`[DEBUG] HPSP: Truncated message at pipe. Storing: "${finalValueToStore}"`, 'debug');
              }
          }

          const propToStoreOnTrapData = property === 'dc' ? 'passiveSpotDC' :
                                        property === 'range' ? 'passiveMaxRange' :
                                        property === 'playermsg' ? 'passiveNoticePlayer' :
                                        property === 'gmmsg' ? 'passiveNoticeGM' :
                                        property === 'tokenbar' ? 'ppTokenBarFallback' :
                                        property === 'luckroll' ? 'enableLuckRoll' :
                                        property === 'luckdie' ? 'luckRollDie' :
                                        property === 'showaura' ? 'showDetectionAura' :
                                        property === 'passiveenabled' ? 'passiveEnabled' : null;

          let updateMade = false;

          if (property === "toggle") {
              const currentState = trapData.passiveEnabled === false ? false : true;
              trapData.passiveEnabled = !currentState;
              updateMade = true;
              TrapUtils.log(`Toggled passive detection for trap ${trapId} to ${trapData.passiveEnabled ? 'on' : 'off'}.`, 'info');
          } else if (propToStoreOnTrapData) {
              let valueToSet = finalValueToStore;
              if (property === "dc") {
                  const dcVal = parseInt(valueToSet, 10);
                  if (isNaN(dcVal) || dcVal < 0) { 
                      TrapUtils.chat("❌ Invalid DC value. Must be a non-negative number.", playerId); 
                      return; 
                  }
                  valueToSet = dcVal;
                  // Update token bar when DC is set
                  if (trapToken) {
                      trapToken.set({
                          bar2_value: dcVal,
                          bar2_max: dcVal,
                          showplayers_bar2: false
                      });
                  }
              } else if (property === "range") {
                  const rangeVal = parseFloat(valueToSet);
                  if (isNaN(rangeVal) || rangeVal < 0) { 
                      TrapUtils.chat("❌ Invalid Range value. Must be a non-negative number.", playerId); 
                      return; 
                  }
                  valueToSet = rangeVal;
              } else if (property === "tokenbar") {
                  const parsedValue = String(valueToSet).split(' ')[0].trim();
                  valueToSet = (parsedValue.toLowerCase() === "none" || parsedValue === "") ? null : parsedValue;
              } else if (property === "luckroll") {
                  valueToSet = String(valueToSet).toLowerCase() === "true";
              } else if (property === "luckdie") {
                  if (!/^\d+d\d+$/i.test(valueToSet)) {
                      TrapUtils.chat("❌ Invalid die format. Please use format like '1d6'.", playerId);
                      return;
                  }
                  valueToSet = String(valueToSet).trim();
              } else if (property === "showaura") {
                  valueToSet = String(valueToSet).toLowerCase() === "true";
              }
              
              trapData[propToStoreOnTrapData] = valueToSet;
              updateMade = true;
              TrapUtils.log(`Set trapData.${propToStoreOnTrapData} = ${JSON.stringify(valueToSet)} for trap ${trapId}.`, 'debug');
          } else {
              TrapUtils.chat(`❌ Unknown passive property: ${property}. Use dc, range, playermsg, gmmsg, tokenbar, luckroll, luckdie, showaura, or toggle.`, playerId);
              this.showPassiveSetupMenu(trapToken, playerId);
              return;
          }

          if (updateMade) {
              const newGmNotesString = this.constructGmNotesFromTrapData(trapData);
              
              try {
                  const encodedNewGmNotes = encodeURIComponent(newGmNotesString);
                  trapToken.set("gmnotes", encodedNewGmNotes);
                  TrapUtils.log(`Successfully updated GM notes for trap ${trapId}. New notes (raw): '${newGmNotesString}'`, 'info');
                  
                  // Re-parse to update visuals and get canonical data for menu refresh
                  const newlyParsedData = TrapUtils.parseTrapNotes(encodedNewGmNotes, trapToken);
                  this.updateAuraForDetectionRange(trapToken);
                  this.showPassiveSetupMenu(trapToken, playerId, newlyParsedData);

              } catch (e) {
                  TrapUtils.log(`Error encoding or setting GM notes for trap ${trapId}: ${e.message}`, 'error');
                  TrapUtils.chat("❌ Error saving updated trap settings.", playerId);
              }
          } else {
              this.showPassiveSetupMenu(trapToken, playerId, trapData);
          }  
      },

      /**
       * Construct GM notes from trap data
       * @param {object} trapData - The trap data object
       * @returns {string} - The formatted GM notes string
       */
      constructGmNotesFromTrapData(trapData) {
          if (!trapData) return "";
          TrapUtils.log(`[constructGmNotesFromTrapData] Input trapData: ${JSON.stringify(trapData).substring(0,200)}...`, 'debug');

          // Helper to wrap values containing special characters in quotes
          const formatValue = (value) => {
              if (typeof value !== 'string') return value;
              if (value.includes('[') || value.includes(']')) {
                  const escapedValue = value.replace(/"/g, '\\"');
                  return `"${escapedValue}"`;
              }
              return value;
          };

          let triggerSettings = [];
          if (trapData.type) triggerSettings.push(`type:[${trapData.type}]`);
          
          if (trapData.maxUses !== undefined || trapData.currentUses !== undefined) {
               triggerSettings.push(`uses:[${trapData.currentUses || 0}/${trapData.maxUses || 0}]`);
          }
      
          triggerSettings.push(`armed:[${trapData.isArmed ? 'on' : 'off'}]`); 
      
          if (trapData.primaryMacro && trapData.primaryMacro.macro) triggerSettings.push(`primaryMacro:[${formatValue(trapData.primaryMacro.macro)}]`);
          else if (trapData.primaryMacro && typeof trapData.primaryMacro === 'string') triggerSettings.push(`primaryMacro:[${formatValue(trapData.primaryMacro)}]`);

          if (trapData.failureMacro) triggerSettings.push(`failureMacro:[${formatValue(trapData.failureMacro)}]`);
          if (trapData.successMacro) triggerSettings.push(`successMacro:[${formatValue(trapData.successMacro)}]`);
          
          if (trapData.options && trapData.options.length > 0) {
              const formattedOptions = trapData.options.map(opt => opt.macro || opt.name).join(';');
              triggerSettings.push(`options:[${formattedOptions}]`);
          }
          
          if (trapData.checks && trapData.checks.length > 0) {
              const formattedChecks = trapData.checks.map(check => `${check.type}:${check.dc}`).join(';');
              triggerSettings.push(`checks:[${formattedChecks}]`);
          }
          
          if (trapData.position !== undefined) {
              if (typeof trapData.position === 'object' && trapData.position.x !== undefined && trapData.position.y !== undefined) {
                  triggerSettings.push(`position:[${trapData.position.x},${trapData.position.y}]`);
              } else {
                  triggerSettings.push(`position:[${trapData.position}]`);
              }
          }
          
          if (trapData.movementTrigger !== undefined) triggerSettings.push(`movementTrigger:[${trapData.movementTrigger ? 'on' : 'off'}]`);
          if (trapData.autoTrigger !== undefined) triggerSettings.push(`autoTrigger:[${trapData.autoTrigger ? 'on' : 'off'}]`);

          let detectionSettings = [];
          if (trapData.passiveSpotDC !== undefined && trapData.passiveSpotDC !== null) detectionSettings.push(`passiveSpotDC:[${trapData.passiveSpotDC}]`);
          if (trapData.passiveMaxRange !== undefined && trapData.passiveMaxRange !== null) detectionSettings.push(`passiveMaxRange:[${trapData.passiveMaxRange}]`);
          if (trapData.passiveNoticePlayer) detectionSettings.push(`passiveNoticePlayer:[${formatValue(trapData.passiveNoticePlayer)}]`);
          if (trapData.passiveNoticeGM) detectionSettings.push(`passiveNoticeGM:[${formatValue(trapData.passiveNoticeGM)}]`);
          if (trapData.ppTokenBarFallback) detectionSettings.push(`ppTokenBarFallback:[${trapData.ppTokenBarFallback}]`);
          if (trapData.enableLuckRoll !== undefined) detectionSettings.push(`enableLuckRoll:[${trapData.enableLuckRoll}]`);
          if (trapData.luckRollDie) detectionSettings.push(`luckRollDie:[${trapData.luckRollDie}]`);
          if (trapData.showDetectionAura !== undefined) detectionSettings.push(`showDetectionAura:[${trapData.showDetectionAura}]`);
          if (trapData.passiveEnabled !== undefined) detectionSettings.push(`passiveEnabled:[${trapData.passiveEnabled ? 'on' : 'off'}]`);
          if (trapData.detected !== undefined) detectionSettings.push(`detected:[${trapData.detected ? 'on' : 'off'}]`);

          let result = '';
          if (triggerSettings.length > 0) {
              result += `{!traptrigger ${triggerSettings.join(' ')}}`;
          }
          if (detectionSettings.length > 0) {
              if (result) result += ' ';
              result += `{!trapdetection ${detectionSettings.join(' ')}}`;
          }

          TrapUtils.log(`[constructGmNotesFromTrapData] Generated notes: ${result}`, 'debug');
          return result;
      }
  };

  // src/trap-macros.js
  // Macro execution & export logic


  // Create TrapSystem reference for compatibility
  const TrapSystem$2 = {
      state: State,
      utils: TrapUtils
  };

  // Build a tag-to-ID mapping for macro placeholder replacement
  function buildTagToIdMap(tokens = []) {
    const tagMap = {};
    tokens.forEach(token => {
      if (!token) return;
      const name = token.get('name') || '';
      if (name.trim()) {
        const tag = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (tag) tagMap[tag] = token.id;
      }
    });
    return tagMap;
  }

  // Replace macro placeholders with actual token IDs
  function replaceMacroPlaceholdersWithTags(macroString, tagToIdMap) {
    if (!macroString || typeof macroString !== 'string') return macroString;
    
    let result = macroString;
    for (const [tag, tokenId] of Object.entries(tagToIdMap)) {
      if (tokenId) {
        // Use escapeRegExp to prevent ReDoS attacks
        const escapedTag = escapeRegExp(tag);
        const regex = new RegExp(`@\\{${escapedTag}\\|([^}]+)\\}`, 'gi');
        result = result.replace(regex, tokenId);
      }
    }
    return result;
  }

  // Execute a macro string (delegates to Roll20's sendChat)
  function executeMacro(macroString, characterName = 'TrapSystem') {
    if (!macroString || typeof macroString !== 'string') {
      TrapUtils.log('Cannot execute empty macro', 'error');
      return false;
    }
    
    try {
      // Handle different macro types
      if (macroString.startsWith('#')) {
        // Roll20 macro - remove # and execute
        const macroName = macroString.slice(1);
        sendChat(characterName, `#${macroName}`);
      } else if (macroString.startsWith('!')) {
        // API command
        sendChat(characterName, macroString);
      } else if (macroString.startsWith('&{')) {
        // Roll template
        sendChat(characterName, macroString);
      } else {
        // Regular chat message
        sendChat(characterName, macroString);
      }
      
      TrapUtils.log(`Executed macro: ${TrapUtils.getSafeMacroDisplayName(macroString)}`, 'success');
      return true;
    } catch (error) {
      TrapUtils.log(`Macro execution failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Process and execute trap macros with token context
  function executeTrapMacros(trapToken, macroList = [], targetTokens = []) {
    if (!trapToken || !Array.isArray(macroList)) return;
    
    const tagMap = buildTagToIdMap([trapToken, ...targetTokens]);
    
    macroList.forEach((macro, index) => {
      if (!macro) return;
      
      const processedMacro = replaceMacroPlaceholdersWithTags(macro, tagMap);
      
      // Add a small delay between macros to prevent spam
      setTimeout(() => {
        executeMacro(processedMacro, trapToken.get('name') || 'Trap');
      }, index * 100);
    });
  }

  // Export trap configuration as a macro
  function exportTrapAsMacro(trapToken) {
    if (!TrapUtils.validateTrapToken(trapToken, 'exportTrapAsMacro')) return null;
    
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
      TrapUtils.log('Legacy utilities not available for export', 'error');
      return null;
    }
    
    const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
    if (!trapData) {
      TrapUtils.log('Invalid trap configuration for export', 'error');
      return null;
    }
    
    // Generate macro command to recreate this trap
    const macroCommand = `!trapsystem create-trap --name "${trapData.name || 'Exported Trap'}" --trigger "${trapData.triggerType || 'movement'}" --dc ${trapData.dc || 15}`;
    
    return {
      name: `Create: ${trapData.name || 'Trap'}`,
      command: macroCommand,
      description: `Creates a trap: ${trapData.name || 'Unnamed'}`
    };
  }

  // Batch export multiple traps
  function exportMultipleTraps(trapTokens = []) {
    const exports = [];
    
    trapTokens.forEach(token => {
      const exported = exportTrapAsMacro(token);
      if (exported) exports.push(exported);
    });
    
    return exports;
  }

  const macroExport = {
      // --- State Capturing ---
      captureTokenState(token) {
          const tokenType = token.get("_type");
          let state = {
              layer: token.get("layer"),
              gmnotes: token.get("gmnotes"),
              name: token.get("name")
          };

          if (tokenType === "graphic") {
              Object.assign(state, {
                  left: token.get("left"),
                  top: token.get("top"),
                  width: token.get("width"),
                  height: token.get("height"),
                  rotation: token.get("rotation"),
                  fliph: token.get("fliph"),
                  flipv: token.get("flipv"),
                  aura1_radius: token.get("aura1_radius"),
                  aura1_color: token.get("aura1_color"),
                  aura1_square: token.get("aura1_square"),
                  aura2_radius: token.get("aura2_radius"),
                  aura2_color: token.get("aura2_color"),
                  aura2_square: token.get("aura2_square"),
                  tint_color: token.get("tint_color"),
                  statusmarkers: token.get("statusmarkers"),
                  bar1_value: token.get("bar1_value"),
                  bar1_max: token.get("bar1_max"),
                  bar2_value: token.get("bar2_value"),
                  bar2_max: token.get("bar2_max"),
                  bar3_value: token.get("bar3_value"),
                  bar3_max: token.get("bar3_max"),
                  light_radius: token.get("light_radius"),
                  light_dimradius: token.get("light_dimradius"),
                  light_otherplayers: token.get("light_otherplayers"),
                  light_hassight: token.get("light_hassight"),
                  light_angle: token.get("light_angle"),
                  light_losangle: token.get("light_losangle"),
                  light_multiplier: token.get("light_multiplier"),
                  adv_fow_view_distance: token.get("adv_fow_view_distance"),
                  imgsrc: token.get("imgsrc")
              });
          } else if (tokenType === "pathv2") {
              Object.assign(state, {
                  path: token.get("path"),
                  fill: token.get("fill"),
                  stroke: token.get("stroke"),
                  stroke_width: token.get("stroke_width"),
                  left: token.get("left"),
                  top: token.get("top"),
                  width: token.get("width"),
                  height: token.get("height"),
                  scaleX: token.get("scaleX"),
                  scaleY: token.get("scaleY"),
                  rotation: token.get("rotation")
              });
          }

          TrapSystem$2.state.macroExportStates[token.id] = state;
          TrapSystem$2.utils.log(`Captured state for ${tokenType} ${token.id}.`, 'debug');
      },

      captureDoorObjectState(doorObj) {
          const doorType = doorObj.get("_type");
          if (doorType === "door" || doorType === "window") {
              TrapSystem$2.state.macroExportDoorStates[doorObj.id] = {
                  isOpen: doorObj.get("isOpen"),
                  isLocked: doorObj.get("isLocked"),
                  isSecret: doorObj.get("isSecret")
              };
              TrapSystem$2.utils.log(`Captured door/window state for ${doorType} ${doorObj.id}.`, 'debug');
          }
      },

      // --- Macro Export ---
      exportMacros() {
          TrapSystem$2.utils.log("Starting macro export and state capture...", 'info');
          let macros = findObjs({ _type: "macro" });
          if (macros.length === 0) {
              TrapSystem$2.utils.log("No macros found to export.", 'warn');
              sendChat("TrapSystem", "/w gm ⚠️ No macros found to export.");
              return;
          }

          TrapSystem$2.state.macroExportedMacros = [];
          TrapSystem$2.state.macroExportStates = {}; // Clear previous states
          TrapSystem$2.state.macroExportDoorStates = {}; // Clear previous door states
          TrapSystem$2.state.macroExportTokensOrderedToFront = [];
          TrapSystem$2.state.macroExportTokensOrderedToBack = [];

          macros.forEach(macro => {
              let action = macro.get("action");
              if (!action) return;

              // Save macro info
              TrapSystem$2.state.macroExportedMacros.push({
                  id: macro.id, // Store ID for easier lookup
                  name: macro.get("name"),
                  action: action
              });

              // Extract token IDs from TokenMod commands within macros
              // New regex to correctly handle token IDs that may contain '--'
              // and stop before the next TokenMod option (e.g., --set, --on) or end of string.
              const tokenModRegex = /!token-mod\s+--ids\s+([-\w\s]*?)(?=\s+--[a-zA-Z][-\w]*|$)/g;
              let match;
              while ((match = tokenModRegex.exec(action)) !== null) {
                  const tokenIdsStr = match[1];
                  if (tokenIdsStr) {
                      const tokenIDs = tokenIdsStr.split(/\s+/);
                      tokenIDs.forEach(id => {
                          // Check if it's a @{selected|token_id} or similar placeholder
                          if (id.startsWith("@{") && id.endsWith("}")) {
                              TrapSystem$2.utils.log(`Skipping placeholder ID in macro export: ${id}`, 'debug');
                              // Optionally, could try to resolve if 'selected' is known at export time, but risky.
                          } else {
                              const token = TrapSystem$2.utils.getObjectById(id);
                              if (token) {
                                  this.captureTokenState(token);
                              } else {
                                  TrapSystem$2.utils.log(`Token ID ${id} from macro not found during export.`, 'warn');
                              }
                          }
                      });
                  }
              }

              // Extract door/window IDs from !door or !window commands
              const doorWindowRegex = /!(?:door|window)\s+([^\s]+)\s+(open|close|lock|unlock|reveal|hide|togglelock|togglesecret|toggleopen)/g;
              while ((match = doorWindowRegex.exec(action)) !== null) {
                  const doorId = match[1];
                   if (doorId.startsWith("@{") && doorId.endsWith("}")) {
                      TrapSystem$2.utils.log(`Skipping placeholder ID in door/window command: ${doorId}`, 'debug');
                  } else {
                      const doorObj = TrapSystem$2.utils.getObjectById(doorId);
                      if (doorObj && (doorObj.get("_type") === "door" || doorObj.get("_type") === "window")) {
                          this.captureDoorObjectState(doorObj);
                      } else {
                           TrapSystem$2.utils.log(`Door/Window ID ${doorId} from macro not found or not a door/window object.`, 'warn');
                      }
                  }
              }
          });

          TrapSystem$2.state.macroExportRecordOrdering = true; // Start listening for manual ordering commands
          TrapSystem$2.utils.log("Macros exported and initial states captured.", 'success');
          sendChat("TrapSystem", "/w gm ✅ **Macros exported & initial states captured!** Subsequent `!token-mod --order` commands will be tracked for reset.");
      },

      // --- State Resetting ---
      resetTokenStates() {
          if (Object.keys(TrapSystem$2.state.macroExportStates).length === 0 &&
              Object.keys(TrapSystem$2.state.macroExportDoorStates).length === 0) {
              TrapSystem$2.utils.log("No token or door/window states to reset.", 'info');
              return false;
          }
          TrapSystem$2.utils.log("Resetting token and door/window states...", 'info');
          let resetCount = 0;

          // Reset general tokens and paths
          Object.keys(TrapSystem$2.state.macroExportStates).forEach(tokenID => {
              let token = TrapSystem$2.utils.getObjectById(tokenID);
              if (token) {
                  let savedState = TrapSystem$2.state.macroExportStates[tokenID];
                  let type = token.get("_type");
                  let changes = {};
                  // Common properties
                  if (savedState.layer !== undefined) changes.layer = savedState.layer;
                  if (savedState.gmnotes !== undefined) changes.gmnotes = savedState.gmnotes; // Restore GM notes
                  if (savedState.name !== undefined) changes.name = savedState.name;

                  if (type === "graphic") {
                      Object.assign(changes, {
                          left: savedState.left,
                          top: savedState.top,
                          width: savedState.width,
                          height: savedState.height,
                          rotation: savedState.rotation,
                          fliph: savedState.fliph,
                          flipv: savedState.flipv,
                          aura1_radius: savedState.aura1_radius ?? "",
                          aura1_color: savedState.aura1_color ?? "transparent",
                          aura1_square: savedState.aura1_square ?? false,
                          aura2_radius: savedState.aura2_radius ?? "",
                          aura2_color: savedState.aura2_color ?? "transparent",
                          aura2_square: savedState.aura2_square ?? false,
                          tint_color: savedState.tint_color ?? "transparent",
                          statusmarkers: savedState.statusmarkers ?? "",
                          bar1_value: savedState.bar1_value ?? null,
                          bar1_max: savedState.bar1_max ?? null,
                          bar2_value: savedState.bar2_value ?? null,
                          bar2_max: savedState.bar2_max ?? null,
                          bar3_value: savedState.bar3_value ?? null,
                          bar3_max: savedState.bar3_max ?? null,
                          light_radius: savedState.light_radius ?? "",
                          light_dimradius: savedState.light_dimradius ?? "",
                          light_otherplayers: savedState.light_otherplayers ?? false,
                          light_hassight: savedState.light_hassight ?? false,
                          light_angle: savedState.light_angle ?? "360",
                          light_losangle: savedState.light_losangle ?? "360",
                          light_multiplier: savedState.light_multiplier ?? "1",
                          adv_fow_view_distance: savedState.adv_fow_view_distance ?? "",
                         // imgsrc: savedState.imgsrc // Be cautious with imgsrc if tokens might be deleted/recreated
                      });
                       if (savedState.imgsrc && token.get('imgsrc') !== savedState.imgsrc) {
                          changes.imgsrc = savedState.imgsrc; // Only set if different to avoid unnecessary changes
                      }
                  } else if (type === "pathv2") {
                      Object.assign(changes, {
                          path: savedState.path,
                          fill: savedState.fill ?? "transparent",
                          stroke: savedState.stroke ?? "#000000",
                          stroke_width: savedState.stroke_width ?? 2,
                          // Path position/size needs to be handled by TokenMod or direct left/top/width/height
                          left: savedState.left, // Assuming these were captured for pathv2 as well
                          top: savedState.top,
                          width: savedState.width,
                          height: savedState.height,
                          scaleX: savedState.scaleX ?? 1,
                          scaleY: savedState.scaleY ?? 1,
                          rotation: savedState.rotation ?? 0
                      });
                  }
                  token.set(changes);
                  TrapSystem$2.utils.log(`Reset ${type} ${tokenID} to saved state.`, 'debug');
                  resetCount++;
              } else {
                  TrapSystem$2.utils.log(`Token ${tokenID} not found during state reset.`, 'warn');
              }
          });

          // Reset Doors/Windows (which are also captured in macroExportStates now if they were in macros)
          // but we also have macroExportDoorStates for doors manipulated by !door commands specifically.
          // Let's ensure these are also reset if they exist.
          Object.keys(TrapSystem$2.state.macroExportDoorStates).forEach(doorID => {
              let door = TrapSystem$2.utils.getObjectById(doorID);
               if (door && (door.get("_type") === "door" || door.get("_type") === "window")) {
                  let savedState = TrapSystem$2.state.macroExportDoorStates[doorID];
                  // Only reset properties that were specifically captured for doors/windows
                  let changes = {
                      isOpen: savedState.isOpen,
                      isLocked: savedState.isLocked,
                      isSecret: savedState.isSecret
                      // DO NOT attempt to set layer or other graphic-like properties here
                      // as they were not captured for doors/windows in getObjectState to avoid errors.
                  };
                  door.set(changes);
                  TrapSystem$2.utils.log(`Reset ${door.get("_type")} ${doorID} to saved minimal state (open/locked/secret).`, 'debug');
                  resetCount++;
              } else {
                  TrapSystem$2.utils.log(`Door/Window ${doorID} not found during state reset.`, 'warn');
              }
          });


          // Restore Z-ordering
          if (TrapSystem$2.state.macroExportTokensOrderedToBack.length > 0) {
              sendChat("API", `!token-mod --ids ${TrapSystem$2.state.macroExportTokensOrderedToBack.join(" ")} --order toback`);
              TrapSystem$2.utils.log(`Sent TokenMod command to move ${TrapSystem$2.state.macroExportTokensOrderedToBack.length} token(s) to back.`, 'info');
              resetCount++; // Count as one operation
          }
          if (TrapSystem$2.state.macroExportTokensOrderedToFront.length > 0) {
              sendChat("API", `!token-mod --ids ${TrapSystem$2.state.macroExportTokensOrderedToFront.join(" ")} --order tofront`);
              TrapSystem$2.utils.log(`Sent TokenMod command to move ${TrapSystem$2.state.macroExportTokensOrderedToFront.length} token(s) to front.`, 'info');
              resetCount++; // Count as one operation
          }

          if (resetCount > 0) {
              TrapSystem$2.utils.log(`Successfully reset ${resetCount} token/door states.`, 'success');
          }
          
          // Clear the stored states after reset, similar to the old MacroExport script
          TrapSystem$2.state.macroExportStates = {};
          TrapSystem$2.state.macroExportDoorStates = {};
          TrapSystem$2.state.macroExportTokensOrderedToFront = [];
          TrapSystem$2.state.macroExportTokensOrderedToBack = [];
          TrapSystem$2.state.macroExportRecordOrdering = false;
          TrapSystem$2.utils.log("Cleared macro export states and stopped order recording after resetStates.", 'info');

          return resetCount > 0;
      },

      resetMacros() {
          if (TrapSystem$2.state.macroExportedMacros.length === 0) {
              TrapSystem$2.utils.log("No exported macros to reset.", 'info');
              return false;
          }
          TrapSystem$2.utils.log("Resetting macros to exported state...", 'info');
          let resetCount = 0;
          TrapSystem$2.state.macroExportedMacros.forEach(savedMacro => {
              const currentMacro = getObj("macro", savedMacro.id); // Find by ID
              if (currentMacro) {
                  if (currentMacro.get("action") !== savedMacro.action) {
                      currentMacro.set({ action: savedMacro.action });
                      TrapSystem$2.utils.log(`Reset macro "${savedMacro.name}" (ID: ${savedMacro.id}).`, 'debug');
                      resetCount++;
                  }
              } else {
                  // Optionally, recreate the macro if it was deleted
                  // createObj('macro', { name: savedMacro.name, action: savedMacro.action, playerid: /* GM's ID or original player */ });
                  // For now, just log if not found.
                  TrapSystem$2.utils.log(`Macro "${savedMacro.name}" (ID: ${savedMacro.id}) not found during reset. It might have been deleted.`, 'warn');
              }
          });
          if (resetCount > 0) {
              TrapSystem$2.utils.log(`Successfully reset ${resetCount} macros.`, 'success');
          }
          return resetCount > 0;
      },

      fullReset() {
          TrapSystem$2.utils.log("Performing full reset of states and macros...", 'info');
          const statesReset = this.resetTokenStates(); // This will now clear its specific states
          const macrosReset = this.resetMacros();

          // Also clear the exported macros themselves on a full reset
          TrapSystem$2.state.macroExportedMacros = []; // Ensure this line is present
          TrapSystem$2.utils.log("Cleared stored macro action list after full reset.", 'info'); // Clarified log

          if (statesReset || macrosReset) {
              sendChat("TrapSystem", "/w gm ✅ **Full reset complete!** States and macros restored to exported versions.");
          } else {
              sendChat("TrapSystem", "/w gm ℹ️ Full reset: No states or macros needed resetting or were available to reset.");
          }
          // resetTokenStates now handles setting macroExportRecordOrdering to false.
          // The log about stopping recording is also fine here as a summary for fullReset.
          TrapSystem$2.utils.log("Full reset concluded. Order recording is off.", 'info');
      },

      // --- Token Order Listening ---
      processOrderCommand(msgContent) {
          if (!TrapSystem$2.state.macroExportRecordOrdering) return;

          let orderType = null;
          if (msgContent.includes("--order tofront")) orderType = 'tofront';
          else if (msgContent.includes("--order toback")) orderType = 'toback';

          if (orderType) {
              TrapSystem$2.utils.log(`Detected token-mod ${orderType} command: ${msgContent}`, 'debug');
              const idsMatch = msgContent.match(/--ids\s+([^\s]+(?:\s+[^\s]+)*)/);
              if (idsMatch && idsMatch[1]) {
                  const tokenIDs = idsMatch[1].split(/\s+/);
                  let targetArray = orderType === 'tofront' ?
                      TrapSystem$2.state.macroExportTokensOrderedToFront :
                      TrapSystem$2.state.macroExportTokensOrderedToBack;

                  tokenIDs.forEach(id => {
                      if (id.startsWith("@{") && id.endsWith("}")) return; // Skip placeholders

                      // Add to the correct array, ensuring no duplicates within that array for this session
                      if (targetArray.indexOf(id) === -1) {
                          targetArray.push(id);
                          TrapSystem$2.utils.log(`Marked token ${id} as moved ${orderType}.`, 'debug');
                      }
                      // Remove from the other array if it was there (e.g., moved to back then to front)
                      let otherArray = orderType === 'tofront' ?
                          TrapSystem$2.state.macroExportTokensOrderedToBack :
                          TrapSystem$2.state.macroExportTokensOrderedToFront;
                      const indexInOther = otherArray.indexOf(id);
                      if (indexInOther > -1) {
                          otherArray.splice(indexInOther, 1);
                      }
                  });
              }
          }
      }
  };

  const macros = {
    buildTagToIdMap,
    replaceMacroPlaceholdersWithTags,
    executeMacro,
    executeTrapMacros,
    exportTrapAsMacro,
    exportMultipleTraps
  };

  // src/trap-commands.js
  // Command parsing and API routing system for TrapSystem v2


  // Create TrapSystem reference for compatibility
  const TrapSystem$1 = {
      utils: TrapUtils
  };

  const Commands = {
      /**
       * Main command parser and router
       * @param {object} msg - The Roll20 chat message object
       */
      handleChatMessage(msg) {
          // Process API commands for token ordering (for macro export system)
          if (msg.type === "api" && msg.content.includes("!token-mod") && msg.content.includes("--order")) {
              macroExport.processOrderCommand(msg.content);
          }

          // Handle different message types
          if (msg.type === "advancedroll") {
              return this.handleAdvancedRoll(msg);
          }
          if (msg.type === "rollresult") {
              return this.handleRollResult(msg);
          }
          if (msg.type !== "api") {
              return; // Not an API command
          }

          // Parse command arguments with proper quote handling
          const args = this.parseCommandArgs(msg.content);
          const command = args[0];

          if (command === "!trapsystem") {
              this.handleTrapSystemCommand(msg, args);
          }
      },

      /**
       * Parse command arguments with proper quote handling
       * @param {string} content - The raw command content
       * @returns {Array} - Array of parsed arguments
       */
      parseCommandArgs(content) {
          return (content.match(/[^\s"]+|"([^"]*)"/g) || []).map(arg => 
              (arg.startsWith('"') && arg.endsWith('"')) ? arg.slice(1, -1) : arg
          );
      },

      /**
       * Handle the main !trapsystem command
       * @param {object} msg - The Roll20 chat message object
       * @param {Array} args - Parsed command arguments
       */
      handleTrapSystemCommand(msg, args) {
          TrapUtils.log(`[API Handler] Received !trapsystem command. Action: ${args[1] || 'help'}. Full args: ${JSON.stringify(args)}`, 'debug');
          
          if (!args[1]) {
              this.showHelpMenu("API");
              return;
          }

          const action = args[1];
          const selectedToken = msg.selected && msg.selected.length > 0 ? getObj("graphic", msg.selected[0]._id) : null;

          // Commands that don't require a selected token
          const noTokenCommands = [
              "enable", "disable", "toggle", "status", "help", "allowall", 
              "exportmacros", "resetstates", "resetmacros", "fullreset", 
              "allowmovement", "resetdetection", "interact", "hidedetection", 
              "showdetection", "passivemenu", "setpassive"
          ];

          if (!selectedToken && !noTokenCommands.includes(action.toLowerCase())) {
              TrapUtils.chat('❌ Error: No token selected for this action!');
              TrapUtils.log(`[API Handler] Action '${action}' requires a selected token, but none was found.`, 'warn');
              return;
          }

          // Route to appropriate handler
          switch (action.toLowerCase()) {
              // Trap Setup Commands
              case "setup":
                  this.handleSetupTrap(selectedToken, args);
                  break;
              case "setupinteraction":
                  this.handleSetupInteractionTrap(selectedToken, args);
                  break;

              // Trap Control Commands
              case "toggle":
                  this.handleToggleTrap(selectedToken, args);
                  break;
              case "status":
                  this.handleTrapStatus(selectedToken, args);
                  break;
              case "trigger":
                  this.handleManualTrigger(selectedToken);
                  break;
              case "showmenu":
                  this.handleShowMenu(selectedToken);
                  break;

              // Movement Commands
              case "allowmovement":
                  this.handleAllowMovement(args, msg);
                  break;
              case "allowall":
                  this.handleAllowAll();
                  break;

              // System Control Commands
              case "enable":
                  this.handleEnableTriggers();
                  break;
              case "disable":
                  this.handleDisableTriggers();
                  break;

              // Interaction Commands
              case "interact":
                  this.handleInteract(args, msg);
                  break;
              case "allow":
                  this.handleAllowAction(args);
                  break;
              case "fail":
                  this.handleFailAction(args);
                  break;
              case "selectcharacter":
                  this.handleSelectCharacter(args);
                  break;
              case "check":
                  this.handleSkillCheck(args, msg);
                  break;
              case "customcheck":
                  this.handleCustomCheck(args);
                  break;
              case "rollcheck":
                  this.handleRollCheck(args, msg);
                  break;
              case "setdc":
                  this.handleSetDC(args);
                  break;
              case "displaydc":
                  this.handleDisplayDC(args);
                  break;

              // Passive Detection Commands
              case "passivemenu":
                  this.handlePassiveMenu(msg);
                  break;
              case "setpassive":
                  this.handleSetPassive(args, msg);
                  break;
              case "resetdetection":
                  this.handleResetDetection(selectedToken, msg);
                  break;
              case "hidedetection":
                  this.handleHideDetection(args, msg);
                  break;
              case "showdetection":
                  this.handleShowDetection(msg);
                  break;

              // Advanced Commands
              case "marktriggered":
                  this.handleMarkTriggered(msg);
                  break;
              case "manualtrigger":
                  this.handleManualMacroTrigger(msg);
                  break;
              case "ignoretraps":
                  this.handleIgnoreTraps(selectedToken);
                  break;
              case "rearm":
                  this.handleRearmTrap(args);
                  break;
              case "resolvemismatch":
                  this.handleResolveMismatch(args);
                  break;

              // Export/Reset Commands
              case "exportmacros":
                  if (!TrapSystem$1.utils.playerIsGM(msg.playerid)) {
                      TrapSystem$1.utils.whisper(msg.playerid, "❌ Only GMs can use macro export commands.");
                      return;
                  }
                  macroExport.exportMacros();
                  break;
              case "resetstates":
                  if (!TrapSystem$1.utils.playerIsGM(msg.playerid)) {
                      TrapSystem$1.utils.whisper(msg.playerid, "❌ Only GMs can use macro export commands.");
                      return;
                  }
                  macroExport.resetTokenStates();
                  break;
              case "resetmacros":
                  if (!TrapSystem$1.utils.playerIsGM(msg.playerid)) {
                      TrapSystem$1.utils.whisper(msg.playerid, "❌ Only GMs can use macro export commands.");
                      return;
                  }
                  macroExport.resetMacros();
                  break;
              case "fullreset":
                  if (!TrapSystem$1.utils.playerIsGM(msg.playerid)) {
                      TrapSystem$1.utils.whisper(msg.playerid, "❌ Only GMs can use macro export commands.");
                      return;
                  }
                  macroExport.fullReset();
                  break;

              // Help Command
              case "help":
                  this.showHelpMenu("TrapSystem");
                  break;

              default:
                  TrapUtils.chat(`❌ Unknown command: ${action}\nUse !trapsystem help for command list`);
          }
      },

      // =====================================================================
      // COMMAND HANDLERS
      // =====================================================================

      /**
       * Handle setup trap command
       */
      handleSetupTrap(selectedToken, args) {
          TrapUtils.log(`[API Handler] Attempting to call setupTrap. Token ID: ${selectedToken ? selectedToken.id : 'null'}. Args for func: ${args.slice(2).join(', ')}`, 'debug');
          try {
              triggers.setupTrap(
                  selectedToken,
                  args[2], // uses
                  args[3], // mainMacro
                  args[4], // optional2
                  args[5], // optional3
                  args[6], // movement
                  args[7]  // autoTrigger
              );
          } catch (e) {
              TrapUtils.log(`[API Handler] ERROR calling setupTrap: ${e.message} ${e.stack}`, 'error');
              TrapUtils.chat('❌ An internal error occurred while trying to setup the standard trap.');
          }
      },

      /**
       * Handle setup interaction trap command
       */
      handleSetupInteractionTrap(selectedToken, args) {
          TrapUtils.log(`[API Handler] Attempting to call setupInteractionTrap. Token ID: ${selectedToken ? selectedToken.id : 'null'}. Raw args for parsing: ${args.slice(2).join(', ')}`, 'debug');
          try {
              if (args.length < 8) {
                  TrapUtils.chat('❌ Error: Missing parameters for interaction trap setup.');
                  return;
              }

              const uses = args[2];
              const primaryMacro = args[3];
              const successMacro = args[4];
              const failureMacro = args[5];

              const autoTriggerEnabled = args[args.length - 1];
              const movement = args[args.length - 2];
              const movementTriggerEnabled = args[args.length - 3];
              
              // Parse skill checks from middle arguments
              const checkArgs = args.slice(6, args.length - 3);
              const checks = this.parseSkillChecks(checkArgs);

              const check1Type = checks[0] ? checks[0].type : "None";
              const check1DC = checks[0] ? checks[0].dc : "10";
              const check2Type = checks[1] ? checks[1].type : "None";
              const check2DC = checks[1] ? checks[1].dc : "10";

              TrapUtils.log(`[API Handler] Parsed for setupInteractionTrap - Uses: ${uses}, PrimaryM: ${primaryMacro}, SuccessM: ${successMacro}, FailM: ${failureMacro}, C1Type: '${check1Type}', C1DC: ${check1DC}, C2Type: '${check2Type}', C2DC: ${check2DC}, MoveEnabled: ${movementTriggerEnabled}, AutoTrigger: ${autoTriggerEnabled}`, 'debug');

              triggers.setupInteractionTrap(
                  selectedToken, uses,
                  primaryMacro, successMacro, failureMacro,
                  check1Type, check1DC,
                  check2Type, check2DC,
                  movementTriggerEnabled,
                  movement, autoTriggerEnabled
              );
          } catch (e) {
              TrapUtils.log(`[API Handler] ERROR in setupInteractionTrap case: ${e.message} ${e.stack}`, 'error');
              TrapUtils.chat('❌ An internal error occurred while trying to setup the interaction trap.');
          }
      },

      /**
       * Parse skill checks from command arguments
       */
      parseSkillChecks(checkArgs) {
          const checks = [];
          let currentSkillParts = [];
          
          for (const arg of checkArgs) {
              if (!isNaN(parseInt(arg))) {
                  // It's a DC number
                  if (currentSkillParts.length > 0) {
                      const skillName = currentSkillParts.join(' ');
                      if (skillName.toLowerCase() !== 'none') {
                          checks.push({ type: skillName, dc: arg });
                      }
                      currentSkillParts = [];
                  }
              } else {
                  // It's part of skill name
                  currentSkillParts.push(arg);
              }
          }
          return checks;
      },

      /**
       * Handle toggle trap command
       */
      handleToggleTrap(selectedToken, args) {
          const tid = args[2] || (selectedToken && selectedToken.id);
          if (!tid) {
              TrapUtils.chat('❌ No token selected or provided to toggle');
              return;
          }
          const tk = getObj("graphic", tid);
          triggers.toggleTrap(tk);
      },

      /**
       * Handle trap status command
       */
      handleTrapStatus(selectedToken, args) {
          const tid = args[2] || (selectedToken && selectedToken.id);
          if (!tid) {
              TrapUtils.chat('❌ No token selected or provided for status');
              return;
          }
          const tk = getObj("graphic", tid);
          triggers.getTrapStatus(tk);
      },

      /**
       * Handle manual trigger command
       */
      handleManualTrigger(selectedToken) {
          if (!selectedToken) {
              TrapUtils.chat('❌ No token selected for trigger');
              return;
          }
          triggers.manualTrigger(selectedToken);
      },

      /**
       * Handle show menu command
       */
      handleShowMenu(selectedToken) {
          if (!selectedToken) {
              TrapUtils.chat('❌ No token selected for showmenu');
              return;
          }
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.showInteractionMenu === 'function') {
              interactionSystem.showInteractionMenu(selectedToken);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle allow movement command
       */
      handleAllowMovement(args, msg) {
          const movementTokenId = args[2] && args[2].trim();
          if (movementTokenId === 'selected') {
              if (!msg.selected || msg.selected.length === 0) {
                  TrapUtils.chat("❌ Error: No token selected!");
                  return;
              }
              triggers.allowMovement(msg.selected[0]._id);
          } else if (movementTokenId) {
              triggers.allowMovement(movementTokenId);
          } else {
              TrapUtils.chat("❌ Error: No token specified!");
          }
      },

      /**
       * Handle allow all movement command
       */
      handleAllowAll() {
          triggers.allowAllMovement();
      },

      /**
       * Handle enable triggers command
       */
      handleEnableTriggers() {
          triggers.enableTriggers();
      },

      /**
       * Handle disable triggers command
       */
      handleDisableTriggers() {
          triggers.disableTriggers();
      },

      /**
       * Handle interact command
       */
      handleInteract(args, msg) {
          if (args.length < 4) {
              TrapUtils.chat("❌ Missing parameters for interact");
              return;
          }
          const intToken = getObj("graphic", args[2]);
          if (!intToken) {
              TrapUtils.chat("❌ Invalid trap token ID!");
              return;
          }
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.handleInteraction === 'function') {
              interactionSystem.handleInteraction(intToken, args[3], msg.playerid, args[4]);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle allow action command
       */
      handleAllowAction(args) {
          if (args.length < 4) {
              TrapUtils.chat("❌ Missing parameters for allow command!");
              return;
          }
          const allowToken = getObj("graphic", args[2]);
          if (!allowToken) {
              TrapUtils.chat("❌ Invalid trap token ID!");
              return;
          }
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.handleAllowAction === 'function') {
              interactionSystem.handleAllowAction(allowToken, args[3], args[4]);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle fail action command
       */
      handleFailAction(args) {
          if (args.length < 4) {
              TrapUtils.chat("❌ Error: Missing parameters for fail command!");
              return;
          }
          const failToken = getObj("graphic", args[2]);
          if (!failToken) {
              TrapUtils.chat("❌ Error: Invalid trap token ID!");
              return;
          }
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.handleFailAction === 'function') {
              interactionSystem.handleFailAction(failToken, args[3], args[4]);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle passive menu command
       */
      handlePassiveMenu(msg) {
          if (!msg.selected || msg.selected.length === 0) {
              TrapUtils.chat("❌ Please select a trap token to configure its passive settings.", msg.playerid);
              return;
          }
          const trapForPassiveMenu = getObj("graphic", msg.selected[0]._id);
          PassiveDetection.showPassiveSetupMenu(trapForPassiveMenu, msg.playerid);
      },

      /**
       * Handle set passive property command
       */
      handleSetPassive(args, msg) {
          if (args.length < 4) {
              TrapUtils.chat("❌ Insufficient arguments for setpassive. Expected: property trapId value(s)", msg.playerid);
              return;
          }
          PassiveDetection.handleSetPassiveProperty(args.slice(2), msg.playerid);
      },

      /**
       * Handle reset detection command
       */
      handleResetDetection(selectedToken, msg) {
          PassiveDetection.handleResetDetection(selectedToken, msg.playerid);
      },

      /**
       * Handle hide detection command
       */
      handleHideDetection(args, msg) {
          const duration = args[2] || 0;
          PassiveDetection.hideAllAuras(duration, msg.playerid);
      },

      /**
       * Handle show detection command
       */
      handleShowDetection(msg) {
          PassiveDetection.showAllAuras(msg.playerid);
      },

      /**
       * Handle mark triggered command
       */
      handleMarkTriggered(msg) {
          const parts = msg.content.split(' ');
          if (parts.length < 5) {
              TrapUtils.chat('❌ marktriggered: Missing tokenId, trapId, or identifier!');
              return;
          }
          const tokenId = parts[2];
          const trapId = parts[3];
          const macroIdentifier = parts.slice(4).join(' ');
          triggers.markTriggered(tokenId, trapId, macroIdentifier);
      },

      /**
       * Handle manual macro trigger command
       */
      handleManualMacroTrigger(msg) {
          const parts = msg.content.split(' ');
          if (parts.length < 4) {
              TrapUtils.chat("❌ Missing parameters for manualtrigger!");
              return;
          }
          const trapId = parts[2];
          const macroIdentifier = parts.slice(3).join(' ');
          triggers.manualMacroTrigger(trapId, macroIdentifier);
      },

      /**
       * Handle ignore traps command
       */
      handleIgnoreTraps(selectedToken) {
          if (!selectedToken) {
              TrapUtils.chat('❌ No token selected for ignoretraps');
              return;
          }
          TrapUtils.toggleIgnoreTraps(selectedToken);
      },

      /**
       * Handle rearm trap command
       */
      handleRearmTrap(args) {
          const tid = args[2];
          if (!tid) {
              TrapUtils.chat('❌ No trap ID provided to rearm.');
              return;
          }
          const tk = getObj("graphic", tid);
          if (!tk || !TrapUtils.isTrap(tk)) {
              TrapUtils.chat('❌ Could not find a valid trap with that ID to rearm.');
              return;
          }
          triggers.toggleTrap(tk);
      },

      /**
       * Handle resolve mismatch command (for roll conflicts)
       */
      handleResolveMismatch(args) {
          const entityId = args[2];
          const trapTokenId = args[3];
          const action = args[4];
          const rollValue = args[5] ? parseInt(args[5], 10) : null;
          const rollType = args[6] || 'normal';
          const isAdvantageRoll = args[7] === '1';
          
          let pendingCheck = State.pendingChecksByChar[entityId] || State.pendingChecks[entityId];
          const trapToken = getObj("graphic", trapTokenId);
          
          if (!pendingCheck || !trapToken) {
              TrapUtils.chat('❌ Could not resolve mismatch: missing pending check or trap token.');
              return;
          }

          if (action === 'accept') {
              const rollData = {
                  total: rollValue,
                  firstRoll: rollValue,
                  secondRoll: null,
                  isAdvantageRoll: isAdvantageRoll,
                  rollType: rollType,
                  characterid: pendingCheck.characterId,
                  playerid: pendingCheck.playerid,
                  rolledSkillName: pendingCheck.config.checks[0].type
              };
              TrapUtils.chat('✅ GM accepted the roll. Processing result...');
              
              // Get the interaction system from global TrapSystem
              const interactionSystem = globalThis.TrapSystem?.menu;
              if (interactionSystem && typeof interactionSystem.handleRollResult === 'function') {
                  interactionSystem.handleRollResult(rollData, pendingCheck.playerid);
              }
          } else if (action === 'reject') {
              let playerid = pendingCheck.playerid;
              let checkIndex = pendingCheck.checkIndex || 0;
              let advantageType = pendingCheck.advantage || 'normal';

              // Get the interaction system from global TrapSystem
              const interactionSystem = globalThis.TrapSystem?.menu;
              if (interactionSystem && typeof interactionSystem.handleRollCheck === 'function') {
                  interactionSystem.handleRollCheck(trapToken, checkIndex, advantageType, playerid);
              }
          }
      },

      /**
       * Show the help menu
       */
      showHelpMenu(target = 'API') {
          const skillListForQuery = Object.keys(Config.SKILL_TYPES).join('|');
          const helpMenu = [
              '&{template:default}',
              '{{name=🎯 Trap System Help}}',
              '{{About=The Trap System allows you to create and manage traps, skill checks, and interactions. Traps can be triggered by movement or manually.}}',
              '{{Setup Traps=',
              '[🎯 Setup Standard Trap](!trapsystem setup ?{Uses|1} ?{Main Macro - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes} ?{Optional Macro 2 - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes|None} ?{Optional Macro 3 - #MacroName, &quot;!Command&quot;, &quot;Chat Text&quot; - Note: remember to use quotes|None} ?{Movement - Note: If you select --Grid-- please adjust via the GM Notes|Intersection|Center|Grid} ?{Auto Trigger|false|true})',
              `[🔍 Setup Interaction Trap](!trapsystem setupinteraction ?{Uses|1} ?{Primary Macro - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes|None} ?{Success Macro - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes|None} ?{Failure Macro - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes|None} ?{First Check Type|${skillListForQuery}} ?{First Check DC|10} ?{Second Check Type|None|${skillListForQuery}} ?{Second Check DC|10} ?{Movement Trigger Enabled|true|false} ?{Movement - Note: If you select --Grid-- please adjust via the GM Notes|Intersection|Center|Grid} ?{Auto Trigger|false|true})`,
              '[🛠️ Setup Detection](!trapsystem passivemenu)}}',
              '{{Trap Control=',
              '[🔄 Toggle](!trapsystem toggle) - Toggle selected trap on/off\n',
              '[⚡ Trigger](!trapsystem trigger) - Manually trigger selected trap\n',
              '[🎯 Show Menu](!trapsystem showmenu) - Show the interaction menu\n',
              '[🚶‍♂️ Allow Movement](!trapsystem allowmovement selected) - Allow single token movement\n',
              '[📊 Status](!trapsystem status) - Show trap status}}',
              '{{System Control=',
              '[✅ Enable](!trapsystem enable) - Enable triggers (does not unlock tokens)\n',
              '[❌ Disable](!trapsystem disable) - Disable triggers (does not unlock tokens)\n',
              '[👥 Allow All](!trapsystem allowall) - Allow movement for all locked tokens\n',
              '[🧹 Reset Detection](!trapsystem resetdetection) - Clears all passively noticed traps for all\n',
              '[🙈 Hide Detections](!trapsystem hidedetection ?{Minutes - 0 for indefinitely|0}) - Hide all detection auras (0 = indefinitely)\n',
              '[👁️ Show Detections](!trapsystem showdetection) - Show all detection auras\n',
              '[🛡️ Toggle Immunity](!trapsystem ignoretraps) - Toggle token to ignore traps}}',
              '{{🔄 **Export/Reset Commands**=',
              '[Export Macros](!trapsystem exportmacros) - Capture current macro states and token positions',
              '[Reset States](!trapsystem resetstates) - Reset tokens/doors to exported positions',  
              '[Reset Macros](!trapsystem resetmacros) - Reset macro actions to exported versions',
              '[Full Reset](!trapsystem fullreset) - Reset both states and macros completely',
              '}}',
              '{{Tips=',
              '• <b style="color:#f04747;">Macro Types:</b> Actions can be a Roll20 Macro <span style="color:#ffcb05">#MacroName</span>, an API command <span style="color:#ffcb05">"!command"</span>, or plain chat <span style="color:#ffcb05">"text message"</span>.<br>',
              '• <b style="color:#f04747;">Workarounds:</b> To use API commands or templates in setup, you MUST disguise them. Use <span style="color:#ffcb05">$</span> for commands e.g., <span style="color:#ffcb05">"$deal-damage"</span> and <span style="color:#ffcb05">^</span> for templates e.g., <span style="color:#ffcb05">"^｛template:default｝..."</span>.<br>',
              '• <b style="color:#f04747;">Use Quotes!:</b> When using setup commands, any Text, Template or Command with spaces MUST be wrapped in <span style="color:#ffcb05">"double quotes"</span>.<br>',
              '• <b style="color:#f04747;">Placeholders:</b> Use <span style="color:#ffcb05">&lt;&trap&gt;</span> for the trap token and <span style="color:#ffcb05">&lt;&trapped&gt;</span> for the token that triggered it.<br>',
              '• <b style="color:#f04747;">Token Selection:</b> Most commands require a trap token to be selected first.<br>',
              '• <b style="color:#f04747;">Interaction Traps:</b> You can disable movement triggers on interaction traps to make them manually activated only.<br>',
              '• <b style="color:#f04747;">Skill Checks:</b> Interaction traps accept advantage/disadvantage.}}'
          ].join(' ');
          sendChat(target, `/w GM ${helpMenu}`);
      },

      /**
       * Handle select character command
       */
      handleSelectCharacter(args) {
          if (args.length < 5) {
              TrapUtils.chat("❌ Missing parameters for selectcharacter!");
              return;
          }
          
          const trapToken = getObj("graphic", args[2]);
          const character = getObj("character", args[3]);
          const playerid = args[4];
          const triggeredTokenId = args[5] || null;

          if (!trapToken || !character) {
              TrapUtils.chat("❌ Invalid token or character ID!");
              return;
          }
          
          if (!State.pendingChecks[playerid]) {
              State.pendingChecks[playerid] = {};
          }
          
          State.pendingChecks[playerid].characterId = character.id;
          State.pendingChecks[playerid].characterName = character.get("name");
          State.pendingChecks[playerid].triggeredTokenId = triggeredTokenId;
          
          if (State.pendingChecksByChar && character.id) {
              State.pendingChecksByChar[character.id] = {
                  ...State.pendingChecks[playerid],
                  token: trapToken
              };
          }

          TrapUtils.log(`Stored character info - ID:${character.id}, Name:${character.get("name")}, Victim:${triggeredTokenId}`, 'debug');
          
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.showGMResponseMenu === 'function') {
              interactionSystem.showGMResponseMenu(trapToken, playerid, triggeredTokenId);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle skill check command
       */
      handleSkillCheck(args, msg) {
          if (args.length < 5) {
              TrapUtils.chat("❌ Missing parameters for check command!");
              return;
          }
          
          const cToken = getObj("graphic", args[2]);
          if (!cToken) {
              TrapUtils.chat("❌ Invalid trap token ID!");
              return;
          }
          
          let playerid = args[4];
          if (playerid === 'null' || !playerid) {
              playerid = msg.playerid;
              TrapUtils.log(`[FIX] 'check' command playerid was invalid, using msg.playerid: ${playerid}`, 'debug');
          }
          
          const triggeredTokenId = args.length > 5 ? args[5] : null;
          
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.handleSkillCheck === 'function') {
              interactionSystem.handleSkillCheck(cToken, parseInt(args[3], 10), playerid, false, false, 'gm', triggeredTokenId);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle custom check command
       */
      handleCustomCheck(args) {
          if (args.length < 7) {
              TrapUtils.chat("❌ Missing parameters for customcheck command! Requires at least skill and DC.");
              return;
          }
          
          const cToken = getObj("graphic", args[2]);
          if (!cToken) {
              TrapUtils.chat("❌ Invalid trap token ID for customcheck!");
              return;
          }
          
          const playerid = args[3];
          const triggeredTokenId = args[4] !== 'null' ? args[4] : null;
          const dc = args[args.length - 1];
          const skillType = args.slice(5, args.length - 1).join(' ');

          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.handleCustomCheck === 'function') {
              interactionSystem.handleCustomCheck(cToken, playerid, triggeredTokenId, skillType, dc);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle roll check command
       */
      handleRollCheck(args, msg) {
          if (args.length < 6) {
              TrapUtils.chat("❌ Missing parameters for rollcheck!");
              return;
          }
          
          const rToken = getObj("graphic", args[2]);
          if (!rToken) {
              TrapUtils.chat("❌ Invalid trap token ID!");
              return;
          }
          
          const checkIndex = args[3];
          const advantage = args[4];
          let playerid = args[5];
          const triggeredTokenId = args.length > 6 ? args[6] : null;

          if (playerid === 'null' || !playerid) {
              playerid = msg.playerid;
              TrapUtils.log(`[FIX] rollcheck playerid was invalid, using msg.playerid: ${playerid}`, 'debug');
          }
          
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.handleRollCheck === 'function') {
              interactionSystem.handleRollCheck(rToken, checkIndex, advantage, playerid, 0, triggeredTokenId);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle set DC command
       */
      handleSetDC(args) {
          if (args.length < 5) {
              TrapUtils.chat("❌ Missing parameters for setdc command!");
              return;
          }
          
          const dToken = getObj("graphic", args[2]);
          if (!dToken) {
              TrapUtils.chat("❌ Invalid trap token ID!");
              return;
          }
          
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.handleSetDC === 'function') {
              interactionSystem.handleSetDC(dToken, args[3], args[4], args[5], args[6] || null);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },

      /**
       * Handle display DC command
       */
      handleDisplayDC(args) {
          if (args.length < 5) {
              TrapUtils.chat("❌ Missing parameters for displaydc!");
              return;
          }
          
          const dToken = getObj("graphic", args[2]);
          if (!dToken) {
              TrapUtils.chat("❌ Invalid trap token ID for displaydc!");
              return;
          }
          
          // Get the interaction system from global TrapSystem
          const interactionSystem = globalThis.TrapSystem?.menu;
          if (interactionSystem && typeof interactionSystem.handleDisplayDC === 'function') {
              interactionSystem.handleDisplayDC(dToken, args[3], args[4]);
          } else {
              TrapUtils.chat('❌ Interaction system not available');
          }
      },
  };

  // src/trap-interaction.js
  // Interaction logic (menus, skill checks) for trap system


  // Perform a skill check against a trap
  function performSkillCheck(characterToken, trapToken, skillType, rollResult = null) {
    if (!characterToken || !trapToken) {
      TrapUtils.log('Invalid tokens for skill check', 'error');
      return { success: false, message: 'Invalid parameters' };
    }
    
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
      return { success: false, message: 'Legacy utilities not available' };
    }
    
    const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
    if (!trapData) {
      return { success: false, message: 'Invalid trap configuration' };
    }
    
    // Get the appropriate DC for this skill type
    let dc = 15; // default
    switch (skillType.toLowerCase()) {
      case 'perception':
        dc = trapData.passivePerception || trapData.dc || 15;
        break;
      case 'investigation':
        dc = trapData.investigationDC || trapData.dc || 15;
        break;
      case 'sleight of hand':
      case 'thieves tools':
        dc = trapData.disarmDC || trapData.dc || 15;
        break;
      default:
        dc = trapData.dc || 15;
    }
    
    // If no roll result provided, we're just setting up the check
    if (rollResult === null) {
      return {
        success: true,
        dc: dc,
        skillType: skillType,
        message: `${skillType} check required (DC ${dc})`
      };
    }
    
    const success = rollResult >= dc;
    const margin = rollResult - dc;
    
    return {
      success: success,
      rollResult: rollResult,
      dc: dc,
      margin: margin,
      skillType: skillType,
      message: success 
        ? `${skillType} check succeeded! (${rollResult} vs DC ${dc}, margin: +${margin})`
        : `${skillType} check failed. (${rollResult} vs DC ${dc}, margin: ${margin})`
    };
  }

  // Handle trap detection attempt
  function handleDetectionAttempt(characterToken, trapToken, rollResult = null) {
    const result = performSkillCheck(characterToken, trapToken, 'Perception', rollResult);
    
    if (result.success && rollResult !== null) {
      // Character successfully detected the trap
      const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
      if (legacyUtils && typeof legacyUtils.updateTrapAura === 'function') {
        legacyUtils.updateTrapAura(trapToken, { isDetected: true });
      }
      
      TrapUtils.log(`${characterToken.get('name')} detected a trap!`, 'success');
      return { ...result, detected: true };
    }
    
    return { ...result, detected: false };
  }

  // Handle trap disarm attempt
  function handleDisarmAttempt(characterToken, trapToken, rollResult = null) {
    const result = performSkillCheck(characterToken, trapToken, 'Sleight of Hand', rollResult);
    
    if (result.success && rollResult !== null) {
      // Character successfully disarmed the trap
      const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
      if (legacyUtils && typeof legacyUtils.toggleTrap === 'function') {
        legacyUtils.toggleTrap(trapToken); // Disarm the trap
      }
      
      TrapUtils.log(`${characterToken.get('name')} disarmed the trap!`, 'success');
      return { ...result, disarmed: true };
    } else if (rollResult !== null && result.margin < -5) {
      // Critical failure - trigger the trap
      TrapUtils.log(`${characterToken.get('name')} triggered the trap while trying to disarm it!`, 'warning');
      
      const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
      if (legacyUtils && typeof legacyUtils.triggerTrap === 'function') {
        legacyUtils.triggerTrap(trapToken, characterToken);
      }
      
      return { ...result, triggered: true };
    }
    
    return { ...result, disarmed: false, triggered: false };
  }

  // Get nearby characters for interaction
  function getNearbyCharacters(trapToken, maxDistance = 30) {
    if (!trapToken) return [];
    
    const pageId = trapToken.get('_pageid');
    const allTokens = findObjs({ _type: 'graphic', _pageid: pageId });
    
    return allTokens.filter(token => {
      // Filter for character tokens (have represents field)
      if (!token.get('represents')) return false;
      
      // Check distance
      const distance = TrapUtils.geometry.calculateTokenDistance(trapToken, token);
      return distance.mapUnitDistance <= maxDistance;
    });
  }

  // Build and send interaction menu
  function showInteractionMenu(trapToken, triggeredTokenId = null) {
    if (!trapToken) return;
    
    try {
      const tokenImgUrl = TrapUtils.getTokenImageURL(trapToken);
      const tokenImage = tokenImgUrl === '👤' 
        ? '👤' 
        : `<img src="${tokenImgUrl}" width="100" height="100" style="display: block; margin: 5px auto;">`;
      const tokenName = trapToken.get('name') || 'Unknown Object';
      const trapData = TrapUtils.parseTrapNotes(trapToken.get('gmnotes'));

      if (!trapData) {
        TrapUtils.log('Invalid trap configuration', 'error');
        return;
      }

      const menu = [
        '&{template:default}',
        `{{name=${tokenName}}}`,
        `{{Description=${tokenImage}}}`,
        `{{State=🎯 ${trapData.isArmed ? 'ARMED' : 'DISARMED'} (${trapData.currentUses}/${trapData.maxUses} uses)}}`
      ];

      // Action buttons section
      if (trapData.isArmed) {
        const triggerCmd = `!trapsystem interact ${trapToken.id} trigger ${triggeredTokenId || ''}`.trim();
        const explainCmd = `!trapsystem interact ${trapToken.id} explain ${triggeredTokenId || ''}`.trim();
        
        let actionButtons = [
          `[🎯 Trigger Action](${triggerCmd})`,
          `[💭 Explain Action](${explainCmd})`
        ];

        // Add "Allow Movement" button if token is locked by this trap
        if (triggeredTokenId) {
          // Check if token is locked (this will need to reference global state when available)
          const lockRecord = globalThis.TrapSystem?.state?.lockedTokens?.[triggeredTokenId];
          if (lockRecord && lockRecord.trapToken === trapToken.id && lockRecord.locked) {
            actionButtons.push(`[⏭️ Allow Move](!trapsystem allowmovement ${triggeredTokenId})`);
          }
        }
        menu.push(`{{Actions=${actionButtons.join(' | ')}}}`);
      }

      // Show trap info if checks exist
      if (trapData.checks && trapData.checks.length > 0) {
        const checkInfo = trapData.checks.map(check => 
          `${Config.SKILL_TYPES[check.type] || '🎲'} ${check.type} (DC ${check.dc})`
        ).join('<br>');
        menu.push(`{{Trap Info=Skill Check:<br>${checkInfo}}}`);
      }

      menu.push(`{{Management=[📊 Status](!trapsystem status ${trapToken.id}) | [🔄 Toggle](!trapsystem toggle ${trapToken.id})}}`);
      sendChat('TrapSystem', `/w gm ${menu.join(' ')}`);
    } catch (err) {
      TrapUtils.log(`Error showing interaction menu: ${err.message}`, 'error');
    }
  }

  // Process interaction command
  function processInteractionCommand(command, args = []) {
    if (!TrapUtils.validateCommandArgs(args, 1, command)) return;
    
    const tokenId = args[0];
    const token = getObj('graphic', tokenId);
    
    if (!token) {
      TrapUtils.log(`Token ${tokenId} not found`, 'error');
      return;
    }
    
    switch (command.toLowerCase()) {
      case 'perception-check':
      case 'detect':
        if (args.length >= 2) {
          const trapId = args[1];
          const trapToken = getObj('graphic', trapId);
          if (trapToken) {
            const result = handleDetectionAttempt(token, trapToken);
            TrapUtils.log(result.message, result.success ? 'success' : 'info');
          }
        }
        break;
        
      case 'disable-check':
      case 'disarm':
        if (args.length >= 2) {
          const trapId = args[1];
          const trapToken = getObj('graphic', trapId);
          if (trapToken) {
            const result = handleDisarmAttempt(token, trapToken);
            TrapUtils.log(result.message, result.success ? 'success' : 'warning');
          }
        }
        break;
        
      case 'interact':
        if (TrapUtils.isTrap(token)) {
          showInteractionMenu(token);
        } else {
          TrapUtils.log('Selected token is not a trap', 'error');
        }
        break;
        
      default:
        TrapUtils.log(`Unknown interaction command: ${command}`, 'error');
    }
  }

  // Handle main interaction commands (trigger, explain, fail)
  function handleInteraction(token, action, playerid, triggeredTokenId = null) {
    TrapUtils.log(`handleInteraction: ${token.id}, action:${action}, playerid:${playerid}, victim:${triggeredTokenId}`, 'debug');
    const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (!config || config.type !== 'interaction') {
      TrapUtils.log('Invalid config or not interaction type', 'debug');
      return;
    }

    const trappedToken = getObj('graphic', triggeredTokenId);
    const tagToIdMap = TrapUtils.buildTagToIdMap(token, trappedToken, null);

    switch (action) {
      case 'trigger':
        if (config.primaryMacro && config.primaryMacro.macro) {
          if (trappedToken) {
            // Mark triggered for later use depletion
            markTriggered(trappedToken.id, token.id, 'primary');
          } else {
            // Manual trigger - just execute macro
            TrapUtils.executeMacro(config.primaryMacro.macro, tagToIdMap);
          }
        } else {
          TrapUtils.chat('⚠️ No Primary Macro defined. Proceeding to skill check menu.');
        }
        
        // Check if this is a simple fire-and-forget trap
        if (config.primaryMacro && !config.successMacro && !config.failureMacro) {
          TrapUtils.log(`Primary-only interaction trap triggered. Resolving immediately.`, 'info');
          if (trappedToken) {
            allowMovement(triggeredTokenId, true);
            TrapUtils.chat(`✅ Trap '${token.get('name')}' triggered and resolved.`);
          } else {
            // Manual trigger - deplete use directly
            const newUses = Math.max(0, config.currentUses - 1);
            TrapUtils.updateTrapUses(token, newUses, config.maxUses, newUses > 0);
            if (newUses <= 0) {
              TrapUtils.chat('💥 Trap depleted.');
            }
          }
          return;
        }
        
        if (trappedToken) {
          showGMResponseMenu(token, playerid, triggeredTokenId);
        } else {
          showCharacterSelectionMenu(token, playerid, triggeredTokenId);
        }
        break;

      case 'fail':
        TrapUtils.log(`Executing failure macro: ${config.failureMacro}`, 'debug');
        if (config.failureMacro) {
          TrapUtils.executeMacro(config.failureMacro, tagToIdMap);
        }
        break;

      case 'explain':
        // Smart path - try to auto-detect character
        if (trappedToken) {
          const charId = trappedToken.get('represents');
          if (charId) {
            const success = prepareSkillCheckState(token, playerid, triggeredTokenId, charId);
            if (success) {
              showGMResponseMenu(token, playerid, triggeredTokenId);
              return;
            }
          }
        }
        // Fallback to manual character selection
        showCharacterSelectionMenu(token, playerid, triggeredTokenId);
        break;
    }
  }

  // Prepare skill check state for a character
  function prepareSkillCheckState(trapToken, gmPlayerId, triggeredTokenId, characterId) {
    if (!trapToken || !gmPlayerId || !triggeredTokenId || !characterId) {
      TrapUtils.log('prepareSkillCheckState: missing arguments', 'error');
      return false;
    }

    const char = getObj('character', characterId);
    if (!char) {
      TrapUtils.log(`Character ${characterId} not found`, 'error');
      return false;
    }

    if (!State.pendingChecks[gmPlayerId]) {
      State.pendingChecks[gmPlayerId] = {};
    }
    
    State.pendingChecks[gmPlayerId].token = trapToken;
    State.pendingChecks[gmPlayerId].playerid = gmPlayerId;
    State.pendingChecks[gmPlayerId].characterId = characterId;
    State.pendingChecks[gmPlayerId].characterName = char.get('name');
    State.pendingChecks[gmPlayerId].triggeredTokenId = triggeredTokenId;
    
    if (State.pendingChecksByChar) {
      State.pendingChecksByChar[characterId] = { ...State.pendingChecks[gmPlayerId] };
    }

    TrapUtils.log(`Skill check state prepared for ${char.get('name')}`, 'debug');
    return true;
  }

  // Show character selection menu
  function showCharacterSelectionMenu(token, playerid, triggeredTokenId = null) {
    const characters = findObjs({ _type: 'character' });
    const tokenName = token.get('name') || 'Unknown Token';
    const iconUrl = TrapUtils.getTokenImageURL(token);
    const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;

    let menu = `&{template:default} {{name=Select Character for Skill Check}}`;
    menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
    menu += `{{Characters=`;

    // Filter to player-controlled characters only
    const filtered = characters.filter(char => {
      const controlledBy = (char.get('controlledby') || '').split(',');
      return controlledBy.some(pid => pid && !TrapUtils.playerIsGM(pid));
    });

    filtered.forEach(char => {
      const charName = char.get('name');
      const charId = char.id;
      menu += `[${charName}](!trapsystem selectcharacter ${token.id} ${charId} ${playerid} ${triggeredTokenId || ''}) `;
    });

    menu += `}}`;
    TrapUtils.chat(menu);
  }

  // Handle skill check setup and display
  function handleSkillCheck(token, checkIndex, playerid, hideDisplayDCButton = false, hideSetDCButton = false, whisperTo = 'gm', triggeredTokenId = null) {
    TrapUtils.log(`handleSkillCheck: ${token.id}, checkIndex:${checkIndex}, playerid:${playerid}`, 'debug');
    const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (!config || !config.checks || (checkIndex !== 'custom' && checkIndex >= config.checks.length)) {
      TrapUtils.log('Invalid config or checkIndex', 'debug');
      return;
    }

    const check = (checkIndex === 'custom' && State.pendingChecks[playerid]?.config?.checks[0])
      ? State.pendingChecks[playerid].config.checks[0]
      : config.checks[checkIndex];

    if (!check) {
      TrapUtils.log('Check object not found', 'debug');
      return;
    }

    const tokenName = token.get('name') || 'Unknown Token';
    const iconUrl = TrapUtils.getTokenImageURL(token);
    const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;
    const emoji = Config.SKILL_TYPES[check.type] || '🎲';
    const skillType = check.type.replace(/_/g, ' ');

    const existingCheck = State.pendingChecks[playerid] || {};

    // Get character details from triggered token
    let charId = existingCheck.characterId || null;
    let charName = existingCheck.characterName || null;
    if (triggeredTokenId && !charId) {
      const victimToken = getObj('graphic', triggeredTokenId);
      if (victimToken) {
        const victimCharId = victimToken.get('represents');
        if (victimCharId) {
          const victimChar = getObj('character', victimCharId);
          if (victimChar) {
            charId = victimChar.id;
            charName = victimChar.get('name');
          }
        }
      }
    }

    const pendingCheck = {
      token: token,
      checkIndex: checkIndex,
      config: { ...config, checks: [check] },
      advantage: null,
      firstRoll: null,
      playerid: playerid,
      characterId: charId,
      characterName: charName,
      triggeredTokenId: triggeredTokenId || existingCheck.triggeredTokenId
    };
    
    State.pendingChecks[playerid] = pendingCheck;
    if (pendingCheck.characterId) {
      State.pendingChecksByChar[pendingCheck.characterId] = pendingCheck;
    }

    const triggeredTokenParam = pendingCheck.triggeredTokenId ? ` ${pendingCheck.triggeredTokenId}` : '';

    let menu = `&{template:default} {{name=${emoji} ${skillType} Check (DC ${check.dc})}}`;
    menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
    menu += `{{Roll=`;
    menu += `[Advantage](!trapsystem rollcheck ${token.id} ${checkIndex} advantage ${playerid}${triggeredTokenParam}) | `;
    menu += `[Normal](!trapsystem rollcheck ${token.id} ${checkIndex} normal ${playerid}${triggeredTokenParam}) | `;
    menu += `[Disadvantage](!trapsystem rollcheck ${token.id} ${checkIndex} disadvantage ${playerid}${triggeredTokenParam})`;

    if (!hideSetDCButton && checkIndex !== 'custom') {
      menu += ` | [Set DC](!trapsystem setdc ${token.id} ?{New DC|${check.dc}} ${playerid} ${check.type.replace(/ /g, '_')}${triggeredTokenParam})`;
    }
    if (!hideDisplayDCButton && !State.displayDCForCheck[playerid]) {
      menu += ` | [Display DC](!trapsystem displaydc ${token.id} ${checkIndex} ${playerid})`;
    }
    menu += `}}`;
    
    if (whisperTo === 'gm') {
      TrapUtils.chat(menu);
    } else {
      sendChat('TrapSystem', menu);
    }
  }

  // Handle roll check (advantage/normal/disadvantage)
  function handleRollCheck(token, checkIndex, advantage, playerid, modifier = 0, triggeredTokenId = null) {
    TrapUtils.log(`handleRollCheck: ${token.id}, advantage:${advantage}, playerid:${playerid}`, 'debug');
    const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (!config) return;

    const check = checkIndex === 'custom'
      ? State.pendingChecks[playerid]?.config.checks[0]
      : config.checks[checkIndex];
    if (!check) return;

    const tokenName = token.get('name') || 'Unknown Token';
    const iconUrl = TrapUtils.getTokenImageURL(token);
    const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;
    const emoji = Config.SKILL_TYPES[check.type] || '🎲';
    const skillType = check.type.replace(/_/g, ' ');

    const existingCheck = State.pendingChecks[playerid] || {};

    const pendingCheck = {
      token: token,
      checkIndex: checkIndex,
      config: { ...config, checks: [check] },
      advantage: advantage,
      firstRoll: null,
      playerid: playerid,
      characterId: existingCheck.characterId,
      characterName: existingCheck.characterName,
      triggeredTokenId: triggeredTokenId
    };

    State.pendingChecks[playerid] = pendingCheck;
    if (pendingCheck.characterId) {
      State.pendingChecksByChar[pendingCheck.characterId] = pendingCheck;
    }

    let rollInstructions = '';
    let rollNote = '';
    if (advantage === 'advantage') {
      rollInstructions = 'Roll with advantage';
      rollNote = 'Using the higher of two rolls';
    } else if (advantage === 'disadvantage') {
      rollInstructions = 'Roll with disadvantage';
      rollNote = 'Using the lower of two rolls';
    } else {
      rollInstructions = 'Roll normally';
    }

    const showDC = State.displayDCForCheck[playerid] === true;
    let menu = `&{template:default} {{name=${emoji} Skill Check Required}}`;
    menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
    menu += `{{Skill=${skillType}}}`;
    if (showDC) menu += `{{DC=${check.dc}}}`;
    menu += `{{Roll Type=${advantage.charAt(0).toUpperCase() + advantage.slice(1)}}}`;
    if (advantage !== 'normal') {
      menu += `{{Instructions=${rollInstructions}}}`;
      menu += `{{Note=${rollNote}}}`;
    } else {
      menu += `{{Instructions=Roll 1d20 using your character sheet or /roll 1d20}}`;
    }
    sendChat('TrapSystem', menu);
  }

  // Show GM response menu after action
  function showGMResponseMenu(token, playerid, triggeredTokenId = null) {
    const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    const tokenName = token.get('name') || 'Unknown Token';
    const iconUrl = TrapUtils.getTokenImageURL(token);
    const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;
    
    let menu = `&{template:default} {{name=GM Response}}`;
    menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
    menu += `{{Action=💭 Explained Action}}`;

    let quickActions = [
      `[✅ Allow Action](!trapsystem allow ${token.id} ${playerid} ${triggeredTokenId || ''})`
    ];

    if (config.failureMacro) {
      quickActions.push(`[❌ Fail Action](!trapsystem fail ${token.id} ${playerid} ${triggeredTokenId || ''})`);
    }

    if (config.checks && config.checks.length > 0) {
      config.checks.forEach((check, index) => {
        const emoji = Config.SKILL_TYPES[check.type] || '🎲';
        quickActions.push(`[${emoji} ${check.type}](!trapsystem check ${token.id} ${index} ${playerid} ${triggeredTokenId || ''})`);
      });
    }

    menu += `{{Quick Actions=${quickActions.join(' | ')}}}`;
    TrapUtils.chat(menu);
  }

  // Handle allow action (success)
  function handleAllowAction(token, playerid, triggeredTokenId = null) {
    const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (config && config.successMacro) {
      const trappedToken = getObj('graphic', triggeredTokenId);
      const tagToIdMap = TrapUtils.buildTagToIdMap(token, trappedToken);
      TrapUtils.executeMacro(config.successMacro, tagToIdMap);
      
      const macroString = config.successMacro.trim();
      if (macroString.startsWith('!') || macroString.startsWith('$') || macroString.startsWith('#')) {
        TrapUtils.whisper(playerid, `✅ Success macro executed.`);
      }
    } else {
      TrapUtils.whisper(playerid, '⚠️ No success macro defined.');
    }

    // Resolve trap state
    if (triggeredTokenId && State.lockedTokens[triggeredTokenId]) {
      State.lockedTokens[triggeredTokenId].macroTriggered = true;
      allowMovement(triggeredTokenId);
    } else {
      // Manual interaction - deplete use
      const trapData = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
      if (trapData && trapData.currentUses > 0) {
        const newUses = trapData.currentUses - 1;
        TrapUtils.updateTrapUses(token, newUses, trapData.maxUses, newUses > 0);
        if (newUses <= 0) {
          TrapUtils.chat('💥 Trap depleted.');
        }
      }
    }
  }

  // Handle fail action
  function handleFailAction(token, playerid, triggeredTokenId = null) {
    const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (config && config.failureMacro) {
      const trappedToken = getObj('graphic', triggeredTokenId);
      const tagToIdMap = TrapUtils.buildTagToIdMap(token, trappedToken);
      TrapUtils.executeMacro(config.failureMacro, tagToIdMap);
      
      const macroString = config.failureMacro.trim();
      if (macroString.startsWith('!') || macroString.startsWith('$') || macroString.startsWith('#')) {
        TrapUtils.whisper(playerid, `❌ Failure macro executed.`);
      }
    } else {
      TrapUtils.whisper(playerid, '⚠️ No failure macro defined.');
    }

    // Resolve trap state
    if (triggeredTokenId && State.lockedTokens[triggeredTokenId]) {
      State.lockedTokens[triggeredTokenId].macroTriggered = true;
      allowMovement(triggeredTokenId);
    } else {
      // Manual interaction - deplete use
      const trapData = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
      if (trapData && trapData.currentUses > 0) {
        const newUses = trapData.currentUses - 1;
        TrapUtils.updateTrapUses(token, newUses, trapData.maxUses, newUses > 0);
        if (newUses <= 0) {
          TrapUtils.chat('💥 Trap depleted.');
        }
      }
    }
  }

  // Stub functions for movement/lock management (will be migrated later)
  function markTriggered(tokenId, trapId, macroIdentifier) {
    TrapUtils.log(`markTriggered: ${tokenId}, ${trapId}, ${macroIdentifier}`, 'debug');
    // This will be fully implemented when we migrate the movement system
  }

  function allowMovement(tokenId, suppressMessage = false) {
    TrapUtils.log(`allowMovement: ${tokenId}`, 'debug');
    // This will be fully implemented when we migrate the movement system
  }

  const interaction = {
    performSkillCheck,
    handleDetectionAttempt,
    handleDisarmAttempt,
    getNearbyCharacters,
    showInteractionMenu,
    processInteractionCommand,
    handleInteraction,
    prepareSkillCheckState,
    showCharacterSelectionMenu,
    handleSkillCheck,
    handleRollCheck,
    showGMResponseMenu,
    handleAllowAction,
    handleFailAction
  };

  // Entry point that stitches the modular files together.
  // For now we export an empty scaffold TrapSystem with utilities.


  const TrapSystem = {
    utils: TrapUtils,
    config: Config,
    state: Config.state,
    // Namespaces to be wired up in later phases
    core: { Config, state: Config.state },
    detection: {
      movement: MovementDetector,
      passive: PassiveDetection
    },
    macros: macros,
    ui: ui
  };

  // Global state for the TrapSystem v2
  globalThis.TrapSystemV2 = {
      Config,
      TrapUtils,
      triggers,
      PassiveDetection,
      interactionSystem: interaction,
      MovementDetector,
      Commands
  };

  // Expose main API for Roll20
  globalThis.TrapSystem = {
      state: Config.state,
      config: Config,
      utils: TrapUtils,
      triggers: triggers,
      menu: interaction,
      detector: MovementDetector,
      passive: PassiveDetection,
      commands: Commands
  };

  // =====================================================================
  // EVENT HANDLERS
  // =====================================================================

  // Main chat message handler
  if (typeof on !== 'undefined') {
      on("chat:message", (msg) => {
          try {
              Commands.handleChatMessage(msg);
          } catch (error) {
              TrapUtils.log(`Error in chat message handler: ${error.message}`, 'error');
          }
      });

      // Token movement and change handler
      on("change:graphic", async (obj, prev) => {
          if (!obj || !prev) return;
          try {
              // Token Locking Logic - prevent locked tokens from moving
              if (State.lockedTokens[obj.id] && (obj.get("left") !== prev.left || obj.get("top") !== prev.top)) {
                  obj.set({ left: prev.left, top: prev.top });
                  return;
              }

              // Movement Trigger Logic - check for trap triggers and passive detection
              if ((obj.get("left") !== prev.left || obj.get("top") !== prev.top) && !TrapUtils.isTrap(obj)) {
                  // Run passive detection checks
                  await PassiveDetection.runPassiveChecksForToken(obj);
                  // Check for trap triggers
                  await MovementDetector.checkTrapTrigger(obj, prev.left, prev.top);
              }

              // Ignore Traps Status Change - handle blue marker removal
              if (obj.get("statusmarkers") !== prev.statusmarkers) {
                  const curMarkers = obj.get("statusmarkers") || "";
                  const prevMarkers = prev.statusmarkers || "";
                  if (prevMarkers.includes("blue") && !curMarkers.includes("blue")) {
                      let notes = obj.get("gmnotes") || "";
                      if (notes.includes("{ignoretraps}")) {
                          obj.set("gmnotes", notes.replace(/\{ignoretraps\}/g, ''));
                          TrapUtils.chat(`Removed ignoretraps tag from ${obj.get("name")||"token"} (blue marker removed)`);
                      }
                  }
              }

              // Trap Token Changes - handle GM notes changes, movement, resizing
              const currentNotesRaw = obj.get("gmnotes") || "";
              const prevNotesRaw = prev.gmnotes || "";

              // Decode both notes to normalize them before comparison
              let currentNotes, prevNotes;
              try { currentNotes = decodeURIComponent(currentNotesRaw); } catch(e) { currentNotes = currentNotesRaw; }
              try { prevNotes = decodeURIComponent(prevNotesRaw); } catch(e) { prevNotes = prevNotesRaw; }

              const notesHaveChanged = prev.hasOwnProperty('gmnotes') && currentNotes !== prevNotes;
              const isCurrentlyTrap = currentNotes.includes("!traptrigger");
              const wasPreviouslyTrap = prevNotes ? prevNotes.includes("!traptrigger") : false;

              // GM Notes were changed
              if (notesHaveChanged) {
                  if (wasPreviouslyTrap && !isCurrentlyTrap) {
                      // Trap config removed - clean up visuals
                      TrapUtils.log(`Trap config removed from ${obj.id}. Clearing visuals.`, 'info');
                      obj.set({
                          bar1_value: null, bar1_max: null, showplayers_bar1: false,
                          aura1_color: "transparent", aura1_radius: "", showplayers_aura1: false,
                          bar2_value: null, bar2_max: null, showplayers_bar2: false,
                          aura2_color: "transparent", aura2_radius: "", showplayers_aura2: false
                      });
                  } else if (isCurrentlyTrap) {
                      // Parse and update trap visuals
                      TrapUtils.parseTrapNotes(currentNotesRaw, obj);
                      PassiveDetection.updateAuraForDetectionRange(obj);
                  }
              }
              
              // Trap token movement, resizing, or rotation
              if (isCurrentlyTrap) {
                  const sizeChanged = obj.get("width") !== prev.width || obj.get("height") !== prev.height;
                  const positionOrRotationChanged = obj.get("left") !== prev.left || obj.get("top") !== prev.top || obj.get("rotation") !== prev.rotation;

                  if (sizeChanged) {
                      // Recalculate auras for resized trap
                      obj.set({ aura1_radius: TrapUtils.calculateDynamicAuraRadius(obj) });
                      PassiveDetection.updateAuraForDetectionRange(obj);
                  }

                  if ((sizeChanged || positionOrRotationChanged) && Object.values(State.lockedTokens).some(lock => lock.trapToken === obj.id)) {
                      // Update positions of tokens locked to this trap
                      for (const lockedTokenId in State.lockedTokens) {
                          const lockData = State.lockedTokens[lockedTokenId];
                          if (lockData.trapToken === obj.id) {
                              const lockedToken = getObj("graphic", lockedTokenId);
                              if (lockedToken && lockData.relativeOffset) {
                                  const newTrapCenter = { x: obj.get('left'), y: obj.get('top') };
                                  const newTrapRotationRad = (obj.get('rotation') || 0) * (Math.PI / 180);
                                  const cosRad = Math.cos(newTrapRotationRad);
                                  const sinRad = Math.sin(newTrapRotationRad);

                                  const rotatedOffsetX = lockData.relativeOffset.x * cosRad - lockData.relativeOffset.y * sinRad;
                                  const rotatedOffsetY = lockData.relativeOffset.x * sinRad + lockData.relativeOffset.y * cosRad;

                                  lockedToken.set({
                                      left: newTrapCenter.x + rotatedOffsetX,
                                      top: newTrapCenter.y + rotatedOffsetY
                                  });
                              }
                          }
                      }
                  }
              }
          } catch (err) {
              TrapUtils.log(`Error in change:graphic handler: ${err.message}`, 'error');
          }
      });

      // Door opening events for passive detection
      on("change:door", (obj, prev) => {
          try {
              const wasJustOpened = obj.get('isOpen') && !prev.isOpen;
              if (wasJustOpened) {
                  TrapUtils.log(`Modern door ${obj.id} was opened. Running passive checks for all tokens on page.`, 'info');
                  PassiveDetection.runPageWidePassiveChecks(obj.get('_pageid'));
              }
          } catch (err) {
              TrapUtils.log(`Error in change:door handler: ${err.message}`, 'error');
          }
      });

      // Legacy door opening events
      on("change:path", (obj, prev) => {
          try {
              const isLegacyDoor = obj.get('layer') === 'walls' && typeof obj.get('door_open') !== 'undefined';
              if (isLegacyDoor) {
                  const wasLegacyDoorOpened = obj.get('door_open') && !prev.door_open;
                  if (wasLegacyDoorOpened) {
                      TrapUtils.log(`Legacy door ${obj.id} was opened. Running passive checks for all tokens on page.`, 'info');
                      PassiveDetection.runPageWidePassiveChecks(obj.get('_pageid'));
                  }
              }
          } catch (err) {
              TrapUtils.log(`Error in change:path handler: ${err.message}`, 'error');
          }
      });

      // System ready handler
      on("ready", () => {
          TrapUtils.log("TrapSystem v2.0 Ready!", 'success');
          
          // Register with CommandMenu if available
          if (typeof CommandMenu !== 'undefined' && CommandMenu.utils && CommandMenu.utils.addInitStatus) {
              CommandMenu.utils.addInitStatus('TrapSystem', 'success', null, 'success');
          }
      });
  }

  console.log('📦 TrapSystem v2 scaffold loaded');
  console.log('🔧 Config loaded:', Config.AURA_COLORS ? 'Complete' : 'Incomplete');
  console.log('TrapSystem v2.0 loaded successfully!');

  exports.TrapSystem = TrapSystem;

  return exports;

})({});
//# sourceMappingURL=TrapSystem-v2.js.map
