import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { reducedMotion } from "../core/dom.js";
import { timeline, span, flameParams, PHASE } from "../model/flame.js";
import { buildRig } from "./lab/chamber.js";
import { buildEnv, LOOK } from "./lab/environments.js";
import { disposeTree, smooth } from "./lab/kit.js";
import * as tx from "./lab/textures.js";
import { readOptions, createDebug, createAdaptive } from "./lab/quality.js";
import { setTier } from "./lab/surface.js";
import { SENSORS, SENSOR_FPS, lluvGain, monitorMaterial } from "./lab/sensor.js";
import { createFlameVolume } from "./flameVolume.js";

/*
 * Laboratorio 3D: la gota y su llama dentro de la cámara de combustión, con un entorno por escenario.
 * Este módulo (y three.js con él) se importa de forma dinámica: solo se descarga al abrir la pestaña 3D.
 * dispose() libera el contexto WebGL al salir.
 *
 * Unidades en milímetros, con la gota en el origen. Hay dos formas de mirar:
 *   - vista libre: cámara orbital a tres escalas (gota, cámara, laboratorio);
 *   - vista de cámara: el punto de vista fijo de un instrumento real (color, HiBMS, LLUV),
 *     con su proporción de sensor y su forma de ver (a contraluz, ultravioleta…).
 * Los monitores repiten las tres cámaras en miniatura sobre el mismo lienzo.
 * Con post-procesado, las vistas de cámara y los monitores pasan por la emulación del sensor (lab/sensor.js).
 */

const VERT = /* glsl */ `
uniform float uTime; uniform float uG; uniform float uAmp;
varying vec3 vN; varying vec3 vV; varying float vY;
float hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float nz(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hsh(i), hsh(i+vec3(1.,0.,0.)), f.x), mix(hsh(i+vec3(0.,1.,0.)), hsh(i+vec3(1.,1.,0.)), f.x), f.y),
             mix(mix(hsh(i+vec3(0.,0.,1.)), hsh(i+vec3(1.,0.,1.)), f.x), mix(hsh(i+vec3(0.,1.,1.)), hsh(i+vec3(1.,1.,1.)), f.x), f.y), f.z); }
void main(){
  vec3 p = position;
  float n = nz(p * 2.2 + vec3(0.0, -uTime * (0.5 + 2.5 * uG), uTime * 0.2));
  p *= 1.0 + (n - 0.5) * (uAmp + 0.3 * uG);
  if (uG > 0.5) {
    float up = max(p.y, 0.0);
    p.y += up * up * 1.6;
    p.xz *= 1.0 - 0.5 * smoothstep(0.0, 2.6, p.y);
    p.y -= 0.35;
  }
  vY = p.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; uniform float uPow; uniform float uG; uniform float uBand; uniform float uGain;
varying vec3 vN; varying vec3 vV; varying float vY;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
  float band = uBand > 0.5 ? smoothstep(-0.3, 0.7, vY) : (uBand < -0.5 ? 1.0 - 0.7 * smoothstep(0.2, 1.8, vY) : 1.0);
  gl_FragColor = vec4(uColor * f * uAlpha * 1.6 * uGain * mix(1.0, band, uG), 1.0);
}`;

const PRE = 3.3; // segundos reales de despliegue e ignición antes de que arranque el reloj del modelo
const LEVEL = { drop: 118, chamber: 620 }; // distancias de cámara que separan las tres escalas
const FEEDS = ["color", "hibms", "lluv"];
const mix = (a, b, t) => a + (b - a) * t;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export async function createFlame3D(box, { getSim, getG, getEnv = () => "iss", view: view0 = "free", onHud, onSpots, onLost }) {
  const opt = readOptions();
  // el post-procesado se descarga aparte, solo cuando se abre el laboratorio; si no llega, se dibuja como antes
  let postMod = null;
  if (!opt.legacy) {
    try { postMod = await import("./lab/post.js"); }
    catch (err) { console.warn("Laboratorio 3D sin post-procesado:", err); }
  }
  // con post-procesado el antialiasing lo hace SMAA o el MSAA del composer, no el lienzo
  const renderer = new THREE.WebGLRenderer({ antialias: !postMod, powerPreference: "high-performance", stencil: false });
  renderer.setPixelRatio(Math.min(opt.dpr, devicePixelRatio || 1));
  box.prepend(renderer.domElement);
  const el = renderer.domElement;

  // iOS y los drivers pueden quitar el contexto WebGL (segundo plano, reinicio de GPU)
  let dead = false;
  let started = false;
  let raf = null;
  const lost = (e) => {
    e.preventDefault();
    dead = true;
    cancelAnimationFrame(raf);
    if (started) onLost?.(); // durante la carga, createFlame3D falla y la vista muestra el aviso
  };
  el.addEventListener("webglcontextlost", lost);

  const scene = new THREE.Scene();
  // resolución de las texturas procedurales y anisotropía según el nivel de calidad
  setTier(opt.level, renderer.capabilities.getMaxAnisotropy());
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;
  disposeTree(room);
  // reflejos reales del escenario (se capturan al cambiarlo): uno dentro de la cámara de combustión
  // y otro en el módulo. Mientras no estén, se usa el estudio genérico de RoomEnvironment
  let probes = null;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 20000);
  const fcam = new THREE.PerspectiveCamera(20, 1, 2, 4000); // cámara de instrumento
  let post = null;
  try { post = postMod?.createPost(renderer, scene, camera, opt) || null; }
  catch (err) { console.warn("Laboratorio 3D sin post-procesado:", err); }
  // AgX: la vista principal lo aplica en el post-procesado; los monitores, que van directo al lienzo, aquí.
  // Sin post-procesado se dibuja como antes (ACES).
  renderer.toneMapping = post ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = post ? 0.9 : 1;
  // la llama en HDR (lo que pasa del umbral florece) solo cuando va a un búfer de coma flotante que luego se
  // comprime (el del composer o el de un monitor); sus capas no pasan por el tone mapping del renderer,
  // así que sin post (o en monitores sin sensor) van a 1
  const GAIN = post?.hdr ? 3 : 1;
  const dbg = opt.debug ? createDebug(box, renderer) : null;
  // densidad de píxeles: el máximo del nivel y, sin ?q, baja sola si el cuadro no llega a ~30 fps
  const maxDpr = Math.min(opt.dpr, devicePixelRatio || 1);
  const adapt = opt.adaptive && post ? createAdaptive({
    max: maxDpr,
    apply(dpr) {
      renderer.setPixelRatio(dpr);
      post.setSize(W, H);
    },
  }) : null;
  // monitores con sensor: cada cámara se dibuja en su render target (HDR, en lineal) a unos 15 cuadros por
  // segundo, una por cuadro, y en cada cuadro se copian al lienzo con el sensor y el tone mapping
  const MON_FPS = 15;
  const mon = post && opt.monitors ? {
    rts: Object.fromEntries(FEEDS.map((id) => [id, new THREE.WebGLRenderTarget(192, 192, { type: post.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType })])),
    at: Object.fromEntries(FEEDS.map((id) => [id, -1e9])),
    mat: monitorMaterial(),
    cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    scene: new THREE.Scene(),
  } : null;
  if (mon) {
    // sin búfer de coma flotante se guarda en sRGB para no perder los tonos oscuros en 8 bits
    if (!post.hdr) Object.values(mon.rts).forEach((rt) => { rt.texture.colorSpace = THREE.SRGBColorSpace; });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mon.mat);
    quad.frustumCulled = false;
    mon.scene.add(quad);
  }
  /** Parámetros del sensor de `kind` para este cuadro. */
  const sensorOf = (kind, now) => {
    const P = SENSORS[kind];
    return { mode: P.mode, gain: kind === "lluv" ? lluvGain(F) : P.gain, ca: P.ca, seed: reducedMotion ? 1 : Math.floor((now / 1000) * SENSOR_FPS) % 4096 };
  };
  let W = 1;
  let H = 1;
  let monitors = []; // [{ id, el, rect }]
  const measure = () => {
    const b = box.getBoundingClientRect();
    monitors.forEach((m) => {
      const r = m.el.getBoundingClientRect();
      m.rect = r.width > 4 ? { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height } : null;
    });
  };
  const resize = () => {
    W = Math.max(1, box.clientWidth);
    H = Math.max(1, box.clientHeight);
    if (post) post.setSize(W, H);
    else renderer.setSize(W, H, false);
    measure();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const key = new THREE.PointLight(0x7fa6ff, 0, 0, 0.8);
  const warm = new THREE.PointLight(0xffa24a, 0, 0, 0.8);
  scene.add(hemi, sun, key, warm);

  // ---- cámara de combustión (fija) y entorno (cambia con el escenario) ----
  const rig = buildRig({ hdr: !!post?.hdr });
  scene.add(rig.group);
  let env = null;
  let look = LOOK.iss;

  // ---- gota y llama ----
  // líquido transparente: cuerpo oscuro que solo devuelve reflejos, para no quemarse junto a la llama
  const dropMat = new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.1, metalness: 0.35 });
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x050506 });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), dropMat);
  // a contraluz la gota actúa como lente: un punto de luz en el centro de la sombra
  const glint = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb4b7bb, depthTest: false }));
  glint.renderOrder = 5;
  scene.add(drop, glint);

  // llama volumétrica; con ?flameMode=legacy (o ?legacy3d) se dibujan las capas de antes
  const vol = opt.flame === "volume" ? createFlameVolume({ noiseSize: opt.level === "low" ? 32 : 64 }) : null;
  if (vol) scene.add(vol.group);
  const shellGeo = new THREE.SphereGeometry(1, 96, 64);
  const shell = (hex, pw, band) => {
    const base = new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
    const m = new THREE.Mesh(
      shellGeo,
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uG: { value: 0 }, uAmp: { value: 0.05 },
          uColor: { value: base.clone() }, uAlpha: { value: 1 }, uPow: { value: pw }, uBand: { value: band }, uGain: { value: GAIN },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    m.userData.base = base;
    scene.add(m);
    return m;
  };
  const [halo, blue, sootShell, coolShell] = vol ? [] : [
    shell(0x2a4bd0, 4.0, -1),
    shell(0x5b8cff, 2.4, -1),
    shell(0xff9433, 1.7, 1),
    shell(0x9cc6ff, 2.0, 0),
  ];
  const shells = vol ? [] : [halo, blue, sootShell, coolShell];
  if (vol) shellGeo.dispose();
  const UV_GREY = new THREE.Color(0.8, 0.8, 0.8);

  const glowTex = tx.glow();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  scene.add(glow);
  const cBlue = new THREE.Color(0x5b8cff);
  const cWarm = new THREE.Color(0xffa24a);

  // partículas de hollín
  const N = 900;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    seed.set([s * Math.cos(th), u, s * Math.sin(th), Math.random()], i * 4);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dot = vol ? glowTex : null; // con la llama nueva, cada partícula es un punto redondo y suave
  const pmHot = new THREE.PointsMaterial({ color: 0xffb35a, size: 0.2, map: dot, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const pmInk = new THREE.PointsMaterial({ color: 0x0a0a0c, size: 0.2, map: dot, transparent: true, opacity: 0.9, depthWrite: false });
  // tras apagarse la llama queda una nube oscura de hollín que deriva despacio
  const pmSmoke = new THREE.PointsMaterial({ color: 0x2b2622, size: 0.2, map: dot, transparent: true, opacity: 0.5, depthWrite: false });
  const pts = new THREE.Points(pg, pmHot);
  pts.frustumCulled = false;
  scene.add(pts);

  const BG = { hibms: new THREE.Color(0x8d9095), lluv: new THREE.Color(0x030303), dark: new THREE.Color(0x000000), free: new THREE.Color(look.bg) };
  let fog = null;

  // ---- estado ----
  const cam = { th: 0.7, ph: 1.15, dist: 60, auto: true };
  let goal = null;
  const S = {
    spin: !reducedMotion && !opt.pose, playing: !reducedMotion, rate: 1,
    clock: 0, pre: reducedMotion ? PRE : 0, burn: 9,
    envId: null, view: "free", fz: 1, simT0: null, g: null, fresh: true, introAt: null, smoke: -1, smokeR: 1, smokeDur: 5,
    last: performance.now(), hudAt: 0, tick: 0,
  };
  const F = {}; // lo que se dibuja en este cuadro (lo calcula step, lo usa present)

  const dropDist = (sim, g) => {
    const { fsr } = flameParams(sim.q);
    return Math.max((sim.q.d0 / 2) * fsr, sim.q.d0 / 2 + 1.5) * (g ? 5.6 : 4.6);
  };
  const levelOf = (d) => (d < LEVEL.drop ? "drop" : d < LEVEL.chamber ? "chamber" : "lab");

  /**
   * Captura el entorno con PMREM desde dos puntos: el centro de la cámara (para la mecánica, la gota
   * y las ventanas) y el centro del laboratorio (para los racks). Se hace con la llama oculta.
   */
  function capture() {
    S.capture = false;
    if (opt.legacy || dead) return;
    probes?.targets.forEach((t) => t.dispose());
    const hidden = [drop, glint, glow, pts, ...shells, ...(vol ? vol.parts : [])].filter((o) => o.visible);
    hidden.forEach((o) => { o.visible = false; });
    const lights = [hemi.intensity, sun.intensity, key.intensity, warm.intensity];
    hemi.intensity = look.hemi[2];
    sun.intensity = look.sun[1];
    key.intensity = warm.intensity = 0;
    const fogWas = scene.fog;
    scene.fog = null;
    scene.background = BG.free;
    scene.environment = envMap;
    scene.environmentIntensity = look.env;
    env.group.visible = rig.shell.visible = rig.ext.visible = rig.mech.visible = true;
    rig.instruments.forEach((it) => { it.group.visible = true; });
    rig.silhouette(false);
    const at = V3(0, look.lab.ty, 1300);
    env.update({ dt: 0, time: 0, g: null, inFront: true, inside: true, dist: 0, fresh: false, still: true, cam: at });
    const far = look.far || 30000;
    const size = opt.level === "low" ? 128 : 256;
    // fromScene devuelve el render target: se guarda entero para liberarlo al cambiar de escenario
    const targets = [
      pmrem.fromScene(scene, 0.01, 2, far, { size, position: V3(0, 0, 0) }),
      pmrem.fromScene(scene, 0.01, 5, far, { size, position: at }),
    ];
    probes = { targets, chamber: targets[0].texture, lab: targets[1].texture };
    hidden.forEach((o) => { o.visible = true; });
    [hemi.intensity, sun.intensity, key.intensity, warm.intensity] = lights;
    scene.fog = fogWas;
  }

  function swapEnv(id) {
    if (env) { scene.remove(env.group); disposeTree(env.group); }
    S.capture = true;
    S.envId = id;
    look = LOOK[id] || LOOK.iss;
    env = buildEnv(id);
    scene.add(env.group);
    BG.free.setHex(look.bg);
    fog = look.fog ? new THREE.FogExp2(look.fog[0], look.fog[1]) : look.range ? new THREE.Fog(...look.range) : null;
    hemi.color.setHex(look.hemi[0]);
    hemi.groundColor.setHex(look.hemi[1]);
    sun.color.setHex(look.sun[0]);
    sun.position.set(...look.sun[2]);
    S.fresh = true;
    if (reducedMotion) return;
    // entrada: se ve el laboratorio y la cámara vuela hasta la gota mientras se despliega y enciende
    S.pre = 0;
    S.clock = 0;
    Object.assign(cam, { th: look.lab.th, ph: look.lab.ph, dist: look.lab.dist, auto: false });
    goal = null;
    S.introAt = performance.now() + 900;
  }

  function setLevel(id) {
    S.introAt = null;
    if (id === "lab") goal = { ...look.lab };
    else if (id === "chamber") goal = { dist: 138, ph: 1.22 };
    else goal = { auto: true, ph: 1.15 };
  }

  // ---- entrada: en vista libre se orbita; en vista de cámara la rueda es zoom digital ----
  const ptrs = new Map();
  let drag = null;
  let pinch = null;
  const hands = () => { goal = null; S.introAt = null; };
  const zoomTo = (d) => { cam.dist = Math.max(7, Math.min(look.maxDist, d)); cam.auto = false; };
  const feedZoom = (z) => { S.fz = Math.max(0.5, Math.min(6, z)); };
  const gap = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const down = (e) => {
    hands();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) { pinch = { d: gap(), z: cam.dist, fz: S.fz }; drag = null; }
    else drag = { x: e.clientX, y: e.clientY, th: cam.th, ph: cam.ph };
  };
  const move = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      const k = gap() / Math.max(1, pinch.d);
      if (S.view === "free") zoomTo(pinch.z / k);
      else feedZoom(pinch.fz * k);
    } else if (drag && S.view === "free") {
      cam.th = drag.th - (e.clientX - drag.x) * 0.008;
      cam.ph = Math.max(0.25, Math.min(2.9, drag.ph - (e.clientY - drag.y) * 0.008));
    }
  };
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; drag = null; };
  const wheel = (e) => {
    e.preventDefault();
    if (S.view === "free") { hands(); zoomTo(cam.dist * Math.exp(e.deltaY * 0.0012)); }
    else feedZoom(S.fz * Math.exp(-e.deltaY * 0.0012));
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", wheel, { passive: false });

  const v3 = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  /** Avanza la simulación y deja en F todo lo necesario para dibujar el cuadro. */
  function step(sim, dt, now) {
    const g = getG();
    const { q, cool } = sim;
    const sp = span(sim);
    if (sim.t0 !== S.simT0) {
      // condiciones nuevas: la llama arranca de nuevo, sin repetir el despliegue
      if (S.simT0 !== null && S.pre >= PRE) { S.clock = reducedMotion ? (0.3 * sim.tBurn * 1000) / sp.speed : 0; S.burn = 9; }
      if (S.simT0 === null && reducedMotion) S.clock = (0.3 * sim.tBurn * 1000) / sp.speed;
      S.simT0 = sim.t0;
      if (g !== S.g) { S.g = g; S.fresh = true; }
    }

    // ---- secuencia: despliegue → retracción de agujas → ignición → combustión ----
    let stage = null;
    let grow = 1;
    let needle = 1;
    let ign = 0;
    let heat = 0;
    if (S.pre < PRE) {
      if (S.playing) S.pre += dt;
      const a = S.pre;
      grow = Math.cbrt(0.03 + 0.97 * smooth(0.15, 1.5, a));
      needle = smooth(1.6, 1.85, a);
      ign = smooth(1.9, 2.5, a);
      heat = smooth(2.3, 3.2, a);
      stage = a < 1.6 ? "deploy" : a < 2.0 ? "retract" : "ignite";
      if (S.pre >= PRE) { S.clock = 0; S.burn = 0; stage = null; }
    } else if (S.playing) {
      const before = Math.floor(((S.clock / 1000) * sp.speed) / sp.total);
      S.clock += dt * 1000 * S.rate;
      S.burn += dt;
      // al terminar el ensayo se repite completo, con una gota nueva
      if (Math.floor(((S.clock / 1000) * sp.speed) / sp.total) > before) { S.pre = 0; S.clock = 0; S.fresh = true; }
    }
    if (S.pre >= PRE) {
      ign = 1 - smooth(0.05, 0.5, S.burn);
      heat = 1 - smooth(0, 0.9, S.burn);
    }
    const pre = S.pre < PRE;
    const tl = timeline(sim, S.clock, 0, false);
    const t = pre ? 0 : tl.t;
    const d = pre ? q.d0 * grow : tl.d;
    const phase = pre ? "pre" : tl.phase;

    const { fsr, o2i, soot } = flameParams(q);
    const time = reducedMotion ? 0 : now / 1000;
    const rD = Math.max(d / 2, 0.001);
    const rF0 = Math.max((q.d0 / 2) * fsr, q.d0 / 2 + 1.5);
    const kindle = smooth(0, 0.45, S.burn); // la llama crece desde los ignitores
    const flash = Math.max(0, 1 - S.burn / 0.3);
    const rF = Math.max(rD * fsr, rD + 0.6) * (g ? 0.8 : 1) * (0.25 + 0.75 * kindle);
    const hot = phase === "hot" && d > 0.02;
    const a = Math.min(0.95, 0.35 + o2i * 0.45) * kindle;
    const flick = reducedMotion ? 1 : 1 + 0.025 * Math.sin(time * 11) + 0.015 * Math.sin(time * 27);
    // nube de hollín: empieza al apagarse la llama y se desvanece en unos segundos
    if (hot || pre) { S.smoke = -1; S.smokeR = rF; }
    else if (S.smoke < 0 && vol && soot > 0.02) {
      // la nube se desvanece en lo que queda del ensayo (como mucho 5 s), para que no la corte el reinicio
      const tm = (((S.clock / 1000) * sp.speed) % sp.total);
      S.smoke = 0;
      S.smokeDur = Math.max(0.3, Math.min(5, (sp.total - tm) / sp.speed / Math.max(0.1, S.rate)));
    }
    if (S.smoke >= 0 && S.playing) S.smoke += dt;
    Object.assign(F, {
      g, hot, a, soot, kindle, flash, heat, rF, rF0, rD, d0: q.d0,
      dropOn: d > 0.02,
      sootOn: hot && soot > 0.02 && kindle > 0.6,
      smoke: S.smoke >= 0 ? Math.max(0, 1 - S.smoke / S.smokeDur) : 0,
      coolA: phase === "cool" ? 0.35 : phase === "out" && cool ? 0.12 : 0,
    });

    drop.scale.setScalar(rD);
    glint.scale.setScalar(rD * 0.17);
    rig.set({ rD, needle, ign, heat });
    if (vol) vol.update(F, time);
    else {
      for (const [m, s] of [[halo, 1.22], [blue, 1.0], [sootShell, 0.86]]) {
        m.scale.setScalar(rF * s * flick);
        m.material.uniforms.uTime.value = time;
        m.material.uniforms.uG.value = g;
      }
      coolShell.scale.setScalar(rD * 3.2);
      coolShell.material.uniforms.uTime.value = time;
      coolShell.material.uniforms.uAlpha.value = F.coolA;
    }
    key.position.set(rF * 0.3, rF * 0.4, rF * 0.5);
    warm.position.set(-rF * 0.3, rF * 0.2, rF * 0.4);

    // hollín: cascarón esférico dentro de la llama sin gravedad; columna ascendente con gravedad
    if (F.sootOn || F.smoke > 0) {
      // la nube conserva el radio de la llama al apagarse y se expande poco a poco
      const R0 = F.sootOn ? rF : S.smokeR * (1 + 0.12 * S.smoke);
      for (let i = 0; i < N; i++) {
        const x = seed[i * 4];
        const y = seed[i * 4 + 1];
        const z = seed[i * 4 + 2];
        const r = seed[i * 4 + 3];
        if (!g) {
          const rad = R0 * (0.7 + 0.16 * ((r + time * 0.05) % 1));
          const ang = (time * 0.15 + r * 6) * 0.1;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          pos[i * 3] = (x * ca - z * sa) * rad;
          pos[i * 3 + 1] = y * rad;
          pos[i * 3 + 2] = (x * sa + z * ca) * rad;
        } else {
          const life = (r + time * 0.35) % 1;
          const k = R0 * 0.5 * (1 - life * 0.7);
          pos[i * 3] = x * k;
          pos[i * 3 + 1] = R0 * (-0.1 + life * 2.4);
          pos[i * 3 + 2] = z * k;
        }
      }
      pg.attributes.position.needsUpdate = true;
      pmHot.opacity = Math.min(0.9, soot * 0.9);
      pmSmoke.opacity = 0.5 * F.smoke * Math.min(1, soot * 2);
      // a contraluz (HiBMS) la nube también se desvanece
      pmInk.opacity = F.sootOn ? 0.9 : 0.9 * F.smoke * Math.min(1, soot * 2);
      // el punto redondo y suave necesita algo más de tamaño para leerse igual
      pmHot.size = pmInk.size = pmSmoke.size = Math.max(F.sootOn ? 0.06 : 0.14, R0 * (vol ? 0.045 : 0.025));
      if (vol) pmHot.color.copy(vol.sootColor).multiplyScalar(1.6);
    }

    // ---- cámara orbital ----
    if (S.introAt && now > S.introAt) setLevel("drop");
    const dd = dropDist(sim, g);
    if (goal) {
      const k = 1 - Math.exp(-dt * 2.6);
      const target = goal.auto ? dd : goal.dist;
      cam.dist = Math.exp(mix(Math.log(cam.dist), Math.log(target), k));
      if (goal.ph != null) cam.ph = mix(cam.ph, goal.ph, k);
      if (goal.th != null) cam.th += Math.atan2(Math.sin(goal.th - cam.th), Math.cos(goal.th - cam.th)) * k;
      if (Math.abs(Math.log(cam.dist / target)) < 0.012) { cam.auto = !!goal.auto; goal = null; }
    } else if (cam.auto) cam.dist = mix(cam.dist, dd, 1 - Math.exp(-dt * 5));
    const level = levelOf(cam.dist);
    if (S.spin && ptrs.size === 0 && !goal && !S.introAt) cam.th += level === "drop" ? dt * 0.18 : dt * 0.05 * Math.cos(time * 0.3);

    const wide = smooth(Math.log(700), Math.log(1700), Math.log(cam.dist));
    const ty = mix(g ? rF0 * 0.7 : 0, look.lab.ty, wide);
    const R = cam.dist;
    camera.position.set(R * Math.sin(cam.ph) * Math.sin(cam.th), ty + R * Math.cos(cam.ph), R * Math.sin(cam.ph) * Math.cos(cam.th));
    camera.lookAt(0, ty, 0);
    camera.fov = mix(mix(38, 58, smooth(Math.log(100), Math.log(135), Math.log(R))), 62, smooth(Math.log(520), Math.log(1500), Math.log(R)));
    camera.near = Math.max(0.4, R * 0.02);
    camera.far = look.far || R * 3 + 12000;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    // vista en corte: lo que quedaría entre la cámara y la gota se oculta
    F.inFront = camera.position.z > 255;
    F.inside = R < 190;
    F.dist = R;
    camDir.copy(camera.position).normalize();
    rig.instruments.forEach((it) => { it.cut = !F.inside && it.dir.dot(camDir) >= 0.25; });
    env?.update({ dt: reducedMotion ? 0 : dt, time, g, inFront: F.inFront, inside: F.inside, dist: R, fresh: S.fresh, still: reducedMotion, cam: camera.position });
    S.fresh = false;

    // ---- puntos de interés proyectados a pantalla (solo en vista libre) ----
    if (onSpots) {
      const list = [];
      const put = (id, p) => {
        v3.copy(p).project(camera);
        list.push({ id, x: (v3.x * 0.5 + 0.5) * W, y: (0.5 - v3.y * 0.5) * H, on: v3.z < 1 && Math.abs(v3.x) < 0.92 && Math.abs(v3.y) < 0.8 });
      };
      if (S.view === "free" && !goal) {
        if (level === "drop") {
          if (F.dropOn) put("drop", v3.set(rD * 0.75, rD * 0.75, 0));
          if (hot && kindle > 0.9) put(g ? "plume" : "flame", v3.set(0, g ? rF * 2.2 : rF, 0));
          if (F.sootOn && !g) put("soot", v3.set(-rF * 0.78, -rF * 0.12, 0));
        } else if (level === "chamber") {
          for (const id of ["needles", "igniters", "hibms", "lluv", "backlight", "radiometer", "colorcam"]) put(id, rig.anchors[id]);
        } else {
          put(env.chamberSpot || "chamber", rig.anchors.chamber);
          for (const id in env.anchors) put(id, env.anchors[id]);
        }
      }
      onSpots(list);
    }

    if (onHud && now - S.hudAt > 100) {
      S.hudAt = now;
      const prog = pre ? 0 : ((((S.clock / 1000) * sp.speed) % sp.total) / sp.total);
      onHud({ t, d, phase, stage, flame: hot ? 2 * rF : null, label: pre ? "Preparando el ensayo" : PHASE[phase], progress: prog, playing: S.playing, level, inst: S.view, g, feed: S.view === "free" ? null : F.feed });
    }
  }

  /** Prepara visibilidad, materiales y luces para dibujar como `kind`: "free" o una de las cámaras. */
  function present(kind, main) {
    // va a un búfer que se comprime después: el del composer o, con sensor, el render target de un monitor
    const buffered = main ? !!post : !!mon;
    const hdr = buffered && post?.hdr;
    for (const m of shells) m.material.uniforms.uGain.value = hdr ? GAIN : 1;
    const hibms = kind === "hibms";
    const uv = kind === "lluv";
    const color = !hibms && !uv;
    const feed = kind !== "free";
    scene.background = hibms ? BG.hibms : uv ? BG.lluv : BG.free;
    scene.fog = color && main ? fog : null;
    // dentro de la cámara real casi no hay luz: la imagen la da la llama
    const dim = feed ? 0.3 : 1;
    hemi.intensity = look.hemi[2] * dim;
    sun.intensity = look.sun[1] * dim;
    scene.environmentIntensity = look.env * (feed ? 0.6 : 1);
    // reflejos: los de dentro de la cámara de combustión salvo en la vista amplia del laboratorio
    if (probes) scene.environment = main && kind === "free" && F.dist > LEVEL.chamber ? probes.lab : probes.chamber;
    if (env) env.group.visible = color && main;
    rig.shell.visible = color;
    rig.ext.visible = !feed && F.inFront && F.dist > 520;
    rig.instruments.forEach((it) => { it.group.visible = feed || !it.cut; });
    rig.mech.visible = !uv;
    rig.silhouette(hibms);

    drop.visible = F.dropOn && !uv;
    drop.material = hibms ? inkMat : dropMat;
    glint.visible = hibms && F.dropOn;
    if (vol) {
      // la llama nueva aplica su propio tone mapping al ir directo al lienzo; en un búfer LDR
      // (sin coma flotante) se baja la emisión para que el anillo no se recorte a blanco
      vol.present(kind, { gain: buffered && !post.hdr ? 0.5 : 1, camera: main && kind === "free" ? camera : null });
    } else {
      for (const [m, al, on] of [[halo, F.a * 0.35, !hibms], [blue, F.a, !hibms], [sootShell, F.soot * 0.95 * F.kindle, color]]) {
        m.visible = F.hot && on && al > 0.01;
        m.material.uniforms.uAlpha.value = uv ? al * 0.7 : al;
        if (m !== sootShell) m.material.uniforms.uColor.value.copy(uv ? UV_GREY : m.userData.base);
      }
      coolShell.visible = color && F.coolA > 0;
    }
    pts.visible = (F.sootOn || F.smoke > 0) && !uv;
    pts.material = hibms ? pmInk : F.sootOn ? pmHot : pmSmoke;

    glow.visible = color && (F.hot || F.heat > 0.05);
    if (glow.visible) {
      // de lejos la llama es un punto: se le da un tamaño aparente mínimo, como el destello en una lente
      const gs = F.hot ? Math.max(F.rF * (4.6 + F.flash * 5), feed ? 0 : cam.dist * 0.045) : 9;
      glow.scale.set(gs, gs * (F.g ? 1.6 : 1), 1);
      glow.position.set(0, F.g && F.hot ? F.rF * 0.6 : 0, 0);
      glow.material.color.copy(cBlue).lerp(cWarm, F.hot ? Math.min(0.7, F.soot * 0.6 + F.flash) : 1);
      // con bloom real el sprite solo aporta el tamaño aparente mínimo y un halo suave
      glow.material.opacity = (F.hot ? F.a * 0.2 + F.flash * 0.6 : F.heat * 0.35) * (hdr ? 0.55 : 1);
      // de cerca la llama volumétrica ya se ve entera: el sprite solo acompaña de lejos
      if (vol && F.hot && !feed) glow.material.opacity *= 0.2 + 0.8 * smooth(Math.log(140), Math.log(420), Math.log(cam.dist));
    }
    const lit = F.hot && color ? 1 : 0;
    key.intensity = lit * (40 + 110 * F.a) * (1 + F.flash * 2);
    warm.intensity = lit * F.soot * 120 * F.kindle + (color ? F.heat * 14 : 0);
    // la luz del hollín toma el color de su cuerpo negro (y el del hilo del ignitor al encender)
    if (vol) warm.color.copy(lit ? vol.sootColor : cWarm);
  }

  /** Coloca la cámara de instrumento. Devuelve los píxeles por milímetro en el plano de la gota. */
  function aim(kind, h, zoom, full = h) {
    const c = rig.cams[kind];
    const dist = c.pos.length();
    // campo de vista fijo de cada instrumento (media altura, en mm, en el plano de la gota)
    // en 1g la pluma sube por encima del radio de µg: el LLUV abre algo más para no cortarla
    const half = (kind === "color" ? 34 : kind === "hibms" ? Math.max(10, 3.6 * F.d0) : Math.max(16, F.rF0 * (F.g ? 2 : 1.5))) / zoom;
    fcam.position.copy(c.pos);
    fcam.up.copy(c.up);
    fcam.lookAt(0, 0, 0);
    fcam.fov = THREE.MathUtils.radToDeg(2 * Math.atan((half * full) / h / dist));
    fcam.aspect = c.aspect;
    fcam.updateProjectionMatrix();
    return h / (2 * half);
  }

  function draw(dt, now = performance.now()) {
    // cada render limpia solo su recorte; el fondo negro de las bandas se limpia aparte
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    if (S.view === "free") {
      present("free", true);
      if (post) { post.setSensor(null); post.render(camera, reducedMotion ? 0 : dt); }
      else renderer.render(scene, camera);
      F.feed = null;
    } else {
      // imagen del instrumento centrada, con la proporción de su sensor
      const asp = rig.cams[S.view].aspect;
      const h = Math.min(H, W / asp);
      const w = h * asp;
      const x = (W - w) / 2;
      const y = (H - h) / 2;
      present(S.view, true);
      if (post) {
        // el post-procesado trabaja a lienzo completo: se dibuja con el mismo mm por píxel y el
        // sensor deja en negro lo que queda fuera de su rectángulo
        const pxmm = aim(S.view, h, S.fz, H);
        fcam.aspect = W / H;
        fcam.updateProjectionMatrix();
        const P = SENSORS[S.view];
        // por debajo de 1 el zoom solo aleja la vista: el sensor (píxeles, viñeta) queda como a 1×
        const sz = Math.max(1, S.fz);
        post.setSensor({ ...sensorOf(S.view, now), rect: { x, y: H - y - h, w, h }, native: [P.native[0] / sz, P.native[1] / sz], zoom: sz, pr: renderer.getPixelRatio() }, W, H);
        post.render(fcam, reducedMotion ? 0 : dt);
        F.feed = { x, y, w, h, pxmm };
      } else {
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        const pxmm = aim(S.view, h, S.fz);
        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);
        renderer.setScissorTest(true);
        renderer.render(scene, fcam);
        F.feed = { x, y, w, h, pxmm };
      }
    }
    // monitores: las tres cámaras en miniatura
    if (mon) { drawMonitors(now); return; }
    for (const m of monitors) {
      if (!m.rect || !opt.monitors) continue;
      const { x, y, w, h } = m.rect;
      present(m.id, false);
      aim(m.id, h, 1);
      fcam.aspect = w / h;
      fcam.updateProjectionMatrix();
      renderer.setViewport(x, H - y - h, w, h);
      renderer.setScissor(x, H - y - h, w, h);
      renderer.setScissorTest(true);
      renderer.render(scene, fcam);
    }
  }

  /** Monitores con sensor: refresca el más atrasado (como mucho uno por cuadro) y los copia todos al lienzo. */
  function drawMonitors(now) {
    const live = opt.monitors ? monitors.filter((m) => m.rect) : [];
    if (!live.length) return;
    const pr = renderer.getPixelRatio();
    const stale = live.reduce((a, b) => (mon.at[b.id] < mon.at[a.id] ? b : a));
    if (now - mon.at[stale.id] >= 1000 / MON_FPS) {
      mon.at[stale.id] = now;
      const { w, h } = stale.rect;
      const rh = Math.min(192, Math.ceil(h * pr));
      const rw = Math.max(1, Math.round((rh * w) / h));
      const rt = mon.rts[stale.id];
      if (rt.width !== rw || rt.height !== rh) rt.setSize(rw, rh);
      present(stale.id, false);
      aim(stale.id, h, 1);
      fcam.aspect = w / h;
      fcam.updateProjectionMatrix();
      renderer.setRenderTarget(rt);
      renderer.render(scene, fcam);
      renderer.setRenderTarget(null);
    }
    const u = mon.mat.uniforms;
    u.uRect.value.set(0, 0, 1, 1);
    for (const m of live) {
      const { x, y, w, h } = m.rect;
      const s = sensorOf(m.id, now);
      const P = SENSORS[m.id];
      u.tMap.value = mon.rts[m.id].texture;
      u.uMode.value = s.mode;
      u.uGain.value = s.gain;
      u.uCA.value = s.ca;
      u.uSeed.value = s.seed;
      u.uNative.value.set(P.native[0], P.native[1]);
      u.uRes.value.set(w * pr, h * pr);
      renderer.setViewport(x, H - y - h, w, h);
      renderer.setScissor(x, H - y - h, w, h);
      renderer.setScissorTest(true);
      renderer.render(mon.scene, mon.cam);
    }
    renderer.setScissorTest(false);
  }

  // poses de captura (?pose=): encuadre, momento del ensayo y vista fijos, en pausa
  function applyPose(sim) {
    S.posed = true;
    const g = getG();
    // el ensayo ya se da por visto: step() no vuelve a fijar el reloj (con movimiento reducido lo haría)
    S.simT0 = sim.t0;
    S.g = g;
    S.spin = false;
    S.introAt = null;
    goal = null;
    S.fz = 1;
    const drop = { th: 0.7, ph: 1.15, dist: dropDist(sim, g), auto: true };
    const P = {
      drop: { cam: drop, progress: 0.3 },
      ignition: { cam: drop, pre: 3.0 }, // ignitores junto a la gota y con el hilo casi al máximo
      rack: { cam: { ...look.lab, auto: false }, progress: 0.3 },
      needles: { cam: { th: 0.7, ph: 1.22, dist: 138, auto: false }, pre: 1.2 },
      hibms: { cam: drop, progress: 0.3, view: "hibms" },
      lluv: { cam: drop, progress: 0.3, view: "lluv" },
    }[opt.pose];
    Object.assign(cam, P.cam);
    S.view = P.view || "free";
    if (P.pre != null) { S.pre = P.pre; S.clock = 0; S.burn = 0; } else api.setProgress(P.progress);
    S.playing = false;
  }

  function frame(now) {
    adapt?.sample(now - S.last, !S.introAt && !goal && !document.hidden);
    const dt = Math.min(0.1, (now - S.last) / 1000);
    S.last = now;
    const id = getEnv();
    if (id !== S.envId) swapEnv(id);
    if (++S.tick % 45 === 0) measure();
    const sim = getSim();
    if (sim) {
      if (S.capture) capture();
      if (opt.pose && !S.posed) applyPose(sim);
      step(sim, dt, now);
      dbg?.begin();
      draw(dt, now);
      dbg?.end(`${opt.level}${post ? (post.hdr ? " · HDR" : " · LDR") : " · legacy"} · dpr ${renderer.getPixelRatio()}`);
    }
    raf = requestAnimationFrame(frame);
  }

  // compilar los shaders antes del primer cuadro evita el tirón al abrir. compile() solo recorre lo visible:
  // se muestran un momento las capas de la llama y se compila para cada destino (búfer HDR y lienzo)
  S.view = FEEDS.includes(view0) ? view0 : "free";
  swapEnv(getEnv());
  const flameParts = [drop, ...shells, ...(vol ? vol.parts : []), pts, glow];
  const precompile = async (kind, cam, target, main = kind === "free") => {
    present(kind, main);
    flameParts.forEach((o) => { o.visible = true; });
    renderer.setRenderTarget(target);
    await renderer.compileAsync(scene, cam);
  };
  try {
    await precompile("free", camera, post ? post.target : null);
    if (post) for (const id of FEEDS) await precompile(id, fcam, post.target, true);
    if (opt.monitors) for (const id of FEEDS) await precompile(id, fcam, mon ? mon.rts[id] : null);
    renderer.setRenderTarget(null);
    if (mon) await renderer.compileAsync(mon.scene, mon.cam);
  } catch { /* se compilan al dibujar */ } finally { renderer.setRenderTarget(null); }
  // los pases del post-procesado se compilan al usarse: un cuadro de prueba con el sensor y otro sin él
  // evita el tirón la primera vez que se abre una vista de cámara (el lienzo se vuelve a dibujar enseguida)
  if (post && !dead) {
    try {
      present("color", true);
      post.setSensor({ ...sensorOf("color", 0), rect: { x: 0, y: 0, w: W, h: H }, native: SENSORS.color.native, zoom: 1, pr: renderer.getPixelRatio() }, W, H);
      post.render(fcam, 0);
      post.setSensor(null);
      present("free", true);
      post.render(camera, 0);
    } catch { /* se compilan al dibujar */ }
  }

  const api = {
    /** Repite el ensayo desde el despliegue de la gota. */
    restart() { S.pre = reducedMotion ? PRE : 0; S.clock = 0; S.fresh = true; if (!reducedMotion) S.playing = true; },
    toggleSpin() { S.spin = !S.spin; return S.spin; },
    get spinning() { return S.spin; },
    setPlaying(on) { S.playing = on; },
    get playing() { return S.playing; },
    /** Salta a una fracción (0–1) del ensayo. */
    setProgress(f) {
      const sim = getSim();
      if (!sim) return;
      const sp = span(sim);
      S.pre = PRE;
      S.burn = 9;
      S.clock = (Math.min(0.999, Math.max(0, f)) * sp.total * 1000) / sp.speed;
    },
    setRate(r) { S.rate = r; },
    setLevel,
    /** "free" para la vista orbital o el id de una cámara ("color", "hibms", "lluv"). La entrada sigue de fondo. */
    setView(id) {
      S.view = id === "free" || FEEDS.includes(id) ? id : "free";
      S.fz = 1;
    },
    /** Elementos sobre los que se dibujan las miniaturas: [{ id, el }]. */
    setMonitors(list) {
      monitors = list.filter((m) => FEEDS.includes(m.id)).map((m) => ({ ...m, rect: null }));
      measure();
    },
    /** Con calidad baja los monitores no se dibujan: la vista los oculta. */
    monitors: opt.monitors,
    /** Con ?pose=, la vista de esa pose (la interfaz debe mostrarla); si no, null. */
    poseView: opt.pose === "hibms" || opt.pose === "lluv" ? opt.pose : opt.pose ? "free" : null,
    /** Sin post-procesado (?legacy3d o si no cargó): la vista conserva los filtros CSS de antes. */
    legacy: !post,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("webglcontextlost", lost);
      post?.dispose();
      dbg?.dispose();
      if (window.__lab?.renderer === renderer) { delete window.__lab; delete window.__lab3d; }
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      rig.silhouette(false);
      vol?.dispose();
      disposeTree(scene);
      for (const o of [inkMat, dropMat, pmHot, pmInk, pmSmoke, glowTex, envMap, ...(probes?.targets || [])]) o?.dispose();
      if (mon) { Object.values(mon.rts).forEach((rt) => rt.dispose()); disposeTree(mon.scene); }
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    },
  };

  // si el contexto se perdió durante la carga no se arranca: la vista mostrará el aviso
  if (dead || renderer.getContext().isContextLost()) {
    api.dispose();
    throw new Error("Se perdió el contexto WebGL durante la carga");
  }
  started = true;
  S.last = performance.now();
  if (S.introAt) S.introAt = S.last + 900;
  raf = requestAnimationFrame(frame);
  // ?debug: ajustes en vivo desde la consola; frame() dibuja un cuadro aunque la pestaña no esté visible
  if (dbg) window.__lab = { renderer, post, scene, hemi, sun, key, warm, shells, vol, glow, pts, F, api, cam, camera, rig, env: () => env, hold: () => { goal = null; S.introAt = null; S.spin = false; }, size: (w, h) => { ro.disconnect(); W = w; H = h; if (post) post.setSize(w, h); else renderer.setSize(w, h, false); }, frame: () => { cancelAnimationFrame(raf); frame(performance.now()); cancelAnimationFrame(raf); }, run: () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } };

  return api;
}
