// src/trap-ui.js
// Chat/menu rendering utilities.

import TrapUtils from './trap-utils.js';

function buildDefaultTemplate(sections) {
  // sections: array of strings already formatted like "name=..." or "Token=..."
  return `&{template:default} {{${sections.join('}} {{')}}}}`;
}

function sendGM(menuString) {
  TrapUtils.chat(menuString);
}

export const ui = {
  buildDefaultTemplate,
  sendGM
};

export default ui;