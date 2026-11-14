export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

import { nf } from "./i18n.js";

/** Número con `d` decimales según el idioma activo («—» si falta). */
export const fmt = (v, d = 2) => nf(v, d);

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * ¿Hay WebGL 2 (lo que necesita three.js)? Se comprueba una sola vez con un lienzo de prueba que se libera
 * enseguida. `?nowebgl` lo fuerza a falso, para probar el paso automático a las gráficas 2D.
 */
let webgl2 = null;
export function hasWebGL2() {
  if (webgl2 !== null) return webgl2;
  try {
    if (/[?&]nowebgl\b/.test(location.search)) return (webgl2 = false);
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    webgl2 = !!gl;
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

/** Crea un elemento a partir de HTML. */
export function html(str) {
  const t = document.createElement("template");
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

export const FUEL = {
  Heptane: { es: "Heptano", color: "--s-hept" },
  Methanol: { es: "Metanol", color: "--s-meth" },
};
export const END = { Extinction: "Extinción", Completion: "Completa", Disruption: "Disrupción" };
export const FLEX_DOI = "https://doi.org/10.60555/mbq8-0451";

export const ICON = {
  good: '<svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  warn: '<svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5L11 10.5H1z" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M6 5v2.5" stroke="currentColor" stroke-width="1.6"/></svg>',
  crit: '<svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9" stroke="currentColor" stroke-width="2"/></svg>',
};
