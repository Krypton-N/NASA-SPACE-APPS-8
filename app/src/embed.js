// AI disclosure: parts of this file were modified with AI (Claude Code, Anthropic) for the November 2026 UI redesign.
/**
 * Vistas del equipo (simuladores y datos de misión) para mostrarse dentro de la consola científica.
 *
 * La consola carga lab.html en un iframe que no se destruye y le indica qué vista mostrar con el hash
 * (#lab3d, #simulator/…, #idle). Así el estado del laboratorio se conserva al ir y volver, y las vistas
 * que no se ven quedan en leave() (el WebGL deja de dibujar). Los enlaces entre vistas se mandan a la
 * consola cambiando su hash, para que la barra lateral y la dirección siempre digan dónde estás.
 */
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/unbounded/500.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/views.css";
import "./styles/embed.css";

import { $, hasWebGL2 } from "./core/dom.js";
import { initI18n } from "./core/i18n.js";
import { hideTip } from "./core/tooltip.js";
import { conditions, gravity, scenario, initScenario } from "./state.js";
import { createControls } from "./ui/controls.js";
import { mountPanorama } from "./views/panorama.js";
import { mountExplorer } from "./views/explorer.js";
import { mountExperiments } from "./views/experiments.js";
import { mountSimulator } from "./views/simulator.js";
import { mountFlame3D } from "./views/flame3dView.js";

// rutas de la app anterior (go("datos", "ensayos/…")) -> clave de la consola
const ROUTES = {
  panorama: () => ["overview", null],
  datos: (sub) => {
    const [part, ...rest] = (sub || "graficas").split("/");
    return part === "ensayos" ? ["records", rest.join("/") || null] : ["flex", null];
  },
  simulador: (sub) => [sub === "2d" ? "simulator" : "lab3d", null],
  asistente: (sub) => ["assistant", sub || null],
};

const embedded = window.parent !== window;

/** Abre una vista: dentro de la consola cambia la dirección de la consola; suelta, la de esta página. */
function go(id, sub = null) {
  const [key, rest] = (ROUTES[id] || (() => [id, sub]))(sub);
  // al asistente se le manda una pregunta; a las demás vistas, una subruta
  const query = rest ? `?${key === "assistant" ? "ask" : "sub"}=${encodeURIComponent(rest)}` : "";
  if (embedded) {
    try {
      window.parent.location.hash = `#/${key}${query}`;
      return;
    } catch { /* otro origen: se abre aquí */ }
  }
  location.hash = `#${key}${rest ? `/${encodeURIComponent(rest)}` : ""}`;
}

async function boot() {
  await initI18n();

  const res = await fetch(`${import.meta.env.BASE_URL}data/dashboard.json`);
  if (!res.ok) throw new Error(`Could not load data (${res.status})`);
  const data = await res.json();
  $("#loading").remove();

  initScenario(data.flex);
  const controls = createControls(conditions);
  const shared = { controls, scenario, gravity };

  const has3D = hasWebGL2();
  const MOUNTS = {
    overview: (el) => mountPanorama(el, data, { go, conditions, gravity }),
    flex: (el) => mountExplorer(el, data, { open: (uid) => go("datos", `ensayos/${uid}`) }),
    records: (el) => mountExperiments(el, data, { go, gravity }),
    lab3d: (el) => (has3D ? mountFlame3D(el, data, shared) : mountSimulator(el, data, shared)),
    simulator: (el) => mountSimulator(el, data, shared),
  };

  const main = $("#main");
  const views = {}; // se montan la primera vez que se abren
  let current = null;

  function show(key, sub) {
    if (!MOUNTS[key]) key = null; // #idle o desconocida: nada visible ni animado
    if (key && key === current) return views[key].view.route?.(sub);
    hideTip();
    if (current) {
      views[current].view.leave?.();
      views[current].el.hidden = true;
    }
    current = key;
    document.body.dataset.view = key || "idle"; // el CSS distingue el laboratorio (sin scroll) del resto
    if (!key) return;
    if (!views[key]) {
      const el = document.createElement("section");
      el.className = "view";
      el.dataset.embedView = key; // data-view ya lo usan las vistas por dentro
      if (key === "lab3d" && !has3D) {
        el.insertAdjacentHTML("beforeend",
          '<p class="dim small">This browser has no WebGL 2 (or it is disabled): showing the 2D charts of the same model.</p>');
      }
      main.appendChild(el);
      views[key] = { el, view: MOUNTS[key](el) || {} };
    }
    views[key].el.hidden = false;
    scrollTo({ top: 0 });
    views[key].view.enter?.(sub);
  }

  const parse = () => {
    const [key, ...rest] = location.hash.slice(1).split("/");
    return [key || (embedded ? "idle" : "overview"), rest.length ? decodeURIComponent(rest.join("/")) : null];
  };
  addEventListener("hashchange", () => show(...parse()));
  show(...parse());
}

boot().catch((err) => {
  console.error(err);
  const box = $("#loading");
  if (box) box.textContent = `Could not start: ${err.message}`;
});
