import * as THREE from "three";
import { blackbody } from "./lab/kit.js";

/*
 * Llama volumétrica de la gota.
 *
 * Una llama de gota en microgravedad es (casi) esférica: su emisión solo depende del radio.
 * Para un campo radial, lo que se ve en cada píxel es la integral a lo largo del rayo, y esa
 * integral solo depende del parámetro de impacto b (la distancia mínima del rayo al centro).
 * Se precalcula en una LUT 1D, así que la llama no se integra por pasos: es exacta, sin bandas
 * y cuesta unas pocas lecturas de textura por píxel.
 *
 * Capas (radios en unidades de rF, el radio de la llama del modelo):
 *   - zona de reacción CH* (azul), con pico en r = 1: el anillo coincide con flame = 2·rF del HUD;
 *   - cascarón de hollín en 0.75-0.86·rF: absorbe (Beer-Lambert) y emite como cuerpo negro;
 *   - halo exterior tenue;
 *   - llama fría, difusa, alrededor de la gota (en unidades de 3.2·rD).
 * Con gravedad el dominio es un elipsoide estirado hacia arriba: azul en la base y hollín arriba.
 * Cada rayo cruza cada cascarón dos veces (cerca y lejos): lo de detrás se atenúa por el hollín
 * de delante y por la gota, que se trata como una esfera analítica transparente.
 * El ruido 3D se lee en los puntos de cruce (parpadeo y textura) y en el punto más cercano (forma).
 *
 * Mezcla con alfa premultiplicado: la emisión suma y el hollín oscurece lo que hay detrás
 * (a contraluz, en HiBMS, solo queda la sombra del hollín).
 */

// perfiles gaussianos: centro c y anchura w, en unidades del cascarón
const PROFILES = [
  { c: 1.0, w: 0.04 }, // R: CH* (zona de reacción delgada)
  { c: 0.805, w: 0.032 }, // G: hollín (fino: así se lee como cascarón y no como disco)
  { c: 1.12, w: 0.13 }, // B: halo (fuera de la zona de reacción: no tiñe el interior; acaba en ~1.65)
  { c: 0.7, w: 0.28 }, // A: llama fría
];
const BMAX = 2; // la LUT cubre b ∈ [0, 2]
const LUT_N = 512;

/** Media integral (un solo lado del rayo) de cada perfil, en función de b. */
function buildLut() {
  const data = new Uint16Array(LUT_N * 4);
  const ds = 0.0015;
  for (let i = 0; i < LUT_N; i++) {
    const b = (i / (LUT_N - 1)) * BMAX;
    PROFILES.forEach(({ c, w }, k) => {
      const rmax = c + 4.5 * w;
      let sum = 0;
      if (b < rmax) {
        const smax = Math.sqrt(rmax * rmax - b * b);
        for (let s = ds / 2; s < smax; s += ds) {
          const x = (Math.hypot(b, s) - c) / w;
          sum += Math.exp(-x * x);
        }
      }
      data[i * 4 + k] = THREE.DataUtils.toHalfFloat(sum * ds);
    });
  }
  const t = new THREE.DataTexture(data, LUT_N, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/** Ruido de valor periódico (fbm de 3 octavas) en un Data3DTexture R8 de n³. */
function buildNoise(n) {
  let seed = 0x2f6b1d;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Float32Array(n * n * n);
  const fade = (t) => t * t * (3 - 2 * t);
  for (const [P, amp] of [[4, 0.55], [8, 0.3], [16, 0.15]]) {
    const lat = new Float32Array(P * P * P).map(rnd);
    const L = (x, y, z) => lat[((z % P) * P + (y % P)) * P + (x % P)];
    for (let z = 0; z < n; z++) {
      const fz = (z / n) * P, z0 = Math.floor(fz), tz = fade(fz - z0);
      for (let y = 0; y < n; y++) {
        const fy = (y / n) * P, y0 = Math.floor(fy), ty = fade(fy - y0);
        for (let x = 0; x < n; x++) {
          const fx = (x / n) * P, x0 = Math.floor(fx), tx = fade(fx - x0);
          const a = L(x0, y0, z0) + (L(x0 + 1, y0, z0) - L(x0, y0, z0)) * tx;
          const b = L(x0, y0 + 1, z0) + (L(x0 + 1, y0 + 1, z0) - L(x0, y0 + 1, z0)) * tx;
          const c = L(x0, y0, z0 + 1) + (L(x0 + 1, y0, z0 + 1) - L(x0, y0, z0 + 1)) * tx;
          const d = L(x0, y0 + 1, z0 + 1) + (L(x0 + 1, y0 + 1, z0 + 1) - L(x0, y0 + 1, z0 + 1)) * tx;
          const ab = a + (b - a) * ty;
          const cd = c + (d - c) * ty;
          out[(z * n + y) * n + x] += (ab + (cd - ab) * tz) * amp;
        }
      }
    }
  }
  const data = new Uint8Array(n * n * n);
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, Math.round(out[i] * 255)));
  const t = new THREE.Data3DTexture(data, n, n, n);
  t.format = THREE.RedFormat;
  t.type = THREE.UnsignedByteType;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

const VERT = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uLut;
uniform sampler3D uNoise;
uniform vec3 uCenter;   // centro del elipsoide (mm)
uniform vec3 uAxes;     // semiejes (mm)
uniform float uRF;      // radio de la llama (mm)
uniform float uRD;      // radio de la gota (mm)
uniform float uRC;      // radio de la llama fría (mm)
uniform float uG;
uniform vec3 uFlow;     // desplazamiento del ruido (advección)
uniform float uWob;     // deformación de la forma
uniform float uFlick;   // modulación de brillo
uniform vec3 uChCol;    // CH*, ya con su intensidad
uniform vec3 uHaloCol;
uniform vec3 uSootCol;  // cuerpo negro del hollín, ya con su intensidad
uniform float uTau;     // espesor óptico del hollín (por unidad de la LUT)
uniform vec3 uCoolCol;
uniform float uDropT;   // transmitancia de la gota (1 si no se dibuja)
uniform int uMode;      // 0 color, 1 HiBMS (sombra del hollín), 2 LLUV (solo quimioluminiscencia)
uniform float uGain;
varying vec3 vWorld;

vec4 lut(float b){ return texture2D(uLut, vec2(clamp(b / 2.0, 0.0, 1.0) * (511.0 / 512.0) + 0.5 / 512.0, 0.5)); }
float nz(vec3 p){ return texture(uNoise, p / uRF * 0.9 + uFlow).r; }
// el cruce cuenta solo si queda delante de la cámara
float ahead(float t, float w){ return smoothstep(-w, w, t); }

void main(){
  vec3 rd = normalize(vWorld - cameraPosition);
  // espacio del elipsoide: ahí la llama es una esfera de radio 1
  vec3 o = (cameraPosition - uCenter) / uAxes;
  vec3 d = rd / uAxes;
  float js = length(d);
  d /= js;
  float tc = -dot(o, d);
  vec3 pc = o + d * tc;
  // la gota y la llama fría están centradas en el origen
  float tw = -dot(cameraPosition, rd);
  float bw = length(cameraPosition + rd * tw);
  // salida temprana: el rayo no pasa cerca de nada que emita (más allá de b ≈ 1.65 la LUT es 0)
  float b0 = length(pc);
  if (b0 > 1.68 && (uRC <= 0.0 || bw > 1.98 * uRC)) discard;
  // fuera del núcleo (b > 1.2) solo queda el halo, suave: ahí no se lee el ruido (es lo que más cuesta)
  bool core = b0 < 1.2;
  // la forma ondula un poco: se deforma b con el ruido en el punto más cercano (se apaga hacia el halo)
  float b = core ? b0 * (1.0 + uWob * (1.0 - smoothstep(1.05, 1.2, b0)) * (nz(uCenter + pc * uAxes) - 0.5)) : b0;
  vec4 L = lut(b);
  float k = 1.0 / (js * uRF); // de longitud de la LUT a unidades de rF
  float eps = 0.02;

  // cruces con la zona de reacción (r = 1) y con el hollín (r = 0.805)
  float hc = sqrt(max(1.0 - b * b, 0.0));
  float hs = sqrt(max(0.648 - b * b, 0.0));
  vec3 pcN = uCenter + (pc - d * hc) * uAxes, pcF = uCenter + (pc + d * hc) * uAxes;
  vec3 psN = uCenter + (pc - d * hs) * uAxes, psF = uCenter + (pc + d * hs) * uAxes;
  // con gravedad: azul en la base y hollín arriba (alturas en unidades de rF)
  float yN = pcN.y / uRF, yF = pcF.y / uRF;
  float blN = mix(1.0, 1.0 - 0.75 * smoothstep(0.1, 1.7, yN), uG);
  float blF = mix(1.0, 1.0 - 0.75 * smoothstep(0.1, 1.7, yF), uG);
  float bsN = mix(1.0, 0.25 + 1.1 * smoothstep(-0.4, 0.9, psN.y / uRF), uG);
  float bsF = mix(1.0, 0.25 + 1.1 * smoothstep(-0.4, 0.9, psF.y / uRF), uG);

  // el hollín toma el ruido de los cruces con la zona de reacción (dos lecturas en lugar de cuatro)
  float nN = core ? nz(pcN) : 0.5;
  float nF = core ? nz(pcF) : 0.5;
  float chN = L.r * k * ahead(tc - hc, eps) * blN * (1.0 + uFlick * (nN - 0.5));
  float chF = L.r * k * ahead(tc + hc, eps) * blF * (1.0 + uFlick * (nF - 0.5));
  float haN = L.b * k * ahead(tc - hc, eps) * blN;
  float haF = L.b * k * ahead(tc + hc, eps) * blF;
  float tauN = uTau * L.g * k * ahead(tc - hs, eps) * bsN * (0.6 + 0.8 * nN);
  float tauF = uTau * L.g * k * ahead(tc + hs, eps) * bsF * (0.6 + 0.8 * nF);
  float eN = exp(-tauN), eF = exp(-tauF);

  // la gota: lo que queda detrás llega atenuado; en el borde refleja más (Fresnel)
  float Td = 1.0;
  if (uDropT < 0.999 && tw > 0.0 && bw < uRD) Td = uDropT * (1.0 - 0.85 * pow(bw / uRD, 6.0));

  // llama fría: esférica alrededor de la gota
  float cN = 0.0, cF = 0.0;
  if (uRC > 0.0) {
    float lc = lut(bw / uRC).a;
    cN = lc * ahead(tw, eps * uRC);
    cF = lc;
  }

  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (uMode == 0) {
    vec3 far = uSootCol * (1.0 - eF) + eF * (chF * uChCol + haF * uHaloCol);
    col = chN * uChCol + haN * uHaloCol + uSootCol * (1.0 - eN) + eN * Td * far + (cN + cF * Td) * uCoolCol;
    alpha = 1.0 - eN * eF;
  } else if (uMode == 1) {
    alpha = 1.0 - eN * eF;
  } else {
    float uv = dot((chN + Td * chF) * uChCol + 0.5 * (haN + Td * haF) * uHaloCol, vec3(0.3333));
    col = vec3(uv);
  }
  gl_FragColor = vec4(col * uGain, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// colores en lineal: CH* (431 nm, con algo de C2 a 516 nm) y halo algo más violeta
const CH = new THREE.Color().setRGB(0.09, 0.2, 1.0);
const HALO = new THREE.Color().setRGB(0.16, 0.16, 1.0);
const COOL = new THREE.Color().setRGB(0.32, 0.55, 1.0);
const UV = new THREE.Color().setRGB(0.45, 0.45, 0.45); // OH* (310 nm) visto en gris

// calibración (contra fotos de FLEX y con AgX); en ?debug se ajusta en vivo con __lab.vol.tune
const TUNE = {
  ch: 2.4, chFlash: 5, halo: 0.25, chSoot: 0.6,
  sootT: 2000, sootTa: 220, sootTflash: 400, sootK: 1.8, tau: 3, tauHibms: 7.5,
  cool: 2.2,
};

/**
 * Crea la llama. `update(F, time)` la ajusta a lo que dio el modelo en este cuadro;
 * `present(kind, { gain, inside })` la prepara para dibujar como "free" o una cámara.
 */
export function createFlameVolume({ noiseSize = 64 } = {}) {
  const K = { ...TUNE };
  const lut = buildLut();
  const noise = buildNoise(noiseSize);
  const uniforms = {
    uLut: { value: lut },
    uNoise: { value: noise },
    uCenter: { value: new THREE.Vector3() },
    uAxes: { value: new THREE.Vector3(1, 1, 1) },
    uRF: { value: 1 },
    uRD: { value: 0.1 },
    uRC: { value: 0 },
    uG: { value: 0 },
    uFlow: { value: new THREE.Vector3() },
    uWob: { value: 0.03 },
    uFlick: { value: 0.15 },
    uChCol: { value: new THREE.Color() },
    uHaloCol: { value: new THREE.Color() },
    uSootCol: { value: new THREE.Color() },
    uTau: { value: 0 },
    uCoolCol: { value: new THREE.Color() },
    uDropT: { value: 0.85 },
    uMode: { value: 0 },
    uGain: { value: 1 },
  };
  const mat = (side, depthTest) => new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest,
    side,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  // proxy: un elipsoide de baja resolución que envuelve la llama (cubre menos píxeles que una caja).
  // Desde fuera: caras delanteras con prueba de profundidad (lo que está delante la tapa);
  // con la cámara dentro: caras traseras sin prueba de profundidad
  const proxy = new THREE.SphereGeometry(1, 32, 16);
  const outer = new THREE.Mesh(proxy, mat(THREE.FrontSide, true));
  const inner = new THREE.Mesh(proxy, mat(THREE.BackSide, false));
  for (const m of [outer, inner]) { m.frustumCulled = false; m.renderOrder = 2; }
  const group = new THREE.Group();
  group.add(outer, inner);

  const tmp = new THREE.Vector3();
  const sootRGB = new THREE.Color();
  const st = { on: false, hot: false, cool: false, coolA: 0, soot: 0, sootT: 1800, ch: 0, uv: 0 };

  return {
    group,
    /** Mallas que hay que dejar visibles al precompilar. */
    parts: [outer, inner],
    /** Color (normalizado) del hollín, para la luz cálida. */
    sootColor: sootRGB,
    uniforms,
    tune: K,
    update(F, time) {
      const g = F.g ? 1 : 0;
      const rF = Math.max(F.rF, 1e-3);
      const u = uniforms;
      // elipsoide: en 1g se estira hacia arriba y su centro sube (punta a ~2.1·rF, base a ~-1.4·rF)
      const ax = rF * (g ? 0.95 : 1);
      const ay = rF * (g ? 1.75 : 1);
      u.uCenter.value.set(0, g ? rF * 0.35 : 0, 0);
      u.uAxes.value.set(ax, ay, ax);
      u.uRF.value = rF;
      u.uRD.value = F.dropOn ? F.rD : 0;
      u.uRC.value = F.coolA > 0 ? F.rD * 3.2 : 0;
      u.uG.value = g;
      u.uWob.value = g ? 0.07 : 0.025;
      u.uFlick.value = g ? 0.5 : 0.16;
      // el ruido sube con la flotación (parpadeo de ~10 Hz en 1g); en µg casi quieto
      // el ruido es periódico (período 1): se envuelve para no perder precisión en sesiones largas
      const fr = (v) => v - Math.floor(v);
      u.uFlow.value.set(fr(time * 0.013), fr(-time * (g ? 1.7 : 0.06)), fr(time * 0.021));

      st.hot = F.hot;
      st.cool = F.coolA > 0;
      st.coolA = F.coolA;
      st.soot = F.hot ? F.soot * F.kindle : 0;
      // CH*: más intenso con más oxígeno, y un destello al encender. Su emisión es mucho más débil que
      // la incandescencia del hollín: con hollín, el azul solo se ve en el borde exterior
      const sooty = Math.min(1, F.soot / 0.4);
      st.ch = F.hot ? K.ch * F.a * (1 - K.chSoot * sooty * sooty * (3 - 2 * sooty)) + K.chFlash * F.flash : 0;
      // OH* en el ultravioleta: el filtro de LLUV no ve el hollín, así que no se atenúa con él
      st.uv = F.hot ? K.ch * F.a + K.chFlash * F.flash : 0;
      // hollín: más caliente al encender; su brillo sigue a T⁴
      st.sootT = K.sootT + K.sootTa * Math.min(1, F.a) + K.sootTflash * F.flash;
      blackbody(st.sootT, sootRGB);
      st.on = F.hot || st.cool;

      // proxy: cubre el elipsoide hasta 1.7 radios (donde acaba el halo) y la llama fría (2·rC desde el origen).
      // 1.03 compensa que las caras de la esfera poligonal quedan por dentro de la esfera ideal.
      // Cada píxel del proxy cuesta: no se hace más grande de lo necesario
      const cy = u.uCenter.value.y;
      const rc2 = 2 * u.uRC.value;
      group.position.set(0, cy, 0);
      group.scale.set(Math.max(1.7 * ax, rc2), Math.max(1.7 * ay, rc2 + Math.abs(cy)), Math.max(1.7 * ax, rc2)).multiplyScalar(1.03);
    },
    /** `gain`: escala de la emisión; `camera`: la de la vista libre, para saber si está dentro del volumen. */
    present(kind, { gain = 1, camera = null } = {}) {
      const hibms = kind === "hibms";
      const uv = kind === "lluv";
      const u = uniforms;
      const on = hibms ? st.hot && st.soot > 0.02 : uv ? st.hot : st.on;
      // la cámara dentro del proxy (o casi: el margen cubre el plano cercano) pasa a las caras traseras
      let inside = false;
      if (camera && on) {
        const m = camera.near * 2;
        const sc = group.scale;
        tmp.copy(camera.position).sub(group.position);
        inside = (tmp.x / (sc.x + m)) ** 2 + (tmp.y / (sc.y + m)) ** 2 + (tmp.z / (sc.z + m)) ** 2 < 1;
      }
      outer.visible = on && !inside;
      inner.visible = on && inside;
      if (!on) return;
      u.uMode.value = hibms ? 1 : uv ? 2 : 0;
      u.uGain.value = gain;
      u.uDropT.value = uv ? 1 : 0.85;
      const ch = uv ? st.uv : st.ch;
      u.uChCol.value.copy(uv ? UV : CH).multiplyScalar(ch);
      u.uHaloCol.value.copy(uv ? UV : HALO).multiplyScalar(ch * K.halo);
      // radiancia del cuerpo negro relativa a 1800 K
      u.uSootCol.value.copy(sootRGB).multiplyScalar(K.sootK * (st.sootT / 1800) ** 4 * Math.min(1, st.soot * 4));
      // a contraluz el hollín se ve más denso que su emisión (extinción en el visible)
      u.uTau.value = (hibms ? K.tauHibms : K.tau) * st.soot;
      u.uCoolCol.value.copy(COOL).multiplyScalar(st.coolA * K.cool);
    },
    dispose() {
      lut.dispose();
      noise.dispose();
      proxy.dispose();
      outer.material.dispose();
      inner.material.dispose();
    },
  };
}
