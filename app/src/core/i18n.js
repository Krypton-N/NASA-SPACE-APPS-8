/**
 * i18n ligero, estilo gettext: el texto fuente (español) es la clave y el diccionario `en` da su traducción.
 *
 * - `t(es, vars)` traduce una cadena del código e interpola `{nombre}`.
 * - `tr(texto)` traduce un texto ya armado (con números dentro) usando el mismo diccionario.
 * - Un traductor de DOM aplica el diccionario en caliente a nodos de texto y atributos visibles
 *   (title, aria-label, placeholder, alt) y lo deshace al volver a español, sin recargar ni volver a montar
 *   las vistas. Los números de un texto se tratan como comodines: «Las 24 investigaciones» y
 *   «Las 25 investigaciones» comparten la entrada `Las {0} investigaciones`.
 * - Idioma inicial: localStorage → navigator.language → español. Se refleja en <html lang>.
 * - `?i18n=debug` expone `window.__i18n` con los textos vistos y los que faltan por traducir.
 */

const KEY = "fif-lang";
export const LANGS = ["es", "en"];
const LOCALE = { es: "es-MX", en: "en-US" };

let lang = pick();
let dict = null; // { key normalizada -> plantilla en inglés }
let patterns = []; // entradas con comodines de texto {a}, {b}…
const subs = new Set();

function pick() {
  // ?lang=en lo fija la consola que embebe las vistas; no se guarda como preferencia
  const forced = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(forced)) return forced;
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* sin almacenamiento */ }
  const nav = (navigator.languages?.[0] || navigator.language || "es").toLowerCase();
  return nav.startsWith("es") ? "es" : nav.startsWith("en") ? "en" : "es";
}

export const getLang = () => lang;
export const locale = () => LOCALE[lang];

/** Se llama cuando cambia el idioma (después de traducir el DOM). Devuelve la función para desuscribirse. */
export function onLang(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// ---------- números ----------
const nfCache = new Map();
/** Formato numérico según el idioma, con `d` decimales fijos. Sin separador de miles salvo `group: true`. */
export function nf(v, d = 2, { group = false } = {}) {
  if (v == null || Number.isNaN(+v)) return "—";
  const k = `${lang}|${d}|${group}`;
  if (!nfCache.has(k)) nfCache.set(k, new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: group }));
  return nfCache.get(k).format(+v);
}

// ---------- normalización ----------
// un número: 1,234.5 · 0.57 · 2026 (los dígitos subíndice como ₂ no cuentan)
const NUM = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const WS = /\s+/g;

/** Texto → { key, nums }: espacios colapsados y cada número sustituido por {i}. */
function norm(s) {
  const nums = [];
  const key = s.replace(WS, " ").trim().replace(NUM, (m) => `{${nums.push(m) - 1}}`);
  return { key, nums };
}

/** Plantilla inglesa: sus números pasan a {i} si coinciden en valor con un número de la fuente. */
function enTemplate(en, nums) {
  const used = new Set();
  return en.replace(NUM, (m) => {
    const i = nums.findIndex((n, j) => !used.has(j) && n === m);
    if (i < 0) return m;
    used.add(i);
    return `{${i}}`;
  });
}

const fill = (tpl, nums) => tpl.replace(/\{(\d+)\}/g, (m, i) => nums[+i] ?? m);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const NUM_SRC = `(${NUM.source})`;
const cache = new Map();

function compile(src) {
  dict = new Map();
  patterns = [];
  cache.clear();
  for (const [es, en] of Object.entries(src)) {
    const { key, nums } = norm(es);
    const tpl = enTemplate(en, nums);
    if (!/\{[a-z]\}/.test(key)) {
      dict.set(key, tpl);
      continue;
    }
    // patrón: {a} → texto (se traduce aparte), {i} → número; se compara con el texto con espacios colapsados
    const slots = [];
    const re = escRe(key).replace(/\\{([a-z]|\d+)\\}/g, (m, n) => {
      slots.push(n);
      return /\d/.test(n) ? NUM_SRC : "(.+?)";
    });
    patterns.push({ re: new RegExp(`^${re}$`), slots, tpl });
  }
}

/** Traduce un texto completo; null si no hay traducción. */
function lookup(text, depth = 0) {
  const raw = text.replace(WS, " ").trim();
  if (!raw) return null;
  const { key, nums } = norm(raw);
  const hit = dict.get(key);
  if (hit != null) return fill(hit, nums);
  for (const p of patterns) {
    const m = raw.match(p.re);
    if (!m) continue;
    const got = {};
    p.slots.forEach((n, i) => { got[n] = m[i + 1]; });
    return p.tpl.replace(/\{([a-z]|\d+)\}/g, (all, n) => {
      if (!(n in got)) return all;
      return /\d/.test(n) ? got[n] : lookup(got[n], depth + 1) ?? got[n];
    });
  }
  if (depth > 2) return null;
  // signos alrededor: «Cabina ISS.» · «(ver tabla)» · «Contexto:» · « · medido»
  const wrap = raw.match(/^([\s(«"'·•:;,—–-]*)(.*?)([\s).,:;»"'·…]*)$/u);
  if (wrap && (wrap[1] || wrap[3]) && wrap[2]) {
    const inner = lookup(wrap[2], depth + 1);
    if (inner != null) return wrap[1] + inner + wrap[3];
  }
  // piezas separadas por « · », «; » o por frases
  for (const sep of [" · ", "; ", /(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/]) {
    const parts = raw.split(sep);
    if (parts.length < 2) continue;
    let any = false;
    const out = parts.map((p) => {
      const tp = lookup(p, depth + 1);
      if (tp != null) any = true;
      return tp ?? p;
    });
    if (any) return out.join(typeof sep === "string" ? sep : " ");
  }
  return null;
}

/** Traduce `text` al idioma activo (sin cambios en español o si no hay entrada). */
export function tr(text) {
  if (lang === "es" || !dict || text == null) return text;
  const s = String(text);
  let out = cache.get(s);
  if (out === undefined) {
    out = lookup(s);
    if (cache.size > 4000) cache.clear();
    cache.set(s, out);
  }
  if (out == null) {
    miss(s);
    return s;
  }
  const lead = s.match(/^\s*/)[0];
  const trail = s.match(/\s*$/)[0];
  return lead + out + trail;
}

/** Cadena del código (español) → idioma activo, con `{nombre}` interpolado. */
export function t(es, vars) {
  const s = tr(es);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
}

// ---------- depuración: textos vistos y faltantes ----------
const debug = /[?&]i18n=debug\b/.test(location.search);
const seen = debug ? new Set() : null;
const missing = debug ? new Set() : null;
const SPANISH = /[áéíóúñ¿¡]|\b(de|del|la|las|el|los|con|sin|que|para|por|una?|en|es|se|al|más|cómo|qué)\b/i;
function miss(s) {
  if (missing && /[a-zá-ú]{2,}/i.test(s) && SPANISH.test(s)) missing.add(s.replace(WS, " ").trim());
}
if (debug) {
  window.__i18n = {
    seen, missing, tr: (s) => tr(s),
    dump: () => [...seen].sort().join("\n"),
    missingList: () => [...missing].sort().join("\n"),
    scan: () => { missing.clear(); scanMissing(document.body); return [...missing].sort(); },
  };
}

// ---------- traductor de DOM ----------
const ATTRS = ["title", "aria-label", "placeholder", "alt", "label"];
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE"]);
const texts = new WeakMap(); // Text -> { src, out }
const attrs = new WeakMap(); // Element -> { [attr]: { src, out } }
const HAS_LETTER = /\p{L}/u;

const skipped = (el) => !el || SKIP.has(el.nodeName) || !!el.closest?.('[translate="no"]');

function doText(node) {
  const data = node.data;
  if (!HAS_LETTER.test(data)) return;
  const rec = texts.get(node);
  if (rec && data === rec.out) return; // ya traducido (o es nuestra propia escritura)
  if (skipped(node.parentElement)) return;
  if (seen) seen.add(data.replace(WS, " ").trim());
  const out = tr(data);
  texts.set(node, { src: data, out });
  if (out !== data) node.data = out;
}

function doAttrs(el) {
  if (skipped(el)) return;
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const v = el.getAttribute(a);
    if (!HAS_LETTER.test(v)) continue;
    let rec = attrs.get(el);
    if (rec?.[a] && v === rec[a].out) continue;
    if (seen) seen.add(v.replace(WS, " ").trim());
    const out = tr(v);
    if (!rec) attrs.set(el, (rec = {}));
    rec[a] = { src: v, out };
    if (out !== v) el.setAttribute(a, out);
  }
}

function walk(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) {
    if (skipped(root)) return;
    doAttrs(root);
  }
  const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.nodeName) || n.getAttribute("translate") === "no") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === 3) doText(n);
    else doAttrs(n);
  }
}

/** Vuelve todo el DOM al texto fuente (español). */
function restore(root) {
  const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = root; n; n = it.nextNode()) {
    if (n.nodeType === 3) {
      const rec = texts.get(n);
      if (rec) {
        if (n.data === rec.out) n.data = rec.src;
        texts.delete(n);
      }
    } else if (n.nodeType === 1) {
      const rec = attrs.get(n);
      if (rec) {
        for (const [a, { src, out }] of Object.entries(rec)) if (n.getAttribute(a) === out) n.setAttribute(a, src);
        attrs.delete(n);
      }
    }
  }
}

function scanMissing(root) {
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (skipped(n.parentElement) || !HAS_LETTER.test(n.data)) continue;
    const rec = texts.get(n);
    if (!rec || rec.out === rec.src) miss(n.data);
  }
  root.querySelectorAll("[title],[aria-label],[placeholder],[alt]").forEach((el) => {
    if (skipped(el)) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const rec = attrs.get(el)?.[a];
      if (!rec || rec.out === rec.src) miss(el.getAttribute(a));
    }
  });
}

const observer = new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === "childList") r.addedNodes.forEach(walk);
    else if (r.type === "characterData") doText(r.target);
    else if (r.type === "attributes") doAttrs(r.target);
  }
});

function observe(on) {
  if (on) observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  else observer.disconnect();
}

// ---------- <head> ----------
let headSrc = null;
function paintHead() {
  const meta = document.querySelector('meta[name="description"]');
  if (headSrc == null) headSrc = { title: document.title, desc: meta?.content ?? "" };
  document.title = tr(headSrc.title);
  if (meta) meta.content = tr(headSrc.desc);
  document.documentElement.lang = lang;
}

async function load(l) {
  if (l === "en" && !dict) compile((await import("../i18n/en.js")).default);
}

/** Carga el diccionario del idioma inicial y arranca el traductor. Llamar una vez antes de pintar las vistas. */
export async function initI18n() {
  await load(lang).catch((err) => { console.error(err); lang = "es"; });
  paintHead();
  if (lang !== "es" || debug) {
    walk(document.body);
    observe(true);
  }
}

/** Cambia el idioma en caliente: traduce (o restaura) el DOM y avisa a los suscriptores. */
export async function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  await load(l);
  try { localStorage.setItem(KEY, l); } catch { /* sin almacenamiento */ }
  observe(false);
  restore(document.body);
  lang = l;
  nfCache.clear();
  paintHead();
  if (lang !== "es" || debug) {
    walk(document.body);
    observe(true);
  }
  subs.forEach((fn) => fn(lang));
  // las pestañas y otros elementos miden su ancho: que se recoloquen
  dispatchEvent(new Event("resize"));
}

/** Selector ES | EN para el encabezado. */
export function langSwitch() {
  const box = document.createElement("div");
  box.className = "lang-switch";
  box.setAttribute("role", "group");
  box.setAttribute("translate", "no");
  const label = () => (lang === "en" ? "Language" : "Idioma");
  box.innerHTML = LANGS.map((l) => `<button type="button" lang="${l}" data-lang="${l}" title="${l === "en" ? "English" : "Español"}">${l.toUpperCase()}</button>`).join("");
  const sync = () => {
    box.setAttribute("aria-label", label());
    box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  };
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) setLang(b.dataset.lang);
  });
  onLang(sync);
  sync();
  return box;
}
