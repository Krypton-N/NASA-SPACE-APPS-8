import { HalfFloatType, UnsignedByteType, Uniform } from "three";
import {
  EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute,
  BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, NoiseEffect, SMAAEffect, SMAAPreset,
} from "postprocessing";
import { SENSOR_PARS, SENSOR_GLSL, SENSOR_UNIFORMS } from "./sensor.js";

/**
 * Sensor de la cámara de instrumento (ver sensor.js) sobre la imagen ya comprimida. Lee el búfer en otros
 * puntos (píxel nativo, aberración cromática): es una convolución y va sola en su pase. Fuera del
 * rectángulo del sensor deja negro, así que la vista de cámara se dibuja a lienzo completo.
 */
class SensorEffect extends Effect {
  constructor() {
    const uniforms = new Map(Object.entries(SENSOR_UNIFORMS()).map(([k, v]) => [k, new Uniform(v)]));
    super("SensorEffect", /* glsl */ `
      ${SENSOR_PARS}
      vec3 sensorFetch(vec2 uv) {
        vec3 c = texture2D(inputBuffer, uv).rgb;
        if (uCA > 0.0) {
          vec2 o = sensorCA(uv);
          c.r = texture2D(inputBuffer, uv + o).r;
          c.b = texture2D(inputBuffer, uv - o).b;
        }
        return c;
      }
      ${SENSOR_GLSL}
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(sensorImage(uv), 1.0);
      }`, { attributes: EffectAttribute.CONVOLUTION, uniforms });
  }
}

/*
 * Post-procesado de la vista principal: la escena se dibuja en HDR (valores > 1 en la llama
 * y el hilo del ignitor) y solo lo que pasa del umbral florece. Después se comprime
 * a pantalla con AgX, que conserva el tono de la llama sin quemarlo a blanco.
 *   pase A: bloom + tone mapping + viñeta
 *   pase B: antialiasing (SMAA) + grano leve, ya sobre la imagen comprimida
 *   pase C (solo en las vistas de cámara): el sensor del instrumento, en lugar de la viñeta y el grano
 */
export function createPost(renderer, scene, camera, opts) {
  const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
  const composer = new EffectComposer(renderer, {
    frameBufferType: hdr ? HalfFloatType : UnsignedByteType,
    multisampling: hdr ? opts.multisampling : 0,
  });
  const render = new RenderPass(scene, camera);
  const bloom = new BloomEffect({
    mipmapBlur: true,
    // en HDR solo florece lo que pasa de 1.3 (llama, hilo al rojo); sin búfer de coma flotante todo
    // queda en [0, 1] y el umbral baja para que la llama aún brille
    luminanceThreshold: hdr ? 1.3 : 0.85,
    luminanceSmoothing: 0.3,
    intensity: 1.1,
    radius: 0.72,
    levels: opts.bloomLevels,
  });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
  const noise = new NoiseEffect({ premultiply: true });
  noise.blendMode.opacity.value = 0.22;

  const sensor = new SensorEffect();
  const DARK = vignette.darkness;
  const GRAIN = noise.blendMode.opacity.value;

  composer.addPass(render);
  composer.addPass(new EffectPass(camera, bloom, tone, vignette));
  const tail = new EffectPass(camera, ...(opts.smaa ? [new SMAAEffect({ preset: SMAAPreset.MEDIUM }), noise] : [noise]));
  const sensorPass = new EffectPass(camera, sensor);
  composer.addPass(tail);
  composer.addPass(sensorPass);
  // el último pase activo es el que va al lienzo: B en la vista libre, C en las de cámara
  tail.renderToScreen = true;
  sensorPass.enabled = false;
  let feedOn = false;

  let current = camera;
  return {
    hdr,
    bloom,
    /** Búfer donde se dibuja la escena (para precompilar los shaders con ese destino). */
    target: composer.inputBuffer,
    /** Dibuja la escena con `cam` y todo el post-procesado en el lienzo. */
    render(cam, dt) {
      if (cam !== current) { composer.setMainCamera(cam); current = cam; }
      composer.render(dt);
    },
    /**
     * Activa el sensor (`s`: { mode, rect, native, gain, ca, seed, pr, zoom }) o lo quita (null). rect en píxeles CSS
     * del lienzo (w × h), desde abajo a la izquierda; native: píxeles nativos visibles (con el zoom digital);
     * pr: la proporción de píxeles del renderer.
     */
    setSensor(s, w, h) {
      const on = !!s;
      if (on !== feedOn) {
        feedOn = on;
        sensorPass.enabled = on;
        tail.renderToScreen = !on;
        vignette.darkness = on ? 0 : DARK;
        noise.blendMode.opacity.value = on ? 0 : GRAIN;
      }
      if (!on) { tail.enabled = true; return; }
      // con el píxel nativo más grande que el de pantalla, el promedio de cuatro lecturas del sensor ya
      // suaviza los bordes: SMAA solo hace falta (y solo en los niveles que lo usan) con píxeles finos
      tail.enabled = !!opts.smaa && (s.rect.h * s.pr) / s.native[1] <= 1.3;
      const u = sensor.uniforms;
      u.get("uMode").value = s.mode;
      u.get("uRect").value.set(s.rect.x / w, s.rect.y / h, (s.rect.x + s.rect.w) / w, (s.rect.y + s.rect.h) / h);
      u.get("uNative").value.set(s.native[0], s.native[1]);
      u.get("uRes").value.set(w * s.pr, h * s.pr);
      u.get("uGain").value = s.gain;
      u.get("uCA").value = s.ca;
      u.get("uSeed").value = s.seed;
      u.get("uZoom").value = s.zoom ?? 1;
    },
    setSize(w, h) { composer.setSize(w, h, false); },
    dispose() { composer.dispose(); },
  };
}
