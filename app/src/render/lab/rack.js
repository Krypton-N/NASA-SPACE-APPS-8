import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng, THEMES } from "./textures.js";
import { canvas, tex, layer, noise, tier, relief } from "./surface.js";

/*
 * Frente de rack "semi-3D" (1050 × 2100 mm): casilleros, cajones de aviónica, estaciones y bolsas
 * de carga salen del plano con su volumen real (20-230 mm), en una sola geometría por diseño.
 * Todas las caras usan proyección plana sobre el frente: la tapa de cada pieza muestra su dibujo
 * y los costados toman el color de su borde. El plano de fondo lleva horneada la sombra de contacto
 * de cada pieza (oclusión ambiental falsa), y los LED y pantallas van en un mapa de emisión.
 * Coordenadas del dibujo en "unidades" de un lienzo de 512 × 1024; 1 unidad = 1050/512 mm.
 */

const UW = 512;
const UH = 1024;
const MM = 1050 / UW;
const RW = 1050;
const RH = 2100;

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Disposición del rack: lista de piezas con su rectángulo (unidades), fondo (mm) y tipo. */
function layout(seed) {
  const R = rng(seed);
  const items = [];
  const add = (o) => { items.push(o); return o; };
  add({ kind: "rail", x: 0, y: 0, w: 16, h: UH, d: 26, r: 3 });
  add({ kind: "rail", x: UW - 16, y: 0, w: 16, h: UH, d: 26, r: 3 });
  add({ kind: "plate", x: 28, y: 14, w: UW - 56, h: 36, d: 8, r: 3 });
  let y = 62;
  while (y < UH - 70) {
    const k = R();
    const hh = Math.min(UH - 20 - y, 96 + Math.floor(R() * 4) * 34);
    const row = { y, hh, tape: false, type: "", parts: [] };
    if (k < 0.34) {
      row.type = "lockers";
      for (let i = 0; i < 2; i++) {
        const x = 26 + i * ((UW - 52) / 2 + 2);
        const ww = (UW - 60) / 2;
        const lk = add({ kind: "locker", x, y, w: ww, h: hh, d: 42 + R() * 10, r: 7, id: Math.floor(R() * 90 + 10), tag: R() < 0.5 });
        add({ kind: "handle", x: x + ww / 2 - 34, y: y + hh - 26, w: 68, h: 10, d: lk.d + 16, r: 3 });
        row.parts.push(lk);
      }
    } else if (k < 0.56) {
      row.type = "avionics";
      const dr = add({ kind: "drawer", x: 26, y, w: UW - 52, h: hh, d: 64 + R() * 20, r: 5, leds: Array.from({ length: 7 }, () => (R() < 0.75 ? 0 : 1)), name: ["RPC MODULE", "FLUID CTRL", "AVIONICS AIR", "PWR DIST"][Math.floor(R() * 4)] });
      for (const hx of [30, UW - 40]) add({ kind: "handle", x: hx, y: y + 12, w: 10, h: hh - 24, d: dr.d + 20, r: 3 });
      row.parts.push(dr);
    } else if (k < 0.8) {
      row.type = "bags";
      let x = 28;
      while (x < UW - 60) {
        const ww = Math.min(UW - 28 - x, 110 + R() * 90);
        const d = 140 + R() * 90;
        row.parts.push(add({ kind: "bag", x, y: y + 4, w: ww - 6, h: hh - 8, d, r: Math.min(30, d / 2 - 1, (ww - 6) * MM * 0.25), bulge: 18 + R() * 22, id: Math.floor(R() * 900 + 100) }));
        x += ww;
      }
    } else {
      row.type = "station";
      row.parts.push(add({ kind: "station", x: 26, y, w: UW - 52, h: hh, d: 28, r: 5, keys: Array.from({ length: 12 }, () => R()), wave: Array.from({ length: 21 }, () => R()) }));
    }
    row.tape = R() < 0.22;
    items.push({ kind: "row", ...row });
    y += hh + 12;
  }
  return items.filter((it) => it.kind !== "row").concat(items.filter((it) => it.kind === "row"));
}

/** Albedo: fondo con sombras de contacto y el dibujo de cada pieza. */
function drawAlbedo(g, T, items, k) {
  g.scale(k, k);
  g.fillStyle = T.base;
  g.fillRect(0, 0, UW, UH);
  layer(g, UW, UH, noise(5, 256, 2, 5), { scale: 2, alpha: 0.12, op: "multiply" });
  // asientos de los rieles
  g.fillStyle = "rgba(0,0,0,0.45)";
  for (let y = 10; y < UH; y += 18) { g.fillRect(5, y, 6, 6); g.fillRect(UW - 11, y, 6, 6); }

  const solids = items.filter((it) => it.kind !== "row");
  // sombras de contacto: cuanto más sale la pieza, más ancha y suave
  for (const it of solids) {
    if (it.kind === "handle") continue;
    g.save();
    g.shadowColor = `rgba(0,0,0,${it.kind === "bag" ? 0.55 : 0.45})`;
    g.shadowBlur = Math.min(60, (it.d / MM) * 0.35) * k;
    g.shadowOffsetY = (it.d / MM) * 0.12 * k;
    g.fillStyle = "#000";
    rr(g, it.x + 2, it.y + 2, it.w - 4, it.h - 4, it.r / MM);
    g.fill();
    g.restore();
  }
  for (const it of solids) {
    const { x, y, w, h } = it;
    if (it.kind === "rail") {
      g.fillStyle = T.line; g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(0,0,0,0.5)";
      for (let yy = 10; yy < UH; yy += 18) g.fillRect(x + 5, yy, 6, 6);
    } else if (it.kind === "plate") {
      g.fillStyle = T.dark; rr(g, x, y, w, h, 5); g.fill();
      g.fillStyle = "#dfe6f2";
      g.font = "600 17px 'IBM Plex Mono', monospace";
      g.fillText(it.title, x + 12, y + 24);
      g.fillStyle = T.accent2; g.fillRect(x + w - 46, y + 8, 34, 20);
    } else if (it.kind === "locker") {
      g.fillStyle = T.panel; rr(g, x, y, w, h, 8); g.fill();
      g.strokeStyle = T.line; g.lineWidth = 2; g.stroke();
      // borde biselado: luz arriba, sombra abajo
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "rgba(255,255,255,0.18)"); gr.addColorStop(0.08, "rgba(255,255,255,0)"); gr.addColorStop(0.92, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.16)");
      g.fillStyle = gr; rr(g, x, y, w, h, 8); g.fill();
      g.fillStyle = "#f4f4ee"; g.fillRect(x + 12, y + 12, 74, 22);
      g.fillStyle = T.ink;
      g.font = "500 11px 'IBM Plex Mono', monospace";
      g.fillText(`LKR-${it.id}`, x + 17, y + 27);
      if (it.tag) { g.fillStyle = T.accent; g.fillRect(x + w - 40, y + 12, 24, 24); }
      // parche de velcro
      g.fillStyle = "rgba(40,40,40,0.25)"; g.fillRect(x + w * 0.45, y + 14, 34, 16);
      for (const [bx, by] of [[10, h - 12], [w - 10, h - 12], [w - 10, 44], [10, 44]]) {
        g.fillStyle = "#6c727b"; g.beginPath(); g.arc(x + bx, y + by, 3.2, 0, 7); g.fill();
        g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(x + bx - 0.8, y + by - 0.8, 1.1, 0, 7); g.fill();
      }
    } else if (it.kind === "handle") {
      g.fillStyle = T.dark; rr(g, x, y, w, h, 4); g.fill();
    } else if (it.kind === "drawer") {
      g.fillStyle = "#3b414b"; rr(g, x, y, w, h, 6); g.fill();
      g.fillStyle = "#2a2f38";
      for (let vy = y + 12; vy < y + h - 40; vy += 7) g.fillRect(x + 22, vy, w * 0.42, 3);
      it.leds.forEach((c, i) => {
        const lx = UW * 0.56 + (i % 4) * 34;
        const ly = y + 22 + Math.floor(i / 4) * 34;
        g.fillStyle = "#15181d"; g.fillRect(lx, ly, 22, 22);
        g.fillStyle = c ? "#7a5d1d" : "#2c6b3b";
        g.beginPath(); g.arc(lx + 11, ly + 11, 4.5, 0, 7); g.fill();
      });
      g.fillStyle = "#c7ccd4";
      g.font = "500 11px 'IBM Plex Mono', monospace";
      g.fillText(it.name, x + 18, y + h - 14);
      for (const [bx, by] of [[22, 8], [w - 22, 8], [22, h - 8], [w - 22, h - 8]]) {
        g.fillStyle = "#1a1d22"; g.beginPath(); g.arc(x + bx, y + by, 3, 0, 7); g.fill();
      }
    } else if (it.kind === "bag") {
      g.fillStyle = T.bag; rr(g, x, y, w, h, 16); g.fill();
      // pliegues suaves de la tela
      const gr = g.createRadialGradient(x + w * 0.45, y + h * 0.4, 4, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, "rgba(255,255,255,0.10)"); gr.addColorStop(1, "rgba(0,0,0,0.20)");
      g.fillStyle = gr; rr(g, x, y, w, h, 16); g.fill();
      g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 2; g.setLineDash([3, 3]);
      rr(g, x + 14, y + 14, w - 28, h - 28, 10); g.stroke(); g.setLineDash([]);
      g.fillStyle = T.accent; g.fillRect(x + w * 0.3, y, 10, h);
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + w * 0.3 + 8, y, 2, h);
      g.fillStyle = "#fbfbf7"; g.fillRect(x + 14, y + h / 2 - 12, 54, 24);
      g.fillStyle = T.ink;
      g.font = "500 10px 'IBM Plex Mono', monospace";
      g.fillText(`CTB ${it.id}`, x + 18, y + h / 2 + 4);
    } else if (it.kind === "station") {
      g.fillStyle = T.panel; rr(g, x, y, w, h, 6); g.fill();
      g.strokeStyle = T.line; g.lineWidth = 2; g.stroke();
      const sw = Math.min(210, UW * 0.42);
      const sh = Math.min(h - 26, 130);
      g.fillStyle = "#1a1e24"; rr(g, x + 14, y + 9, sw + 8, sh + 8, 6); g.fill();
      g.fillStyle = "#05080d"; rr(g, x + 18, y + 13, sw, sh, 5); g.fill();
      it.keys.forEach((v, i) => {
        g.fillStyle = i % 5 === 0 ? T.accent2 : "#566070";
        rr(g, UW * 0.56 + (i % 4) * 36, y + 18 + Math.floor(i / 4) * 30, 26, 20, 3); g.fill();
      });
    }
  }
  // cinta de precaución
  for (const row of items.filter((it) => it.kind === "row" && it.tape)) {
    for (let x = 30; x < UW - 40; x += 20) {
      g.fillStyle = (x / 20) % 2 < 1 ? "#d9ab2a" : "#1b1b1b";
      g.fillRect(x, row.y + row.hh + 2, 20, 6);
    }
  }
  layer(g, UW, UH, noise(9, 128, 8, 3), { scale: 1, alpha: 0.06, op: "multiply" });
}

/** Relieve (gris 128 = plano): costuras, tornillos, rejillas, tela y etiquetas. */
function drawBump(g, items, k) {
  g.scale(k, k);
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, UW, UH);
  layer(g, UW, UH, noise(13, 128, 16, 3), { scale: 1, alpha: 0.25, op: "source-over" });
  const fab = noise(17, 128, 32, 2);
  for (const it of items) {
    const { x, y, w, h } = it;
    if (it.kind === "locker" || it.kind === "station") {
      g.strokeStyle = "rgb(70,70,70)"; g.lineWidth = 2;
      rr(g, x + 4, y + 4, w - 8, h - 8, 6); g.stroke();
      g.fillStyle = "rgb(160,160,160)"; g.fillRect(x + 12, y + 12, 74, 22);
      for (const [bx, by] of [[10, h - 12], [w - 10, h - 12], [w - 10, 44], [10, 44]]) {
        g.fillStyle = "rgb(200,200,200)"; g.beginPath(); g.arc(x + bx, y + by, 3.2, 0, 7); g.fill();
        g.fillStyle = "rgb(60,60,60)"; g.fillRect(x + bx - 2.5, y + by - 0.5, 5, 1);
      }
    } else if (it.kind === "drawer") {
      g.fillStyle = "rgb(40,40,40)";
      for (let vy = y + 12; vy < y + h - 40; vy += 7) g.fillRect(x + 22, vy, w * 0.42, 3);
      g.fillStyle = "rgb(100,100,100)";
      it.leds.forEach((_, i) => g.fillRect(UW * 0.56 + (i % 4) * 34, y + 22 + Math.floor(i / 4) * 34, 22, 22));
    } else if (it.kind === "bag") {
      g.save();
      rr(g, x, y, w, h, 16); g.clip();
      layer(g, UW, UH, fab, { scale: 0.5, alpha: 0.7, op: "source-over" });
      g.strokeStyle = "rgb(60,60,60)"; g.lineWidth = 2; g.setLineDash([3, 3]);
      rr(g, x + 14, y + 14, w - 28, h - 28, 10); g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgb(175,175,175)"; g.fillRect(x + w * 0.3, y, 10, h);
      g.restore();
    }
  }
}

/** Rugosidad (canal G): pantallas brillantes, tela muy mate. */
function drawRough(g, items, k) {
  g.scale(k, k);
  g.fillStyle = "rgb(150,150,150)";
  g.fillRect(0, 0, UW, UH);
  layer(g, UW, UH, noise(21, 256, 2, 4), { scale: 2, alpha: 0.3, op: "overlay" });
  for (const it of items) {
    const { x, y, w, h } = it;
    const v = { rail: 110, plate: 120, handle: 140, locker: 150, drawer: 165, bag: 240, station: 150 }[it.kind];
    if (v == null) continue;
    g.fillStyle = `rgb(${v},${v},${v})`;
    rr(g, x, y, w, h, 6); g.fill();
    if (it.kind === "station") {
      g.fillStyle = "rgb(25,25,25)";
      g.fillRect(x + 18, y + 13, Math.min(210, UW * 0.42), Math.min(h - 26, 130));
    }
  }
}

/** Emisión: LED y contenido de las pantallas (el resto en negro). */
function drawEmissive(g, items, k) {
  g.scale(k, k);
  g.fillStyle = "#000";
  g.fillRect(0, 0, UW, UH);
  for (const it of items) {
    const { x, y, h } = it;
    if (it.kind === "drawer") {
      it.leds.forEach((c, i) => {
        const lx = UW * 0.56 + (i % 4) * 34;
        const ly = y + 22 + Math.floor(i / 4) * 34;
        g.fillStyle = c ? "#ffb52e" : "#3dff6e";
        g.beginPath(); g.arc(lx + 11, ly + 11, 4, 0, 7); g.fill();
      });
    } else if (it.kind === "station") {
      const sw = Math.min(210, UW * 0.42);
      const sh = Math.min(h - 26, 130);
      const bg = g.createLinearGradient(0, y + 13, 0, y + 13 + sh);
      bg.addColorStop(0, "#0c1a33"); bg.addColorStop(1, "#06101f");
      g.fillStyle = bg; g.fillRect(x + 18, y + 13, sw, sh);
      g.strokeStyle = "rgba(90,140,220,0.25)"; g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + 18, y + 13 + (i * sh) / 4); g.lineTo(x + 18 + sw, y + 13 + (i * sh) / 4); g.stroke(); }
      g.strokeStyle = "#4fa3ff"; g.lineWidth = 1.5;
      g.beginPath();
      it.wave.forEach((r, i) => g.lineTo(x + 26 + (i / 20) * (sw - 16), y + 13 + sh * (0.75 - 0.5 * r * (i / 20))));
      g.stroke();
      g.fillStyle = "#8fe3a2"; g.fillRect(x + 26, y + 22, sw * 0.4, 4);
      g.fillStyle = "#c8d6f0";
      g.font = "500 9px 'IBM Plex Mono', monospace";
      g.fillText("STATUS  NOMINAL", x + 26, y + 13 + sh - 8);
    }
  }
}

/** Quita los triángulos que miran hacia la pared (nunca se ven). La geometría no lleva índice. */
function dropBack(geo) {
  const keep = [];
  const n = geo.attributes.normal;
  for (let t = 0; t < n.count; t += 3) if (n.getZ(t) + n.getZ(t + 1) + n.getZ(t + 2) > -2.4) keep.push(t);
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const src = geo.attributes[name];
    const arr = new Float32Array(keep.length * 3 * src.itemSize);
    keep.forEach((t, k) => arr.set(src.array.subarray(t * src.itemSize, (t + 3) * src.itemSize), k * 3 * src.itemSize));
    out.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
  }
  geo.dispose();
  return out;
}

const SEG = { bag: 3, locker: 2, drawer: 2, station: 2 }; // segmentos del redondeo (1 = chaflán)

/**
 * Geometría: cada pieza como caja redondeada y el plano de fondo al final (así la prueba de
 * profundidad descarta el fondo tapado por las piezas). UV proyectadas sobre el frente.
 */
function buildGeometry(items) {
  const parts = [];
  for (const it of items) {
    if (it.kind === "row") continue;
    const W = it.w * MM;
    const H = it.h * MM;
    const cx = (it.x + it.w / 2) * MM - RW / 2;
    const cy = RH / 2 - (it.y + it.h / 2) * MM;
    const r = Math.max(0.5, Math.min(it.r, W / 2 - 0.5, H / 2 - 0.5, it.d / 2 - 0.5));
    const seg = SEG[it.kind] || 1;
    const geo = new RoundedBoxGeometry(W, H, it.d, seg, r);
    geo.translate(cx, cy, it.d / 2);
    const p = geo.attributes.position;
    if (it.bulge) {
      // la tela se abomba: más en el centro y nada en los bordes
      for (let i = 0; i < p.count; i++) {
        if (p.getZ(i) < it.d - r * 1.01) continue;
        const nx = (2 * (p.getX(i) - cx)) / W;
        const ny = (2 * (p.getY(i) - cy)) / H;
        p.setZ(i, p.getZ(i) + it.bulge * Math.max(0, 1 - nx * nx) * Math.max(0, 1 - ny * ny));
      }
      geo.computeVertexNormals();
    }
    parts.push(dropBack(geo));
  }
  parts.push(new THREE.PlaneGeometry(RW, RH).toNonIndexed()); // RoundedBoxGeometry no lleva índice
  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + RW / 2) / RW, (p.getY(i) + RH / 2) / RH);
  return geo;
}

/**
 * Crea el material y la geometría de un frente de rack. Devuelve { geometry, material }:
 * se pueden usar en varias mallas (paredes, techo y suelo comparten diseños).
 */
export function rackFront(theme, seed, title, { emissive = 2.2, dim = 1 } = {}) {
  const T = THEMES[theme] || THEMES.iss;
  const items = layout(seed);
  items.find((it) => it.kind === "plate").title = title;
  const k = Math.min(2, Math.max(1, tier().res * 1.5)); // 1, 1.5 o 2 píxeles por unidad (512 a 1024 de ancho)
  const half = Math.max(0.5, k / 2);
  const albedo = canvas(UW * k, UH * k, (g) => drawAlbedo(g, T, items, k));
  const bump = relief() ? tex(canvas(UW * half, UH * half, (g) => drawBump(g, items, half)), { repeat: false }) : null;
  const rough = canvas(UW * 0.5, UH * 0.5, (g) => drawRough(g, items, 0.5));
  const emis = canvas(UW * half, UH * half, (g) => drawEmissive(g, items, half));
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(dim, dim, dim),
    map: tex(albedo, { srgb: true, repeat: false }),
    bumpMap: bump,
    bumpScale: 1.2,
    roughness: 1,
    roughnessMap: tex(rough, { repeat: false }),
    metalness: 0,
    emissive: 0xffffff,
    emissiveMap: tex(emis, { srgb: true, repeat: false }),
    emissiveIntensity: emissive,
  });
  return { geometry: buildGeometry(items), material };
}
