// Entry point that stitches the modular files together.
// For now we export an empty scaffold TrapSystem with utilities.

import * as TrapUtils from './trap-utils.js';
import { detector } from './trap-detector.js';

// Placeholder imports – these modules will gradually be filled out.
import './trap-core.js';
import './trap-detection.js';
import './trap-interaction.js';
import './trap-macros.js';
import './trap-ui.js';
import './trap-triggers.js';

const TrapSystem = {
  utils: TrapUtils,
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

export { TrapSystem };