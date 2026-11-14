/*
 * Nivel de calidad del laboratorio 3D y opciones de depuración leídas de la URL.
 *   ?q=low|med|high  fuerza un nivel
 *   ?legacy3d        dibuja como antes (sin post-procesado), de respaldo para la demo
 *   ?flameMode=legacy  la llama de capas de antes (plan B), con el post-procesado nuevo
 *   ?debug           muestra cuadros por segundo, llamadas de dibujo y memoria
 *   ?pose=drop|ignition|rack|needles|hibms|lluv  fija una de las 6 poses de captura (en pausa, sin giro)
 * Sin ?q, la densidad de píxeles se ajusta sola si el cuadro no llega a 30 fps (ver createAdaptive).
 */

// van antes del hash: /?debug&q=high#simulador/3d
const params = () => {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
};

/** Las 6 poses fijas de los criterios de aceptación (capturas antes/después con el mismo encuadre). */
export const POSES = ["drop", "ignition", "rack", "needles", "hibms", "lluv"];

export const LEVELS = {
  low: { dpr: 1, multisampling: 0, smaa: true, bloomLevels: 5, monitors: false },
  med: { dpr: 1.5, multisampling: 0, smaa: true, bloomLevels: 7, monitors: true },
  high: { dpr: 2, multisampling: 4, smaa: false, bloomLevels: 8, monitors: true },
};

export function readOptions() {
  const p = params();
  const forced = p.get("q");
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const legacy = p.has("legacy3d");
  const debug = p.has("debug");
  // el respaldo dibuja exactamente como antes: sin niveles de calidad
  const pose = POSES.includes(p.get("pose")) ? p.get("pose") : null;
  if (legacy) return { level: "legacy", ...LEVELS.high, dpr: 2, monitors: true, legacy, debug, flame: "legacy", pose, adaptive: false };
  const level = LEVELS[forced] ? forced : coarse ? "low" : "med";
  // ?flameMode=legacy: la llama de capas de antes, con el post-procesado nuevo
  const flame = p.get("flameMode") === "legacy" ? "legacy" : "volume";
  // el ajuste automático no actúa si el nivel se fijó a mano o en las poses de captura (deben ser reproducibles)
  return { level, ...LEVELS[level], legacy, debug, flame, pose, adaptive: !LEVELS[forced] && !pose };
}

/**
 * Densidad de píxeles adaptativa. Mide la duración real de los cuadros (entre requestAnimationFrame) y,
 * si la media pasa de 36 ms en dos ventanas seguidas, baja un escalón la densidad de píxeles: solo cambia el
 * tamaño de los búferes, no se recompila nada. Si sobra mucho margen al arrancar, sube un escalón, pero
 * nunca vuelve a subir después de haber bajado (histéresis). `apply(dpr)` aplica el cambio.
 * Se usa la media y no la mediana: con la GPU saturada, el navegador entrega cuadros de ~17 ms
 * intercalados con otros de 60-90 ms, y la mediana ocultaría que el ritmo real no llega a 30 fps.
 * El margen sobre 33.3 ms y las dos ventanas evitan bajar sin motivo cuando el navegador limita el ritmo
 * a 30 Hz (ahorro de energía, escritorio remoto): ahí unos pocos cuadros tardíos no son falta de GPU.
 */
export function createAdaptive({ max, min = 0.75, apply }) {
  const STEPS = [2, 1.75, 1.5, 1.25, 1, 0.85, 0.75].filter((s) => s <= max + 1e-6 && s >= min - 1e-6);
  if (!STEPS.length) return { sample() {}, get dpr() { return max; } };
  let i = 0; // empieza en el máximo permitido
  let lowered = false;
  let raised = false;
  let bad = 0;
  let buf = [];
  let skip = 30; // los primeros cuadros tras arrancar o tras un cambio no cuentan (compilación, subida de texturas)
  return {
    /** `ms`: duración del último cuadro. `steady`: la cámara está quieta en su sitio (no en la entrada). */
    sample(ms, steady) {
      if (!steady || ms > 250) { buf = []; return; } // pestaña en segundo plano o un tirón aislado
      if (skip > 0) { skip--; return; }
      buf.push(ms);
      if (buf.length < 60) return;
      const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
      buf = [];
      bad = mean > 36 ? bad + 1 : 0;
      if (bad >= 2 && i < STEPS.length - 1) { bad = 0; i++; lowered = true; skip = 20; apply(STEPS[i]); }
      else if (mean < 13 && !lowered && !raised && i > 0) { i--; raised = true; skip = 20; apply(STEPS[i]); }
    },
    get dpr() { return STEPS[i]; },
  };
}

/** Contador de cuadros por segundo y llamadas de dibujo, en una esquina del escenario. */
export function createDebug(box, renderer) {
  const el = document.createElement("div");
  el.className = "lab-debug";
  box.appendChild(el);
  renderer.info.autoReset = false;
  let frames = 0;
  let t0 = performance.now();
  let worst = 0;
  let prev = t0;
  return {
    begin() { renderer.info.reset(); },
    end(extra = "") {
      const now = performance.now();
      worst = Math.max(worst, now - prev);
      prev = now;
      frames++;
      if (now - t0 < 500) return;
      const fps = (frames * 1000) / (now - t0);
      const { render, memory } = renderer.info;
      el.textContent = `${fps.toFixed(0)} fps · peor ${worst.toFixed(0)} ms · ${render.calls} calls · ${(render.triangles / 1000).toFixed(0)}k tri · ${memory.geometries} geo · ${memory.textures} tex${extra ? ` · ${extra}` : ""}`;
      window.__lab3d = { fps, worst, calls: render.calls, triangles: render.triangles };
      frames = 0;
      worst = 0;
      t0 = now;
    },
    dispose() { el.remove(); },
  };
}
