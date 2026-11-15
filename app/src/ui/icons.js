// AI disclosure: this file was generated with AI (Claude Code, Anthropic) for the November 2026 UI redesign.
/**
 * Iconos de línea para misiones y pilares (reemplazan a los emojis). Mismo trazo que los iconos
 * de la consola: 24×24, sin relleno, trazo de 1.6 y extremos redondeados; toman el color del texto.
 */
const PATHS = {
  // estación espacial: módulo central, armazón y dos paneles solares
  iss: '<rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M12 5v4.5M12 14.5V19M7 12h2.5M14.5 12H17"/><rect x="2.5" y="7" width="4.5" height="10" rx=".6"/><rect x="17" y="7" width="4.5" height="10" rx=".6"/><path d="M2.5 12H7M17 12h4.5M10 5h4M10 19h4"/>',
  // base lunar: domo sobre el regolito, esclusa y luna creciente
  lunar_base: '<path d="M2.5 19.5h19"/><path d="M5 19.5a7 7 0 0 1 14 0"/><path d="M10.5 19.5v-2.5a1.5 1.5 0 0 1 3 0v2.5"/><path d="M8 15h.01M16 15h.01"/><path d="M18 3.2a2.8 2.8 0 1 0 2.8 3.6 2.2 2.2 0 0 1-2.8-3.6Z"/>',
  // rover presurizado: cabina, chasis, tres ruedas y mástil de antena
  rover: '<path d="M4 15v-4.5a1.5 1.5 0 0 1 1.5-1.5H14l3 3h1.5a1.5 1.5 0 0 1 1.5 1.5V15"/><path d="M3 15h18"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="12" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M8 9V5.5M6 5.5h4"/><path d="M14.5 9.5 16.5 12"/>',
  // Marte: planeta con banda de polvo y cráteres
  mars_base: '<circle cx="12" cy="12" r="8.5"/><path d="M4.2 9.2c2.6 1.2 5.2 1.2 7.8 0s5.2-1.2 7.8 0"/><circle cx="9" cy="15" r="1.4"/><circle cx="15.2" cy="14.2" r=".9"/><path d="M6 17.5c1.5.6 3 .7 4.5.4"/>',
  // traje EVA: casco con visor y hombros del traje
  eva_suit: '<circle cx="12" cy="9" r="6"/><path d="M8.6 8.2a3.4 2.6 0 0 1 6.8 0v1.4a3.4 2.4 0 0 1-6.8 0Z"/><path d="M5.5 21.5v-1.8A4.7 4.7 0 0 1 10.2 15h3.6a4.7 4.7 0 0 1 4.7 4.7v1.8"/><path d="M10 18.5h4"/>',
  // nave en tránsito: cápsula cónica con escudo térmico y ventanilla
  transit_orion: '<path d="M9.5 3.5h5l4.5 12.5H5Z"/><path d="M4 16h16"/><path d="M5.5 19h13"/><path d="M8 21.5h8"/><rect x="10.5" y="8" width="3" height="2.5" rx=".6"/>',
  // prevención: escudo con marca
  prevention: '<path d="M12 3 5 6v5.2c0 4.3 2.9 7.7 7 9.8 4.1-2.1 7-5.5 7-9.8V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  // detección: sensor con ondas
  detection: '<circle cx="12" cy="12" r="1.8"/><path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  // supresión: extintor con válvula y boquilla
  suppression: '<rect x="7.5" y="9" width="7" height="12.5" rx="2.5"/><path d="M9.5 9V6.5h3V9"/><path d="M12.5 6.5h2.5l3.5-2.5"/><path d="M9.5 5H7"/><path d="M7.5 14h7"/>',
};

/** SVG del icono `name` (o vacío si no existe). */
export function micon(name, cls = "") {
  const d = PATHS[name];
  if (!d) return "";
  return `<svg class="micon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
