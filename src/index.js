// Entry point that stitches the modular files together.
// For now we export an empty scaffold TrapSystem with utilities.

import * as TrapUtils from './trap-utils.js';
import { Config, State } from './trap-core.js';

// Placeholder imports – these modules will gradually be filled out.
import './trap-core.js';
import './trap-detection.js';
import { interaction as interactionSystem } from './trap-interaction.js';
import { macros as macroSystem } from './trap-macros.js';
import { ui as uiSystem } from './trap-ui.js';
import './trap-triggers.js';
import { detector } from './trap-detector.js';
import { detection as passiveDetection } from './trap-detection.js';
import { triggers as triggerSystem } from './trap-triggers.js';

const TrapSystem = {
  utils: TrapUtils,
  config: Config,
  state: State,
  // Namespaces to be wired up in later phases
  core: { Config, State },
  detection: {
    movement: detector,
    passive: passiveDetection
  },
  triggers: triggerSystem,
  interaction: interactionSystem,
  macros: macroSystem,
  ui: uiSystem
};

// Expose globally so Roll20 can see it after bundling.
globalThis.TrapSystem = TrapSystem;

console.log('📦 TrapSystem v2 scaffold loaded');
console.log('🔧 Config loaded:', Config.AURA_COLORS ? 'Complete' : 'Incomplete');

export { TrapSystem };