// Entry point that stitches the modular files together.
// For now we export an empty scaffold TrapSystem with utilities.

import { Config } from './trap-core.js';
import TrapUtils from './trap-utils.js';
import { triggers } from './trap-triggers.js';
import { MovementDetector } from './trap-detector.js';
import { PassiveDetection } from './trap-detection.js';

// Placeholder imports – these modules will gradually be filled out.
import './trap-core.js';
import './trap-utils.js';
import detector from './trap-detector.js';
import interactionSystem from './trap-interaction.js';
import macroSystem from './trap-macros.js';
import uiSystem from './trap-ui.js';

const TrapSystem = {
  utils: TrapUtils,
  config: Config,
  state: Config.state,
  // Namespaces to be wired up in later phases
  core: { Config, state: Config.state },
  detection: {
    movement: detector,
    passive: PassiveDetection
  },
  macros: macroSystem,
  ui: uiSystem
};

// Global state for the TrapSystem v2
globalThis.TrapSystemV2 = {
    Config,
    TrapUtils,
    triggers,
    PassiveDetection,
    interactionSystem,
    MovementDetector
};

// Expose main API for Roll20
globalThis.TrapSystem = {
    state: Config.state,
    config: Config,
    utils: TrapUtils,
    triggers: triggers,
    menu: interactionSystem,
    detector: MovementDetector,
    passive: PassiveDetection
};

console.log('📦 TrapSystem v2 scaffold loaded');
console.log('🔧 Config loaded:', Config.AURA_COLORS ? 'Complete' : 'Incomplete');
console.log('TrapSystem v2.0 loaded successfully!');

export { TrapSystem };