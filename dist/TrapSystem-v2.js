var TrapSystem = (function (exports) {
  'use strict';

  // src/trap-core.js
  // Core configuration and state for TrapSystem v2

  const Config = {
    DEFAULT_GRID_SIZE: 70,
    DEFAULT_SCALE: 5};

  // Simple central state store (will be fleshed out later)
  const State = {
    warnedInvalidGridPages: {}
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

  var TrapUtils$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    TrapUtils: TrapUtils,
    chat: chat,
    decodeHtml: decodeHtml,
    default: TrapUtils,
    getGMPlayerIds: getGMPlayerIds,
    getTokenImageURL: getTokenImageURL,
    isTrap: isTrap,
    log: log,
    playerIsGM: playerIsGM,
    validateCommandArgs: validateCommandArgs,
    validateTrapToken: validateTrapToken,
    whisper: whisper
  });

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
    // Namespaces to be wired up in later phases
    core: {},
    detection: detector,
    interaction: {},
    macros: {},
    ui: {}
  };

  // Expose globally so Roll20 can see it after bundling.
  globalThis.TrapSystem = TrapSystem;

  console.log('📦 TrapSystem v2 scaffold loaded');

  exports.TrapSystem = TrapSystem;

  return exports;

})({});
//# sourceMappingURL=TrapSystem-v2.js.map
