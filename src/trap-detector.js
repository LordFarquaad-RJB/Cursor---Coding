// src/trap-detector.js
// Migration of movement-based detection helpers.

import TrapUtils from './trap-utils.js';
import { Config } from './trap-core.js';

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

export const detector = {
  checkGridOverlap,
  checkLineIntersection,
  calculateTrapPosition
};

export default detector;