import * as THREE from "three";

/*
 * Emulación ilustrativa de los sensores de FLEX (NASA/TP-2015-216046, Dietrich et al., sec. 2.2):
 *   - color (MDCA): video de 0.3 MP; el hollín satura hacia amarillo-blanco y la óptica tiene algo de aberración cromática;
 *   - HiBMS: 1024×1024, 12 bits, monocromo a contraluz (láser de 650-660 nm por debajo del umbral);
 *     el fondo no es uniforme (lo dice el informe) y la óptica tiene polvo y moteado fijo;
 *   - LLUV: CCD de 1024×1024 con binning 2×2 (512×512) tras un intensificador de microcanales:
 *     monocromo, con el tinte del fósforo, ruido que crece con la ganancia y destellos de un solo píxel.
 * Las tres cámaras graban a 30 cuadros por segundo: el ruido cambia a ese ritmo.
 *
 * El mismo código GLSL se usa en la vista principal (un efecto del post-procesado, sobre la imagen ya
 * comprimida con AgX) y en los monitores (un quad que comprime con AgX cada lectura de su render target).
 * Orden: SENSOR_PARS, luego `vec3 sensorFetch(vec2 uv)` (lee el color ya comprimido, con la aberración
 * cromática si uCA > 0) y por último SENSOR_GLSL, que define `vec3 sensorImage(vec2 uv)`.
 */

export const SENSORS = {
  color: { mode: 0, native: [640, 480], gain: 1, ca: 0.006 },
  hibms: { mode: 1, native: [1024, 1024], gain: 1, ca: 0 },
  lluv: { mode: 2, native: [512, 512], gain: 1, ca: 0 },
};
export const SENSOR_FPS = 30;

export const SENSOR_UNIFORMS = () => ({
  uMode: 0,
  uRect: new THREE.Vector4(0, 0, 1, 1), // rectángulo del sensor en coordenadas de la salida (0-1)
  uNative: new THREE.Vector2(640, 480), // píxeles nativos visibles (con zoom digital, menos)
  uRes: new THREE.Vector2(1, 1), // píxeles de la salida
  uGain: 1,
  uSeed: 0,
  uCA: 0, // aberración cromática lateral: desplazamiento del rojo y el azul, proporcional a la distancia al centro
  uZoom: 1, // zoom digital: recorta el centro del sensor (la viñeta, el polvo y el círculo del intensificador crecen con él)
});

export const SENSOR_PARS = /* glsl */ `
uniform int uMode;
uniform vec4 uRect;
uniform vec2 uNative;
uniform vec2 uRes;
uniform float uGain;
uniform float uSeed;
uniform float uCA;
uniform float uZoom;
// desplazamiento del rojo (+) y del azul (−) en coordenadas de la salida
vec2 sensorCA(vec2 uv) { return (uv - 0.5 * (uRect.xy + uRect.zw)) * uCA; }
`;

export const SENSOR_GLSL = /* glsl */ `
float sHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float sValue(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// hombro por canal: el canal que se llena primero (el rojo del hollín) se recorta antes, y el color va a amarillo-blanco
vec3 sShoulder(vec3 x) {
  const float k = 0.72;
  return mix(x, k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k))), step(k, x));
}
// ruido gaussiano aproximado (suma de dos uniformes), de media cero
float sGrain(vec2 p, float s) { return sHash(p + s) + sHash(p.yx * 1.37 + s * 1.91) - 1.0; }

vec3 sensorImage(vec2 uv) {
  vec2 size = uRect.zw - uRect.xy;
  vec2 q = (uv - uRect.xy) / size;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec3(0.0);
  // rejilla de píxeles nativos centrada (el zoom digital la agranda desde el centro)
  vec2 px = (q - 0.5) * uNative;
  vec2 ip = floor(px);
  vec2 cell = size * uRes / uNative; // píxeles de pantalla por píxel nativo
  vec3 c;
  if (max(cell.x, cell.y) > 1.3) {
    // el píxel nativo se ve: se promedia su área con cuatro lecturas
    vec2 base = uRect.xy + ((ip + 0.5) / uNative + 0.5) * size;
    vec2 o = 0.25 * size / uNative;
    c = 0.25 * (sensorFetch(base + vec2(-o.x, -o.y)) + sensorFetch(base + vec2(o.x, -o.y))
              + sensorFetch(base + vec2(-o.x, o.y)) + sensorFetch(base + vec2(o.x, o.y)));
  } else {
    c = sensorFetch(uv);
  }
  // coordenadas en el sensor completo: con zoom digital solo se ve su centro
  vec2 qs = 0.5 + (q - 0.5) / uZoom;
  vec2 d = (qs - 0.5) * 2.0; // -1..1 en el sensor
  float r2 = dot(d, d) * 0.5; // 0 en el centro, 1 en las esquinas
  float seed = fract(uSeed * 0.6180339) * 97.0;
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

  if (uMode == 0) {
    // color: lo brillante se satura antes; al recortarse el rojo, el hollín pasa de naranja a amarillo-blanco
    float hl = smoothstep(0.35, 0.9, max(c.r, max(c.g, c.b)));
    float warm = hl * smoothstep(0.06, 0.3, c.r - c.b);
    c.g = mix(c.g, c.r * 0.9, 0.45 * warm);
    c.b *= 1.0 - 0.35 * warm;
    c = sShoulder(c * uGain * (1.0 + 0.7 * hl));
    // algo de contraste (dentro de la cámara, a oscuras, el negro del video es profundo) y de saturación
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
    float y = dot(c, LUMA);
    c = max(mix(vec3(y), c, 1.12), 0.0);
    // viñeta de la óptica (cos⁴)
    c *= 1.0 - 0.28 * r2;
    // ruido de lectura y de disparo (más en las zonas claras), con algo de color, y el negro algo levantado
    float n = sGrain(ip, seed) * (0.008 + 0.02 * sqrt(y));
    c += n + 0.005 * vec3(sGrain(ip + 17.0, seed), sGrain(ip + 41.0, seed), sGrain(ip + 73.0, seed));
    c = 0.006 + c * 0.994;
  } else if (uMode == 1) {
    // HiBMS: monocromo; el fondo retroiluminado no es uniforme y la óptica tiene moteado y polvo fijos
    float y = dot(c, LUMA) * uGain;
    float ill = (1.0 - 0.3 * r2) * (1.0 + 0.07 * (qs.x - qs.y));
    float spk = 1.0 + 0.06 * (sValue(qs * 7.0 + 3.1) - 0.5) + 0.035 * (sValue(qs * 23.0 + 9.7) - 0.5);
    // dos motas de polvo desenfocadas (un anillo tenue y una sombra suave)
    float m1 = length(qs - vec2(0.27, 0.68)) / 0.045;
    float m2 = length(qs - vec2(0.74, 0.31)) / 0.03;
    float e1 = m1 - 1.0; // (pow con base negativa no está definido en GLSL)
    float dust = 1.0 - 0.07 * exp(-e1 * e1 * 6.0) - 0.05 * exp(-m2 * m2 * 2.0);
    y *= ill * spk * dust;
    y += sGrain(ip, seed) * (0.006 + 0.012 * sqrt(max(y, 0.0)));
    c = vec3(max(y, 0.0));
  } else {
    // LLUV: intensificador; la imagen sale del fósforo (verdoso), con ruido que crece con la ganancia
    float y = dot(c, vec3(0.3333)) * uGain;
    y = 1.0 - exp(-y * 1.1);
    float circle = 1.0 - smoothstep(0.9, 1.02, length(d) * 0.74); // el intensificador redondo dentro del CCD cuadrado
    y *= (1.0 - 0.35 * r2) * circle;
    y += sGrain(ip, seed) * (0.008 + 0.012 * uGain) * (0.4 + 0.6 * sqrt(max(y, 0.0)) + 0.3 * circle);
    // destellos: eventos de un solo píxel en el microcanal
    float ev = sHash(ip * 0.913 + seed * 3.7);
    y += step(1.0 - 0.00025 * uGain, ev) * 0.5 * circle;
    c = max(y, 0.0) * mix(vec3(1.0), vec3(0.72, 1.0, 0.78), 0.45);
  }
  return c;
}
`;

/** Cuánto amplifica el intensificador del LLUV: llamas débiles (o ninguna) piden más ganancia, y más ruido. */
export function lluvGain(F) {
  const s = F.hot ? Math.min(1, Math.max(0, (F.a - 0.25) / 0.6)) : 0;
  return 1.8 - 0.8 * s;
}

/**
 * Material para dibujar un monitor desde su render target (escena en lineal, sin comprimir):
 * comprime con el tone mapping del renderer (AgX) cada lectura y aplica el sensor.
 */
export function monitorMaterial() {
  const uniforms = { tMap: { value: null } };
  for (const [k, v] of Object.entries(SENSOR_UNIFORMS())) uniforms[k] = { value: v };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap;
      varying vec2 vUv;
      ${SENSOR_PARS}
      vec3 mon(vec2 uv) {
        vec3 c = texture2D(tMap, uv).rgb;
        #ifdef TONE_MAPPING
          c = toneMapping(c);
        #endif
        return clamp(c, 0.0, 1.0);
      }
      vec3 sensorFetch(vec2 uv) {
        vec3 c = mon(uv);
        if (uCA > 0.0) {
          vec2 o = sensorCA(uv);
          c.r = mon(uv + o).r;
          c.b = mon(uv - o).b;
        }
        return c;
      }
      ${SENSOR_GLSL}
      void main() {
        gl_FragColor = linearToOutputTexel(vec4(sensorImage(vUv), 1.0));
      }`,
    depthTest: false,
    depthWrite: false,
  });
}
