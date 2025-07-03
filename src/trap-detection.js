// src/trap-detection.js
// Passive detection logic (line-of-sight, perception checks, aura updates)

import TrapUtils from './trap-utils.js';
import { Config } from './trap-core.js';

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

export const detection = {
  checkLineOfSight,
  canDetectTrap,
  updateTrapAura,
  performPassivePerceptionCheck,
  handlePassiveDetection
};

export default detection;