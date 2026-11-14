import * as THREE from "three";
import { rng } from "./textures.js";

/*
 * Superficies PBR procedurales: albedo, rugosidad y relieve dibujados en canvas.
 * El relieve va directo como bumpMap (el gradiente lo calcula la GPU) y la rugosidad en el canal G.
 * Solo el albedo es sRGB; los mapas de datos van en NoColorSpace.
 * Cada creador de materiales (createSurfaces) memoriza por clave: las piezas iguales comparten
 * material y texturas, y todo se libera con disposeTree.
 */

const Q = { res: 1, aniso: 8 };
/** Resolución de las texturas según el nivel de calidad (0.5 en bajo) y anisotropía máxima del equipo. */
export function setTier(level, maxAniso = 8) {
  Q.res = level === "low" ? 0.5 : level === "high" ? 1.5 : 1;
  Q.aniso = Math.max(1, Math.min(maxAniso, level === "low" ? 4 : 8));
}
export const tier = () => Q;
/** El relieve (bumpMap) cuesta ~3 ms a pantalla completa en una gráfica integrada: en el nivel bajo no se usa. */
export const relief = () => Q.res >= 1;

const tiles = new Map();
/**
 * Ruido fbm periódico (se repite sin costura) en escala de grises, size × size.
 * base = celdas de la primera octava; cada octava duplica la frecuencia. Se calcula una vez y se guarda.
 */
export function noise(seed = 1, size = 256, base = 4, oct = 5) {
  const k = `${seed}/${size}/${base}/${oct}`;
  if (tiles.has(k)) return tiles.get(k);
  const R = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1;
  for (let o = 0; o < oct; o++) {
    const p = base << o;
    if (p > size) break;
    const lat = new Float32Array(p * p).map(() => R());
    const cell = size / p;
    for (let y = 0; y < size; y++) {
      const fy = y / cell, iy = Math.floor(fy), t = fy - iy, sy = t * t * (3 - 2 * t);
      const y0 = (iy % p) * p, y1 = ((iy + 1) % p) * p;
      for (let x = 0; x < size; x++) {
        const fx = x / cell, ix = Math.floor(fx), u = fx - ix, sx = u * u * (3 - 2 * u);
        const x0 = ix % p, x1 = (ix + 1) % p;
        const a = lat[y0 + x0] + (lat[y0 + x1] - lat[y0 + x0]) * sx;
        const b = lat[y1 + x0] + (lat[y1 + x1] - lat[y1 + x0]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    amp *= 0.5;
  }
  let mn = Infinity, mx = -Infinity;
  for (const v of out) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  for (let i = 0; i < out.length; i++) {
    const v = Math.round((255 * (out[i] - mn)) / (mx - mn || 1));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  tiles.set(k, c);
  return c;
}

/** Pinta un mosaico de ruido sobre todo el canvas con un modo de mezcla. */
export function layer(g, w, h, tile, { scale = 1, alpha = 0.2, op = "overlay", dx = 0, dy = 0, sx = 1, sy = 1 } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = op;
  const pat = g.createPattern(tile, "repeat");
  pat.setTransform(new DOMMatrix().translate(dx, dy).scale(scale * sx, scale * sy));
  g.fillStyle = pat;
  g.fillRect(0, 0, w, h);
  g.restore();
}

export function canvas(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = Math.max(4, Math.round(w));
  c.height = Math.max(4, Math.round(h));
  draw(c.getContext("2d"), c.width, c.height);
  return c;
}

export function tex(c, { srgb = false, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = Q.aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const grey = (v) => `rgb(${v},${v},${v})`;

/** Rayas finas a lo largo de X (metal cepillado, fundas de cable). */
function streaks(g, w, h, R, n, alpha, light = 0.5) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${R() < light ? "255,255,255" : "0,0,0"},${R() * alpha})`;
    const y = R() * h;
    const x = R() * w * 0.5;
    g.fillRect(x - w * 0.5, y, w * (0.6 + R()), 1 + (R() < 0.1 ? 1 : 0));
    g.fillRect(x + w * 0.5, y, w * (0.6 + R()), 1);
  }
}

/**
 * Fábrica de materiales con textura procedural. Todos los mapas usan las UV de la geometría;
 * kit.js escala las UV de varillas y mangueras a 100 mm por repetición.
 */
export function createSurfaces() {
  const memo = new Map();
  const once = (key, build) => {
    if (!memo.has(key)) memo.set(key, build());
    return memo.get(key);
  };
  const S = () => Math.round(512 * Q.res);

  // ---- juegos de mapas compartidos (uno por tipo de superficie) ----
  const brushedMaps = () => once("maps:brushed", () => {
    const R = rng(31);
    const n = S();
    const nz = noise(31, 256, 2, 4);
    const albedo = canvas(n, n, (g, w, h) => {
      g.fillStyle = grey(232); g.fillRect(0, 0, w, h);
      streaks(g, w, h, R, 2400 * Q.res, 0.035);
      layer(g, w, h, nz, { scale: w / 256, alpha: 0.18, op: "multiply", sx: 4, sy: 0.5 });
    });
    const rough = canvas(n / 2, n / 2, (g, w, h) => {
      g.fillStyle = grey(200); g.fillRect(0, 0, w, h);
      streaks(g, w, h, R, 900 * Q.res, 0.12);
      layer(g, w, h, nz, { scale: w / 256, alpha: 0.35, op: "overlay", sx: 3 });
    });
    const bump = canvas(n, n, (g, w, h) => {
      g.fillStyle = grey(128); g.fillRect(0, 0, w, h);
      streaks(g, w, h, R, 3000 * Q.res, 0.14);
    });
    return { map: tex(albedo, { srgb: true }), roughnessMap: tex(rough), bumpMap: tex(bump) };
  });

  // pintura y anodizado: grano fino (piel de naranja), manchas suaves y desgaste
  const paintMaps = (seed, grain) => once(`maps:paint${seed}:${grain}`, () => {
    const n = S();
    const big = noise(seed, 256, 2, 5);
    const fine = noise(seed + 7, 128, 16, 3);
    const albedo = canvas(n, n, (g, w, h) => {
      g.fillStyle = grey(236); g.fillRect(0, 0, w, h);
      layer(g, w, h, big, { scale: w / 256, alpha: 0.16, op: "multiply" });
      layer(g, w, h, fine, { scale: (w / 128) * 0.5, alpha: 0.08, op: "multiply" });
      // marcas de uso: algún roce más claro y alguna huella más oscura
      const R = rng(seed * 3);
      for (let i = 0; i < 18; i++) {
        g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},${0.025 + R() * 0.04})`;
        g.beginPath();
        g.ellipse(R() * w, R() * h, 4 + R() * w * 0.06, 2 + R() * w * 0.02, R() * 3, 0, 7);
        g.fill();
      }
    });
    const rough = canvas(n / 2, n / 2, (g, w, h) => {
      g.fillStyle = grey(205); g.fillRect(0, 0, w, h);
      layer(g, w, h, big, { scale: w / 256, alpha: 0.45, op: "overlay", dx: 37 });
    });
    const bump = canvas(n, n, (g, w, h) => {
      g.fillStyle = grey(128); g.fillRect(0, 0, w, h);
      layer(g, w, h, fine, { scale: (w / 128) * grain, alpha: 0.9, op: "source-over" });
    });
    return { map: tex(albedo, { srgb: true }), roughnessMap: tex(rough), bumpMap: tex(bump) };
  });

  // funda de cable o manguera lisa: vetas a lo largo (U de TubeGeometry) y poco más
  const sheathMaps = () => once("maps:sheath", () => {
    const R = rng(55);
    const n = Math.round(256 * Q.res);
    const albedo = canvas(n, n, (g, w, h) => {
      g.fillStyle = grey(236); g.fillRect(0, 0, w, h);
      streaks(g, w, h, R, 260, 0.05, 0.3);
      layer(g, w, h, noise(55, 128, 2, 4), { scale: w / 128, alpha: 0.12, op: "multiply", sx: 3, sy: 0.6 });
    });
    const bump = canvas(n, n, (g, w, h) => {
      g.fillStyle = grey(128); g.fillRect(0, 0, w, h);
      streaks(g, w, h, R, 500, 0.25);
    });
    return { map: tex(albedo, { srgb: true }), bumpMap: tex(bump) };
  });

  // manguera corrugada: costillas cada pocos mm a lo largo de U
  const corrugatedMaps = () => once("maps:corr", () => {
    const n = Math.round(256 * Q.res);
    const ribs = 16;
    const bump = canvas(n, n / 4, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w / ribs, 0);
      gr.addColorStop(0, grey(40)); gr.addColorStop(0.5, grey(230)); gr.addColorStop(1, grey(40));
      g.fillStyle = gr;
      for (let i = 0; i < ribs; i++) { g.save(); g.translate((i * w) / ribs, 0); g.fillRect(0, 0, w / ribs, h); g.restore(); }
    });
    const albedo = canvas(n, n / 4, (g, w, h) => {
      g.drawImage(bump, 0, 0);
      g.globalCompositeOperation = "screen";
      g.fillStyle = grey(150); g.fillRect(0, 0, w, h);
    });
    return { map: tex(albedo, { srgb: true }), bumpMap: tex(bump) };
  });

  // tejido Nomex de las bolsas: trama fina
  const fabricMaps = () => once("maps:fabric", () => {
    const n = Math.round(256 * Q.res);
    const weave = canvas(n, n, (g, w, h) => {
      g.fillStyle = grey(128); g.fillRect(0, 0, w, h);
      const s = 4;
      for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
        const on = ((x + y) / s) % 2 === 0;
        g.fillStyle = on ? grey(190) : grey(70);
        g.fillRect(x, y, s, s / 2);
        g.fillStyle = on ? grey(70) : grey(190);
        g.fillRect(x, y + s / 2, s, s / 2);
      }
      layer(g, w, h, noise(77, 128, 4, 3), { scale: w / 128, alpha: 0.35, op: "overlay" });
    });
    const albedo = canvas(n, n, (g, w, h) => {
      g.fillStyle = grey(236); g.fillRect(0, 0, w, h);
      layer(g, w, h, weave, { alpha: 0.12, op: "multiply" });
      layer(g, w, h, noise(78, 256, 2, 5), { scale: w / 256, alpha: 0.18, op: "multiply" });
    });
    return { map: tex(albedo, { srgb: true }), bumpMap: tex(weave) };
  });

  const std = (key, color, metalness, roughness, maps, extra = {}) =>
    once(key, () => {
      const { bumpMap, ...rest } = maps;
      return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...rest, ...(relief() ? { bumpMap } : {}), ...extra });
    });

  return {
    /** Acero o aluminio cepillado. La rugosidad del mapa ronda 0.8: la del material se escala. */
    brushed: (color, rough = 0.3, metal = 1, bump = 0.25) =>
      std(`brushed:${color}:${rough}:${metal}`, color, metal, rough / 0.8, brushedMaps(), { bumpScale: bump }),
    /** Pintura mate o satinada (paneles, cajas de instrumentos). */
    paint: (color, rough = 0.55, metal = 0, bump = 0.5) =>
      std(`paint:${color}:${rough}:${metal}`, color, metal, rough / 0.8, paintMaps(11, 1), { bumpScale: bump }),
    /** Aluminio anodizado: grano más fino y algo metálico. */
    anodized: (color, rough = 0.42, metal = 0.55) =>
      std(`anod:${color}:${rough}:${metal}`, color, metal, rough / 0.8, paintMaps(23, 2), { bumpScale: 0.35 }),
    /** Funda de cable (PTFE, silicona): mate y con vetas. */
    sheath: (color, rough = 0.62, vertexColors = false) =>
      std(`sheath:${color}:${rough}:${vertexColors}`, color, 0, rough, sheathMaps(), { bumpScale: 0.4, vertexColors }),
    /** Manguera corrugada o funda trenzada. */
    corrugated: (color, rough = 0.55, metal = 0) =>
      std(`corr:${color}:${rough}:${metal}`, color, metal, rough, corrugatedMaps(), { bumpScale: 1.6 }),
    /** Tejido de las bolsas de carga. */
    fabric: (color, rough = 0.92) => std(`fabric:${color}:${rough}`, color, 0, rough, fabricMaps(), { bumpScale: 0.7 }),
    /** Vidrio de las ventanas: casi negro, con capa transparente y un leve tornasol del antirreflejo. */
    glass: (color = 0x0b1320) => once(`glass:${color}`, () => new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03,
      iridescence: 0.25, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 420], envMapIntensity: 1.4,
    })),
  };
}
