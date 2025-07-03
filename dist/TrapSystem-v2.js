var TrapSystem = (function (exports) {
  'use strict';

  // src/trap-core.js
  // Core configuration and state for TrapSystem v2

  const Config = {
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
  const State = {
    warnedInvalidGridPages: {},
    pendingChecks: {},           // GM playerid -> pending check data
    pendingChecksByChar: {},     // character id -> pending check data  
    displayDCForCheck: {},       // playerid -> boolean (show DC in menus)
    lockedTokens: {},           // token id -> lock data
    triggersEnabled: true       // global trigger state
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

  // Merge into export object
  Object.assign(TrapUtils, {
    playerIsGM,
    chat,
    getGMPlayerIds,
    whisper,
    decodeHtml,
    isTrap,
    getTokenImageURL
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
    const m = decoded.match(/\{!traptrigger\s+([^}]*)\}/i);
    if (!m) return null;
    const body = m[1];
    const getSetting = key => {
      const s = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`, 'i').exec(body);
      return s ? s[1].trim() : null;
    };
    
    const type = getSetting('type') || 'standard';
    const usesStr = getSetting('uses') || '0/0';
    const usesParts = usesStr.match(/(\d+)\/(\d+)/) || [0, 0, 0];
    const currentUses = parseInt(usesParts[1], 10);
    const maxUses = parseInt(usesParts[2], 10);
    const armed = (getSetting('armed') || 'on').toLowerCase() === 'on';
    
    // Extract macros
    const primaryMacro = getSetting('primaryMacro');
    const successMacro = getSetting('successMacro');
    const failureMacro = getSetting('failureMacro');
    const optionsStr = getSetting('options');
    const options = optionsStr ? optionsStr.split(';').map(opt => ({ macro: opt.trim() })).filter(o => o.macro) : [];
    
    // Extract checks
    const checksStr = getSetting('checks');
    const checks = checksStr ? checksStr.split(';').map(chk => {
      const parts = chk.split(':');
      return parts.length === 2 ? { type: parts[0].trim(), dc: parseInt(parts[1], 10) } : null;
    }).filter(Boolean) : [];
    
    // Extract position
    const posStr = getSetting('position') || 'intersection';
    let position = posStr;
    const coordMatch = posStr.match(/(\d+)\s*,\s*(\d+)/);
    if (coordMatch) position = { x: parseInt(coordMatch[1], 10), y: parseInt(coordMatch[2], 10) };
    
    // Extract flags
    const movementTrigger = (getSetting('movementTrigger') || 'on').toLowerCase() === 'on';
    const autoTrigger = (getSetting('autoTrigger') || 'off').toLowerCase() === 'on';

    const data = {
      type,
      currentUses,
      maxUses,
      isArmed: armed,
      primaryMacro: primaryMacro ? { macro: primaryMacro } : null,
      successMacro,
      failureMacro,
      options,
      checks,
      position,
      movementTrigger,
      autoTrigger,
      raw: decoded
    };

    // Minimal visual sync (update aura) if token provided
    if (token) {
      const color = armed ? Config.AURA_COLORS.ARMED : Config.AURA_COLORS.DISARMED;
      token.set({
        aura1_color: color,
        aura1_radius: calculateDynamicAuraRadius(token),
        showplayers_aura1: false,
        bar1_value: currentUses,
        bar1_max: maxUses,
        showplayers_bar1: false
      });
    }
    return data;
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
      const re = new RegExp(`${field}:\\s*\\[[^\\]]*\\]`);
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

  var TrapUtils$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    TrapUtils: TrapUtils,
    calculateDynamicAuraRadius: calculateDynamicAuraRadius,
    chat: chat,
    decodeHtml: decodeHtml,
    default: TrapUtils,
    getGMPlayerIds: getGMPlayerIds,
    getTokenImageURL: getTokenImageURL,
    isTrap: isTrap,
    log: log,
    parseTrapNotes: parseTrapNotes,
    playerIsGM: playerIsGM,
    updateTrapUses: updateTrapUses,
    validateCommandArgs: validateCommandArgs,
    validateTrapToken: validateTrapToken,
    whisper: whisper
  });

  // src/trap-detection.js
  // Passive detection logic (line-of-sight, perception checks, aura updates)


  // Wrapper around legacy LOS check
  function checkLineOfSight(token1, token2) {
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.checkLineOfSight === 'function') {
      return legacyUtils.checkLineOfSight(token1, token2);
    }
    // Simple fallback - just check if tokens are on same page
    return token1.get('_pageid') === token2.get('_pageid');
  }

  // Calculate if a character can potentially spot a trap based on distance and LOS
  function canDetectTrap(characterToken, trapToken, maxDistance = 60) {
    if (!characterToken || !trapToken) return false;
    
    const distance = TrapUtils.geometry.calculateTokenDistance(characterToken, trapToken);
    if (distance.mapUnitDistance > maxDistance) return false;
    
    return checkLineOfSight(characterToken, trapToken);
  }

  // Update trap aura colors based on detection state
  function updateTrapAura(trapToken, detectionState) {
    if (!trapToken) return;
    
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.parseTrapNotes === 'function') {
      const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
      if (!trapData) return;
      
      let auraColor;
      if (detectionState.isDetected) {
        auraColor = trapData.isArmed ? Config.AURA_COLORS.DETECTED : Config.AURA_COLORS.DISARMED_DETECTED;
      } else {
        auraColor = trapData.isArmed ? Config.AURA_COLORS.DETECTION : Config.AURA_COLORS.DISARMED_UNDETECTED;
      }
      
      trapToken.set({
        aura1_color: auraColor,
        aura1_square: false
      });
    }
  }

  // Perform passive perception check for a character against a trap
  function performPassivePerceptionCheck(characterToken, trapToken, passivePerception = 10) {
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.parseTrapNotes === 'function') {
      const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
      if (!trapData || !trapData.passivePerception) return false;
      
      const trapDC = parseInt(trapData.passivePerception) || 15;
      return passivePerception >= trapDC;
    }
    return false;
  }

  // Main passive detection handler
  function handlePassiveDetection(characterToken, nearbyTraps = []) {
    if (!characterToken) return;
    
    nearbyTraps.forEach(trapToken => {
      if (!canDetectTrap(characterToken, trapToken)) return;
      
      // Get character's passive perception (simplified - would need character sheet integration)
      const passivePerception = 10; // Default, should be extracted from character sheet
      
      const isDetected = performPassivePerceptionCheck(characterToken, trapToken, passivePerception);
      
      updateTrapAura(trapToken, { isDetected });
      
      if (isDetected) {
        TrapUtils.log(`${characterToken.get('name')} detected a trap!`, 'success');
      }
    });
  }

  const detection = {
    checkLineOfSight,
    canDetectTrap,
    updateTrapAura,
    performPassivePerceptionCheck,
    handlePassiveDetection
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

  // src/trap-macros.js
  // Macro execution & export logic


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
  function replaceMacroPlaceholdersWithTags(macroString, tagMap = {}) {
    if (!macroString || typeof macroString !== 'string') return macroString;
    
    let processed = macroString;
    
    // Replace @{target|...} patterns
    processed = processed.replace(/@\{target\|([^}]+)\}/g, (match, property) => {
      return `@{target|${property}}`;
    });
    
    // Replace @{selected|...} patterns  
    processed = processed.replace(/@\{selected\|([^}]+)\}/g, (match, property) => {
      return `@{selected|${property}}`;
    });
    
    // Replace custom tags like @{goblin|token_id}
    Object.keys(tagMap).forEach(tag => {
      const regex = new RegExp(`@\\{${tag}\\|([^}]+)\\}`, 'gi');
      processed = processed.replace(regex, (match, property) => {
        if (property === 'token_id') {
          return tagMap[tag];
        }
        return `@{${tagMap[tag]}|${property}}`;
      });
    });
    
    return processed;
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

  const macros = {
    buildTagToIdMap,
    replaceMacroPlaceholdersWithTags,
    executeMacro,
    executeTrapMacros,
    exportTrapAsMacro,
    exportMultipleTraps
  };

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


  // Simple wrapper around legacy overlap check
  function checkGridOverlap(token1, token2) {
    if (!token1 || !token2) return false;
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.checkGridOverlap === 'function') {
      return legacyUtils.checkGridOverlap(token1, token2);
    }
    // Fallback quick bounding-box overlap (approx)
    const dx = Math.abs(token1.get('left') - token2.get('left'));
    const dy = Math.abs(token1.get('top') - token2.get('top'));
    const minDistX = (token1.get('width') + token2.get('width')) / 2;
    const minDistY = (token1.get('height') + token2.get('height')) / 2;
    return dx < minDistX && dy < minDistY;
  }

  function checkLineIntersection(startX, startY, endX, endY, trapToken) {
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.checkLineIntersection === 'function') {
      return legacyUtils.checkLineIntersection(startX, startY, endX, endY, trapToken);
    }
    return null; // simplified fallback
  }

  function calculateTrapPosition(movedToken, trapToken, intersectionPoint) {
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.calculateTrapPosition === 'function') {
      return legacyUtils.calculateTrapPosition(movedToken, trapToken, intersectionPoint);
    }
    return { initial: intersectionPoint, final: intersectionPoint };
  }

  const detector = {
    checkGridOverlap,
    checkLineIntersection,
    calculateTrapPosition
  };

  // Entry point that stitches the modular files together.
  // For now we export an empty scaffold TrapSystem with utilities.


  const TrapSystem = {
    utils: TrapUtils$1,
    config: Config,
    state: State,
    // Namespaces to be wired up in later phases
    core: { Config, State },
    detection: {
      movement: detector,
      passive: detection
    },
    triggers: triggers,
    interaction: interaction,
    macros: macros,
    ui: ui
  };

  // Expose globally so Roll20 can see it after bundling.
  globalThis.TrapSystem = TrapSystem;

  console.log('📦 TrapSystem v2 scaffold loaded');
  console.log('🔧 Config loaded:', Config.AURA_COLORS ? 'Complete' : 'Incomplete');

  exports.TrapSystem = TrapSystem;

  return exports;

})({});
//# sourceMappingURL=TrapSystem-v2.js.map
