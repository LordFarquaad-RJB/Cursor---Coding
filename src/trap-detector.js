// src/trap-detector.js
// Migration of movement-based detection helpers.

import TrapUtils from './trap-utils.js';
import { Config, State } from './trap-core.js';
import { triggers } from './trap-triggers.js';

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

export const MovementDetector = {
    /**
     * Main movement detection function - checks if a token's movement triggers any traps
     * @param {object} movedToken - The token that moved
     * @param {number} prevX - Previous X position
     * @param {number} prevY - Previous Y position
     */
    async checkTrapTrigger(movedToken, prevX, prevY) {
        if (!movedToken) return;
        
        if (!State.triggersEnabled) {
            TrapUtils.log('Triggers disabled', 'debug');
            return;
        }

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

export default MovementDetector;