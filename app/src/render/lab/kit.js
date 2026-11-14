import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* Piezas básicas compartidas por la cámara y los entornos. Unidades: milímetros. */

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

export const std = (color, metalness = 0, roughness = 0.7, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });

export function mesh(geo, mat, parent, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent?.add(m);
  return m;
}

export const box = (w, h, d, mat, parent, pos, rot) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, pos, rot);

/** Caja con aristas redondeadas (r en mm): las aristas vivas son lo que más delata a una caja de CG. */
export const rbox = (w, h, d, mat, parent, pos, rot, r = Math.min(w, h, d) * 0.08) =>
  mesh(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.2, Math.min(r, w / 2, h / 2, d / 2) - 0.01)), mat, parent, pos, rot);

/** Escala las UV a `tile` mm por repetición para que el detalle de las texturas tenga tamaño real. */
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}
const TILE = 100;

/** Cilindro entre dos puntos; r2 permite conicidad hacia `b`. */
export function rod(a, b, r, mat, parent, r2 = r, seg = 14) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  // U a lo largo de la varilla (como en TubeGeometry): el cepillado corre a lo largo del eje
  const geo = new THREE.CylinderGeometry(r2, r, len, seg);
  const uv = geo.attributes.uv;
  const su = Math.max(1, Math.round((2 * Math.PI * r) / TILE));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getY(i) * len) / TILE, uv.getX(i) * su);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  parent?.add(m);
  return m;
}

/** Tubería por tramos rectos con codos esféricos. */
export function pipe(points, r, mat, parent) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    rod(points[i], points[i + 1], r, mat, g);
    if (i > 0) mesh(new THREE.SphereGeometry(r, 10, 8), mat, g, points[i].toArray());
  }
  parent?.add(g);
  return g;
}

/** Manguera o cable curvo que pasa por los puntos dados. */
export function hose(points, r, mat, parent, seg = 40, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = scaleUV(new THREE.TubeGeometry(curve, seg, r, radial, false), curve.getLength() / TILE, 1);
  const m = new THREE.Mesh(geo, mat);
  parent?.add(m);
  return m;
}

/**
 * Mazo de cables: varios hilos trenzados alrededor del recorrido, con bridas cada `tie` mm.
 * Todo en una geometría con colores por vértice (un solo dibujo); `mat` debe tener vertexColors.
 */
export function harness(points, { n = 4, r = 1.4, colors = [0xe8e6df], tie = 70, tieColor = 0x1c1d20, twist = 0.6, seed = 1 } = {}, mat, parent) {
  const curve = new THREE.CatmullRomCurve3(points);
  const len = curve.getLength();
  const steps = Math.max(8, Math.round(len / 12));
  const frames = curve.computeFrenetFrames(steps, false);
  const bundle = n === 1 ? 0 : r * (n <= 3 ? 1.2 : 1.9);
  const parts = [];
  const col = new THREE.Color();
  const paint = (geo, hex) => {
    col.setHex(hex);
    const c = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return geo;
  };
  const P = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = (k / n) * Math.PI * 2 + t * len * 0.01 * twist + seed;
      curve.getPointAt(t, P);
      pts.push(P.clone().addScaledVector(frames.normals[i], Math.cos(a) * bundle).addScaledVector(frames.binormals[i], Math.sin(a) * bundle));
    }
    const c = new THREE.CatmullRomCurve3(pts);
    const geo = scaleUV(new THREE.TubeGeometry(c, steps * 2, r * (0.8 + 0.4 * ((k * 0.37 + seed) % 1)), 6, false), len / TILE, 1);
    parts.push(paint(geo, colors[k % colors.length]));
  }
  if (tie > 0 && n > 1) {
    const ring = bundle + r + 0.4;
    for (let d = tie * 0.5; d < len - tie * 0.3; d += tie) {
      const t = d / len;
      const geo = new THREE.TorusGeometry(ring, Math.max(0.35, r * 0.32), 4, 12);
      const tan = curve.getTangentAt(t);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tan));
      curve.getPointAt(t, P);
      geo.translate(P.x, P.y, P.z);
      parts.push(paint(geo, tieColor));
    }
  }
  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  const m = new THREE.Mesh(geo, mat);
  parent?.add(m);
  return m;
}

/** Plano con textura, visible por una sola cara (las paredes se cortan solas al orbitar por fuera). */
export function panel(w, h, mat, parent, pos, rot) {
  return mesh(new THREE.PlaneGeometry(w, h), mat, parent, pos, rot);
}

/** Libera geometrías, materiales y texturas de un subárbol. */
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      for (const k of ["map", "alphaMap", "emissiveMap", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "clearcoatMap"]) m[k]?.dispose();
      m.dispose();
    });
  });
}

/**
 * Color de un cuerpo negro a temperatura T (kelvin), normalizado a su canal más brillante.
 * Aproximación de Tanner Helland, válida entre 1000 y 40000 K; la intensidad va aparte.
 */
export function blackbody(T, out = new THREE.Color()) {
  const t = Math.max(1000, T) / 100;
  const c = (v) => Math.max(0, Math.min(255, v)) / 255;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return out.setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
