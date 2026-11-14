import * as THREE from "three";
import { tier, noise, layer, relief } from "./surface.js";

/*
 * Texturas procedurales del laboratorio: todo se dibuja en canvas al vuelo,
 * así la app no carga imágenes ni modelos externos.
 */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(w, h, draw, { wrap = false, data = false } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = tier().aniso;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function speckle(g, w, h, n, R, alpha = 0.06) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},${R() * alpha})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}

export const THEMES = {
  iss: { base: "#c4c9c8", panel: "#e2e5e1", line: "#868d95", dark: "#262b34", accent: "#2f6fd0", accent2: "#dcb53c", bag: "#efede4", ink: "#3a4048" },
  hab: { base: "#b3ac9d", panel: "#d3ccbd", line: "#7a7366", dark: "#272522", accent: "#d9722b", accent2: "#3e8f8a", bag: "#e6dfcf", ink: "#3d3830" },
};

/** Extremo del módulo con escotilla hacia el siguiente. */
export function hatchWall(theme, sign) {
  const T = THEMES[theme] || THEMES.iss;
  const R = rng(sign.length * 77 + 5);
  return make(1024, 1024, (g, w, h) => {
    g.fillStyle = T.base;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, R);
    g.strokeStyle = T.line; g.lineWidth = 3;
    for (let i = 1; i < 4; i++) { g.strokeRect((i * w) / 4 - 1, 0, 2, h); }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = T.bag;
      rr(g, 40 + R() * 120 + (i % 2) * 760, 60 + i * 100, 130, 80, 16); g.fill();
      g.fillStyle = T.accent;
      g.fillRect(90 + (i % 2) * 790, 60 + i * 100, 9, 80);
    }
    // marco de la escotilla y pasillo en fuga
    const cx = w / 2, cy = h / 2 + 20;
    g.fillStyle = T.line;
    rr(g, cx - 300, cy - 300, 600, 600, 110); g.fill();
    g.fillStyle = "#30353e";
    rr(g, cx - 270, cy - 270, 540, 540, 92); g.fill();
    for (let i = 0; i < 7; i++) {
      const s = 250 - i * 32;
      g.fillStyle = `rgb(${18 + i * 8},${24 + i * 11},${36 + i * 17})`;
      rr(g, cx - s, cy - s, s * 2, s * 2, 80 - i * 8); g.fill();
    }
    g.fillStyle = "rgba(160,205,255,0.9)";
    g.fillRect(cx - 22, cy - 34, 44, 6);
    g.fillRect(cx - 22, cy + 28, 44, 6);
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      g.fillStyle = "#1a1d23";
      g.beginPath(); g.arc(cx + Math.cos(ang) * 318, cy + Math.sin(ang) * 318, 7, 0, 7); g.fill();
    }
    g.fillStyle = T.dark;
    rr(g, cx - 170, 40, 340, 56, 8); g.fill();
    g.fillStyle = "#e9eef8";
    g.font = "600 30px 'IBM Plex Mono', monospace";
    g.textAlign = "center";
    g.fillText(sign, cx, 78);
  });
}

/** Superficie terrestre vista hacia abajo; se desplaza para simular la órbita. */
export function earth() {
  const R = rng(4242);
  return make(1024, 512, (g, w, h) => {
    const sea = g.createLinearGradient(0, 0, w, h);
    sea.addColorStop(0, "#0b2a5e"); sea.addColorStop(0.5, "#11468f"); sea.addColorStop(1, "#0a2f6b");
    g.fillStyle = sea;
    g.fillRect(0, 0, w, h);
    const blob = (x, y, r, col, n = 9) => {
      g.fillStyle = col;
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rad = r * (0.55 + R() * 0.7);
        g.lineTo(x + Math.cos(a) * rad * 1.5, y + Math.sin(a) * rad);
      }
      g.fill();
    };
    for (let i = 0; i < 9; i++) {
      const x = R() * w, y = R() * h, r = 40 + R() * 90;
      for (const dx of [-w, 0, w]) {
        blob(x + dx, y, r, "#3f6b3a");
        blob(x + dx + 12, y + 6, r * 0.6, "#8a7a4c");
      }
    }
    g.filter = "blur(5px)";
    for (let i = 0; i < 150; i++) {
      const x = R() * w, y = R() * h, r = 8 + R() * 46;
      g.fillStyle = `rgba(255,255,255,${0.12 + R() * 0.4})`;
      for (const dx of [-w, 0, w]) { g.beginPath(); g.ellipse(x + dx, y, r * 2.2, r * 0.7, R() * 3, 0, 7); g.fill(); }
    }
    g.filter = "none";
  }, { wrap: true });
}

/** La Luna desde órbita baja, con la Tierra al fondo. */
export function moonOrbit() {
  const R = rng(1969);
  return make(1024, 768, (g, w, h) => {
    g.fillStyle = "#010103";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.8})`; g.fillRect(R() * w, R() * h * 0.6, 1.2, 1.2); }
    // Tierra creciente
    g.save();
    g.beginPath(); g.arc(770, 170, 62, 0, 7); g.clip();
    g.fillStyle = "#2a68c9"; g.fillRect(700, 100, 140, 140);
    g.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(710 + R() * 120, 110 + R() * 120, 22, 6, R() * 3, 0, 7); g.fill(); }
    g.fillStyle = "rgba(0,0,5,0.86)";
    g.beginPath(); g.arc(810, 190, 70, 0, 7); g.fill();
    g.restore();
    // limbo lunar curvo
    g.save();
    g.beginPath(); g.arc(w / 2 - 60, h + 1250, 1650, 0, 7); g.clip();
    const lg = g.createLinearGradient(0, h * 0.42, 0, h);
    lg.addColorStop(0, "#c9c6bf"); lg.addColorStop(0.35, "#9a968e"); lg.addColorStop(1, "#57544f");
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) {
      const y = h * 0.4 + R() * h * 0.6;
      const k = (y - h * 0.38) / (h * 0.62);
      const r = (4 + R() * 46) * (0.25 + k);
      const x = R() * w;
      g.fillStyle = `rgba(30,28,26,${0.25 + R() * 0.35})`;
      g.beginPath(); g.ellipse(x, y, r, r * (0.25 + k * 0.5), 0, 0, 7); g.fill();
      g.strokeStyle = "rgba(240,236,226,0.5)"; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(x, y, r, r * (0.25 + k * 0.5), 0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
    }
    speckle(g, w, h, 9000, R, 0.12);
    g.restore();
  });
}

/**
 * Metal oscuro cepillado con costuras y tornillos (interior de la cámara, bancada).
 * Devuelve { map, bumpMap, roughnessMap } dibujados con la misma disposición.
 */
export function darkMetal(seed = 3) {
  const res = tier().res;
  const n = Math.round(512 * Math.min(1, res));
  const R = rng(seed);
  const lines = Array.from({ length: 900 }, () => [R() < 0.5, R(), R()]);
  const screws = [];
  for (let x = 32; x < 512; x += 64) for (const y of [20, 236, 278, 492]) screws.push([x, y]);
  const albedo = make(n, n, (g, w) => {
    g.scale(w / 512, w / 512);
    g.fillStyle = "#2a2d34";
    g.fillRect(0, 0, 512, 512);
    layer(g, 512, 512, noise(seed, 256, 2, 5), { scale: 2, alpha: 0.35, op: "multiply" });
    for (const [l, y, a] of lines) { g.fillStyle = `rgba(${l ? "255,255,255" : "0,0,0"},${a * 0.05})`; g.fillRect(0, y * 512, 512, 1); }
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(0, 255, 512, 3);
    g.fillRect(255, 0, 3, 512);
    g.fillStyle = "rgba(255,255,255,0.07)";
    g.fillRect(0, 258, 512, 1);
    for (const [x, y] of screws) {
      g.fillStyle = "#0e1014"; g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.arc(x - 1, y - 1, 1.6, 0, 7); g.fill();
    }
    g.fillStyle = "rgba(230,190,60,0.75)";
    g.font = "600 13px 'IBM Plex Mono', monospace";
    g.fillText("FCF-CIR", 300, 190);
    g.fillText("▲ FWD", 60, 420);
  }, { wrap: true });
  const bump = make(n, n, (g, w) => {
    g.scale(w / 512, w / 512);
    g.fillStyle = "rgb(128,128,128)";
    g.fillRect(0, 0, 512, 512);
    for (const [l, y, a] of lines) { g.fillStyle = `rgba(${l ? "255,255,255" : "0,0,0"},${a * 0.1})`; g.fillRect(0, y * 512, 512, 1); }
    g.fillStyle = "rgb(30,30,30)";
    g.fillRect(0, 254, 512, 5);
    g.fillRect(254, 0, 5, 512);
    for (const [x, y] of screws) {
      const gr = g.createRadialGradient(x, y, 0, x, y, 5);
      gr.addColorStop(0, "rgb(220,220,220)"); gr.addColorStop(0.8, "rgb(170,170,170)"); gr.addColorStop(1, "rgb(128,128,128)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
      g.fillStyle = "rgb(60,60,60)"; g.fillRect(x - 3, y - 0.6, 6, 1.2);
    }
  }, { wrap: true, data: true });
  const rough = make(n / 2, n / 2, (g, w) => {
    g.fillStyle = "rgb(190,190,190)";
    g.fillRect(0, 0, w, w);
    layer(g, w, w, noise(seed + 1, 256, 2, 4), { scale: w / 256, alpha: 0.5, op: "overlay" });
  }, { wrap: true, data: true });
  if (!relief()) { bump.dispose(); return { map: albedo, roughnessMap: rough }; }
  return { map: albedo, bumpMap: bump, roughnessMap: rough };
}

/**
 * Cilindro perforado del inserto MDCA; los ocho huecos grandes se alinean con las ventanas.
 * Los huecos se recortan en el alfa; el bisel de cada uno va en el relieve, no pintado.
 * Devuelve { map, bumpMap, roughnessMap }.
 */
export function perforated() {
  const n = Math.round(2048 * Math.min(1, tier().res));
  const R = rng(88);
  const holes = [];
  for (let j = 0; j < 8; j++) holes.push([j * 128, 123, 44]);
  for (let j = 0; j < 16; j++) {
    holes.push([j * 64 + 32, 232, 15], [j * 64, 300, 21], [j * 64 + 32, 368, 15], [j * 64, 436, 21]);
    if (j % 2) holes.push([j * 64, 40, 14]);
  }
  const each = (f) => { for (const [x, y, r] of holes) for (const dx of [0, 1024]) f(x + dx, y, r); };
  const k = n / 1024;
  const albedo = make(n, n / 2, (g, w, h) => {
    g.scale(k, k);
    g.fillStyle = "#3c3f46";
    g.fillRect(0, 0, 1024, 512);
    layer(g, 1024, 512, noise(88, 256, 2, 5), { scale: 2, alpha: 0.4, op: "multiply" });
    // pátina de calor: tono pajizo y azulado alrededor de la zona de la llama (fila de huecos grandes)
    const heat = g.createLinearGradient(0, 40, 0, 300);
    heat.addColorStop(0, "rgba(120,90,50,0)"); heat.addColorStop(0.4, "rgba(120,90,50,0.10)"); heat.addColorStop(0.7, "rgba(60,70,120,0.08)"); heat.addColorStop(1, "rgba(60,70,120,0)");
    g.fillStyle = heat; g.fillRect(0, 0, 1024, 512);
    speckle(g, 1024, 512, 3000, R, 0.06);
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "#000"; // opaco: recorta el hueco entero
    each((x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    g.globalCompositeOperation = "source-over";
  }, { wrap: true });
  const bump = make(n / 2, n / 4, (g) => {
    g.scale(k / 2, k / 2);
    g.fillStyle = "rgb(128,128,128)";
    g.fillRect(0, 0, 1024, 512);
    layer(g, 1024, 512, noise(89, 128, 16, 3), { scale: 1, alpha: 0.2, op: "source-over" });
    each((x, y, r) => {
      const gr = g.createRadialGradient(x, y, r, x, y, r + 5);
      gr.addColorStop(0, "rgb(30,30,30)"); gr.addColorStop(1, "rgba(128,128,128,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r + 5, 0, 7); g.fill();
    });
  }, { wrap: true, data: true });
  const rough = make(256, 128, (g, w, h) => {
    g.fillStyle = "rgb(170,170,170)";
    g.fillRect(0, 0, w, h);
    layer(g, w, h, noise(90, 128, 2, 4), { scale: 1, alpha: 0.5, op: "overlay" });
  }, { wrap: true, data: true });
  if (!relief()) { bump.dispose(); return { map: albedo, roughnessMap: rough }; }
  return { map: albedo, bumpMap: bump, roughnessMap: rough };
}

/** Tramo del pozo de la torre de caída: placas de acero, bridas y un anillo de luces. */
export function shaft() {
  const R = rng(132);
  return make(512, 1024, (g, w, h) => {
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "#1a1f27"); base.addColorStop(0.5, "#252b35"); base.addColorStop(1, "#171b22");
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, R, 0.07);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,70,40,${R() * 0.12})`; g.fillRect(R() * w, R() * h, 2 + R() * 5, 30 + R() * 160); }
    g.fillStyle = "rgba(0,0,0,0.55)";
    for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h);
    // bridas
    for (const y of [0, 512]) {
      g.fillStyle = "#3a424f"; g.fillRect(0, y, w, 26);
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(0, y, w, 3);
      g.fillStyle = "#0d0f13";
      for (let x = 16; x < w; x += 32) { g.beginPath(); g.arc(x, y + 13, 4, 0, 7); g.fill(); }
    }
    // anillo de luces
    const gl = g.createLinearGradient(0, 230, 0, 310);
    gl.addColorStop(0, "rgba(255,236,190,0)"); gl.addColorStop(0.5, "rgba(255,236,190,0.55)"); gl.addColorStop(1, "rgba(255,236,190,0)");
    g.fillStyle = gl; g.fillRect(0, 230, w, 80);
    for (let x = 32; x < w; x += 64) { g.fillStyle = "#fff6dc"; rr(g, x - 16, 264, 32, 10, 4); g.fill(); }
    // conducto y marcas de profundidad
    g.fillStyle = "#454d5a"; g.fillRect(200, 0, 12, h); g.fillRect(222, 0, 6, h);
    g.fillStyle = "#e3b62c";
    g.font = "600 22px 'IBM Plex Mono', monospace";
    g.fillText("ZGF", 262, 580);
    for (let y = 560; y < h; y += 40) g.fillRect(250, y, y % 80 ? 8 : 18, 3);
  }, { wrap: true });
}

/** Resplandor radial para halos y destellos. */
export function glow() {
  return make(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,0.45)"); r.addColorStop(0.6, "rgba(255,255,255,0.1)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
}

/** Bocanada suave para la niebla de CO₂. */
export function puff() {
  const R = rng(7);
  return make(128, 128, (g, w) => {
    for (let i = 0; i < 14; i++) {
      const x = w / 2 + (R() - 0.5) * 50, y = w / 2 + (R() - 0.5) * 50, rad = 18 + R() * 26;
      const r = g.createRadialGradient(x, y, 0, x, y, rad);
      r.addColorStop(0, "rgba(255,255,255,0.22)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, w, w);
    }
  });
}

/** Placa rotulada (etiquetas de equipos, letreros). */
export function plate(text, { w = 512, h = 128, bg = "#14171d", fg = "#e8edf7", accent = null, size = 44 } = {}) {
  return make(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (accent) { g.fillStyle = accent; g.fillRect(0, 0, 18, h); g.fillRect(0, h - 10, w, 10); }
    g.fillStyle = fg;
    g.font = `600 ${size}px 'IBM Plex Mono', monospace`;
    g.textBaseline = "middle";
    const lines = text.split("\n");
    lines.forEach((ln, i) => g.fillText(ln, accent ? 36 : 22, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  });
}

/** Puerta de la cámara: disco negro con la etiqueta amarilla del CIR. */
export function doorFace() {
  return make(512, 512, (g, w) => {
    g.fillStyle = "#0f1013";
    g.fillRect(0, 0, w, w);
    g.strokeStyle = "rgba(255,255,255,0.07)"; g.lineWidth = 2;
    for (let r = 60; r < 250; r += 46) { g.beginPath(); g.arc(w / 2, w / 2, r, 0, 7); g.stroke(); }
    g.fillStyle = "#e7c21f";
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { rr(g, 196 + i * 32, 228 + j * 30, 26, 22, 4); g.fill(); }
    g.fillStyle = "#b9c0cc";
    g.font = "600 20px 'IBM Plex Mono', monospace";
    g.textAlign = "center";
    g.fillText("COMBUSTION CHAMBER", w / 2, 330);
  });
}

/** Pantalla de la laptop de operaciones. */
export function screen() {
  const R = rng(21);
  return make(512, 320, (g, w, h) => {
    g.fillStyle = "#071018";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#8fa9ff";
    g.font = "600 20px 'IBM Plex Mono', monospace";
    g.fillText("FLEX · MDCA  OPS", 18, 30);
    g.strokeStyle = "rgba(143,169,255,0.25)";
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(18, 60 + i * 44); g.lineTo(w - 18, 60 + i * 44); g.stroke(); }
    g.strokeStyle = "#ffb35a"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(18, 70); g.lineTo(w * 0.62, 250); g.stroke();
    g.strokeStyle = "#7fd1ff"; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i <= 40; i++) g.lineTo(18 + (i / 40) * (w - 36), 200 - 90 * Math.sin(i / 9) * (1 - i / 60) + R() * 6);
    g.stroke();
    g.fillStyle = "#58e07a";
    g.fillText("NOMINAL", w - 130, 30);
  });
}
