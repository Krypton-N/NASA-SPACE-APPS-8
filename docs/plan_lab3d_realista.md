# Propuesta: Laboratorio 3D realista (Flame in Freefall)

> **Alcance:** este documento es solo un plan; no se modificó ningún archivo.
> **Base:** three.js 0.186.1 con WebGLRenderer (WebGL2), JS vanilla y Vite 8.
> **Calendario:** trabajo gráfico del 6 al 11 de noviembre. El 12 y 13 quedan reservados para pitch, video, QA y congelación. El hackathon es el 14 y 15.
> **Principio rector:** es una **recreación ilustrativa**.
> - La llama la parametriza el modelo KNN (K, extinción, llama fría) y su radio es cualitativo.
> - No se añade hardware que no exista en el CIR/FLEX.
> - Las cámaras científicas son **emulaciones** de los instrumentos, no datos reales.

---

## Antes de empezar: decisiones y verificaciones

1. **Qué significa "3D por defecto".** Hay dos opciones:
   - (a) que el Simulador abra siempre en 3D;
   - (b) que además la app arranque en la pestaña Simulador.

   El plan asume (a). Si el usuario quiere (b), se suma `initial:'simulador'` en `main.js`, recordando que `localStorage 'fif-tab'` tiene prioridad.
2. **Personas y dispositivos.** Las estimaciones son para 1 persona. Con 2 personas, F3 y el shader de sensor se hacen en paralelo. Hay que fijar desde el día 1 una laptop con iGPU concreta y un Android de gama media para las pruebas.
3. **Reglas de Space Apps 2026.** Confirmar con el organizador local si se permite llegar con trabajo hecho antes del evento. Los términos públicos no lo aclaran.

---

## 0. Pedido 1: 3D como vista por defecto (F0, 0.5 día)

**Cómo funciona hoy** (verificado en el código):
- El selector 2D/3D lo crea `mountParts` en `app/src/views/parts.js`, registrado en `main.js:67-70`.
- `'3d'` **ya es** `parts[0]`.
- El problema es el hash. `parts.js:35` escribe `#simulador/2d` con `history.replaceState`, y `router.js:75-76` lo restaura al recargar. Por eso el usuario vuelve a ver 2D.
- `localStorage` solo guarda la pestaña (`fif-tab`, `router.js:50`), no la subvista.

**Cambio:**
- Al arrancar, ignorar el sub `'2d'` que llega en el hash. Solo se respeta si el usuario eligió 2D con un clic: se guarda una clave nueva, `fif-sim-view`, únicamente en el clic.
- **Fallback automático:** en el `catch` de `flame3dView.js:389-392`, hacer `location.hash = '#simulador/2d'`. Eso activa la ruta ya existente: hashchange → `router.go` → `route('2d')` → `show('2d')`. Se muestra un aviso visible en 2D ("3D no disponible en este dispositivo") y **no** se sobrescribe `fif-sim-view`. Si el usuario eligió 2D a mano, el 3D no se monta y no hace falta fallback.
- **Móvil:** 3D por defecto también, pero con nivel de calidad bajo forzado y sin monitores.
- **Pérdida de contexto:** escuchar `webglcontextlost`/`webglcontextrestored`. Se muestra un aviso con "volver a 2D" o se reconstruye la escena al restaurarse. iOS Safari pierde el contexto al pasar a segundo plano. Al salir de la pestaña Simulador se hace `dispose()` + `renderer.forceContextLoss()`.
- `reducedMotion` (`core/dom.js`) congela el parpadeo, el ruido animado y la persistencia de los efectos nuevos.

---

## 1. Diagnóstico: qué se ve falso hoy

| Elemento | Qué delata que es CG | Causa técnica |
|---|---|---|
| **Llama** | Parece una pompa o un planeta: anillo azul nítido, disco durazno plano y capas que se leen como cáscaras separadas. | 4 esferas aditivas con Fresnel, DoubleSide (`flame3d.js:22-53`), sin HDR ni bloom. |
| **Resplandor** | Disco gris azulado que lava la imagen. | Sprite de canvas de 128 px usado como sustituto del bloom. |
| **Hollín** | Confeti de píxeles cuadrados que giran en bloque y desaparecen al extinguirse. | 900 `Points` sin textura, calculados en CPU. |
| **Gota** | Canica negra metálica en lugar de n-heptano. | `MeshStandardMaterial` 0x2a3142 con metalness 0.35. |
| **Ignitor** | Aro dorado grueso en lugar de un hilo al rojo. | Toro con emisión naranja que satura sin bloom. |
| **Agujas** | Facetas y codos esféricos; reflejan un cuarto gris que no existe. | Cilindros de 10-14 lados y `RoomEnvironment` genérico. |
| **Inserto perforado** | "Calcomanías" de anillos, bordes dentados, chapa sin grosor. | `alphaTest` 0.5 y aros pintados en el canvas. |
| **Cables / paquetes** | Rojo, azul y amarillo de juguete, con aristas vivas. | Tubos y `BoxGeometry` lisos de colores saturados. |
| **Ventanas** | Espejos negros. | Disco metal 1, sin Fresnel ni recubrimiento. |
| **Racks ISS** | Pósters planos con luz uniforme. | `PlaneGeometry` + `MeshLambertMaterial` + canvas de 512 px. Sin relieve, AO ni bisel. |
| **Iluminación** | Objetos que flotan, sin contacto. | Sin AO ni sombras y el mismo env map en los 4 escenarios. |
| **Cámaras científicas** | La misma escena atenuada con un filtro CSS. | `filter: blur/contrast/saturate` sobre todo el canvas (`lab3d.css:44-54`), que también afecta a los monitores. |
| **Monitores** | 3 renders completos extra por cuadro, sin aspecto de instrumento. | Viewport y scissor a resolución completa con el DPR actual. |

---

## 2. Stack recomendado

### Se adopta

| Pieza | Versión / URL | Licencia | Por qué |
|---|---|---|---|
| **three.js** (WebGLRenderer, WebGL2) | 0.186.1 fijada exacta. https://github.com/mrdoob/three.js | MIT | Es la base actual; no hay migración. |
| **postprocessing** (pmndrs) | 6.39.6, peer three ≥0.168 <0.188. https://github.com/pmndrs/postprocessing | Zlib | Bloom con mipmap blur, ToneMapping AgX, SMAA, Vignette y Noise, con efectos fusionados en pocos pases. Admite efectos GLSL propios, lo que sirve para el shader de sensor. |
| **Addons de three** | `RoundedBoxGeometry`, `BufferGeometryUtils.mergeGeometries`, `PMREMGenerator.fromScene` | MIT | Bisel, menos draw calls y reflejos coherentes, con 0 KB de assets. |
| **Ruido 3D horneado** | Port JS de simplex/gradiente (referencia: https://github.com/stegu/webgl-noise) → `Data3DTexture` | MIT | Una lectura de textura por paso en lugar de simplex calculado en la ALU. |
| **Texturas PBR CC0** (2-3 sets, 512-1K, WebP) | Poly Haven (`metal_plate_02`/`blue_metal_plate`), ambientCG (`Metal009/011`, `Fabric0xx`) | CC0 | Microrrelieve real en metal de rack, acero y tela CTB. Carga diferida con fallback procedural. |
| **N8AO** *(opcional, solo nivel alto)* | 2.0.1, `N8AOPostPass`. https://github.com/N8python/n8ao | ISC | AO de contacto. Va en la lista opcional, no en el núcleo. |

Antes de comprometer el peso, se mide `vite build` con `rollup-plugin-visualizer`. El chunk `flame3d` ya pesa unos 605 KB en bruto (155 KB gz).

### Se descarta (por ahora)

| Opción | Motivo |
|---|---|
| **WebGPURenderer + TSL** | No acepta `ShaderMaterial` ni `onBeforeCompile`, y hoy hay 9 shaders GLSL. pmndrs y N8AO no funcionan sobre él. Supondría 4-7 días de reescritura, y la API sigue cambiando (PostProcessing pasó a RenderPipeline). Queda para después del hackathon. |
| **EffectComposer de addons** | Encadena pases y cuesta más en GPU. No se mezcla con pmndrs. |
| **`transmission` de MeshPhysicalMaterial en la gota** | El RT de transmisión de three 0.186 solo dibuja objetos opacos: la llama (transparente y aditiva) no aparecería refractada. Además añade un pase extra por cada `render()`. Se sustituye por una gota analítica (3.2). |
| **RectAreaLight** | `RectAreaLightTexturesLib` añade unos 110 KB gz, no da sombras y es cara en móvil. Se usan emisivos con bloom más el env map capturado. |
| **KTX2/Basis** | El transcoder pesa unos 584 KB y no compensa con 2-3 sets. |
| **Blender → GLB del CIR, lightmaps, ProgressiveLightMap** | 3-4 días de trabajo, sin UV2 y con riesgo de inventar detalle. |
| **R3F, Babylon.js, PlayCanvas, Needle** | Reescritura total sin ganancia visual propia. |
| **three-fire, Shadertoy** | Solo como referencia de técnica. El código de Shadertoy es CC BY-NC-SA por defecto: no se copia. |
| **three.quarks, realism-effects, Gaussian splatting, three-gpu-pathtracer** | Peso alto para lo que aportan, proyecto abandonado, no hay captura del CIR, o exige three ≥0.187 y solo serviría para modo foto. |
| **Sombra de la llama** | Es una PointLight: cada actualización del cubemap son 6 renders extra. |

---

## 3. Mejoras por área

### 3.1 Llama volumétrica (protagonista)
**Archivos:** nuevo `app/src/render/flameVolume.js` (shader, LUT, ruido 3D) y `app/src/render/flame3d.js`.

> **Implementado el 6 nov, con un cambio respecto a este diseño.** No se integra por pasos: como el campo es radial, la integral a lo largo de cada rayo depende solo del parámetro de impacto b. Se precalcula en una LUT 1D por capa (CH\*, hollín, halo, llama fría), y cada píxel lee la LUT y el ruido 3D solo en los cruces con los cascarones. El resultado es exacto, sin bandas, y sale más barato que 8-16 pasos.
> - **1g:** se resuelve en espacio de elipsoide.
> - **Proxy:** un elipsoide de 32×16 en vez de una caja.
> - **Costo medido** en Intel UHD (ANGLE/D3D11) a 2400×1350:
>   - 1.9 ms a escala gota;
>   - 4.4 ms con la llama llenando la pantalla.
> - **Respaldo:** `?flameMode=legacy`.
>
> Lo que sigue describe el diseño original.

**Proxy:**
- Una caja escalada en Y según `g`, con el centro desplazado hacia +Y. En 1g cubre la pluma (hasta unos 2.6·rF) y el hollín ascendente (hasta rF·2.3).
- Intersección analítica de entrada y salida, con `t0 = max(0, tEntrada)` para soportar la cámara **dentro** del volumen (`zoomTo` permite dist = 7 mm).
- Cámara fuera: `FrontSide` + `depthTest`, de modo que lo que está delante de la llama la tapa. Cámara dentro: `BackSide` sin `depthTest`.
- Las agujas que atraviesan el volumen se ven detrás del gas emisivo, lo cual es aceptable.

**Integración barata:**
- Se aprovecha la simetría radial. El perfil T(r) y la absorción del hollín se integran con **8-12 pasos** (16 en el nivel alto).
- Cada paso hace una sola lectura de un `Data3DTexture` R8 de 64³ (32³ en el nivel bajo), generado en JS al arrancar.
- Salida temprana por radio analítico y por transmitancia < 0.02.
- Resolución completa; la media resolución queda como mejora opcional posterior.
- **Presupuesto: ≤ 4 ms en iGPU a escala gota**, medido antes del 9 de noviembre.

**Campos**, alimentados por los uniforms existentes (`rF, rD, soot, o2i, a, kindle, flash, heat, coolA, g`), sin tocar `model/flame.js` ni `lab.js`:
1. **Zona de reacción azul CH\*/C₂\***: cascarón gaussiano con **pico exacto en rF**, para que el HUD (`flame = 2·rF`) coincida con lo que se ve.
2. **Cascarón de hollín** en 0.75-0.86·rF, de modo que el hotspot `soot` (-0.78·rF) caiga encima.
   - Color: **LUT de cuerpo negro** (DataTexture 256×1, unos 1000-2400 K, compartida con el ignitor y la luz).
   - Absorción de Beer-Lambert.
3. **Llama fría**: emisión azul tenue y difusa, sin borde, con pulso lento.
4. **Gravedad**: dominio estirado hacia +Y y ruido advectado hacia arriba (parpadeo de unos 10-15 Hz). En µg queda esférica.

**Modos por `present()`** (uniform `uMode`):
- Color/libre: todo.
- HiBMS: solo la absorción del hollín, sin emisión.
- LLUV: solo la emisión CH\*/OH\*.

Las capas viejas y su código `UV_GREY`/`uColor` se eliminan solo cuando el volumen pase los criterios.

**Salida y luz:**
- HDR lineal (>1) para el bloom.
- Se mantiene un **sprite HDR con tamaño mínimo** en las escalas cámara y laboratorio (`cam.dist·0.045`), para que la llama no se pierda bajo el píxel.
- Las PointLight siguen siendo las mismas en número y con decay 0.8; nunca se añaden ni se quitan, para no forzar recompilaciones. El color sale de la LUT y la intensidad es proporcional a la emisión integrada.

**Hollín en partículas:**
- `ShaderMaterial` de puntos con sprite redondo suave, movimiento en GPU (semilla + `uTime`) y brillo por temperatura.
- **Fase post-extinción**: nube oscura que deriva lentamente, con alpha normal.

**Plan B:** el flag `flameMode=legacy` mantiene las capas actuales hasta que el volumen pase los criterios.

### 3.2 Gota
**Archivos:** `flameVolume.js` y `flame3d.js`.
- La gota se dibuja **analíticamente dentro del shader de la llama**:
  - intersección rayo-esfera con rD;
  - Fresnel de Schlick con reflejo del env map A (3.5);
  - refracción de Snell con n = 1.39 (n-heptano), continuando el raymarch por el rayo refractado. Así la llama se ve distorsionada a través de la gota.
- La malla actual se conserva solo para escribir profundidad (`colorWrite:false`) y para el `inkMat` de la silueta de HiBMS.
- La deformación se hace con `drop.scale` anisótropo: estirada en Z (eje de las agujas) mientras `needle<1`, y después una oscilación amortiguada de unos 3 ciclos. Sirve igual para los dos materiales, sin tocar shaders.

### 3.3 Cámara de combustión, agujas e ignitores
**Archivos:** `app/src/render/lab/chamber.js`, `kit.js` y nuevo `app/src/render/lab/materials.js`.
- **Agujas**:
  - `TubeGeometry` continua con 24 segmentos radiales, codos redondeados y punta cónica biselada;
  - `MeshPhysicalMaterial` de acero con `anisotropy` 0.6 y rayado mediante `bumpMap`/`roughnessMap`;
  - **reconstruir `mechMeshes` después de crear los materiales**, para que `silhouette()` siga funcionando.
- **Ignitores**:
  - hilo en hélice con `TubeGeometry` fina;
  - emisión HDR (>1) con el color de la LUT según `heat`;
  - enfriamiento exponencial de amarillo a rojo oscuro;
  - el tinte sobre la gota sale de la luz `warm` existente, sin luces nuevas.
- **Inserto perforado**:
  - se quitan los aros pintados;
  - `alphaMap` de mayor resolución con `bumpMap` del bisel de cada agujero;
  - segunda pared para dar grosor;
  - `alphaToCoverage` solo en el nivel alto con MSAA×4. En los demás niveles se mantiene `alphaTest`.
- **Ventanas**: `MeshPhysicalMaterial` con clearcoat, Fresnel del env map A e `iridescence` 0.2-0.3 (recubrimiento antirreflejo). Sin transmission.
- **Paquetes HiBMS/LLUV/IPSU/ILLUM**: `RoundedBoxGeometry` con radio de 3-5 mm, anodizado desaturado y etiquetas en `MeshStandard` con roughness alto. **No se añaden piezas no documentadas.**
- **Cables**: funda desaturada (blanco o gris), roughness alto y grosor revisado.
- **Draw calls**: `mergeGeometries` **solo dentro de cada grupo de visibilidad** (por instrumento, `cut`, `ext`, shell fijo) y nunca en `mech`. Pernos con `InstancedMesh`.

### 3.4 Texturas
**Archivo:** `app/src/render/lab/textures.js`.
- `make()` dibuja además un **canvas de altura**, que se pasa directo como `bumpMap`: el gradiente se calcula en GPU, sin Sobel en CPU ni worker. El `roughnessMap` sale de otro canal o canvas.
- Las texturas de datos usan `NoColorSpace`; solo el albedo es sRGB. La anisotropía se toma de `renderer.capabilities.getMaxAnisotropy()`.
- Ruido coherente (fbm) para mugre, huellas y desgaste en bordes, en lugar del speckle blanco.
- Resolución: 512 en nivel bajo y 1024 en medio y alto. Solo un frente de rack llega a 2048 en el nivel alto. Generación perezosa por escenario, en caché y medida con `performance.now()`.
- Los sets CC0 se usan como **detalle** mezclado con el albedo procedural, con repetición calculada a partir de los mm reales y desaturados (la ISS es limpia y mate).
- `kit.disposeTree` se amplía a `bumpMap`, `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap` y `envMap`.

### 3.5 Iluminación y entorno
**Archivos:** `flame3d.js` (`swapEnv`) y `environments.js`.

`RoomEnvironment` se sustituye por **dos capturas** con `PMREMGenerator.fromScene(scene, blur, near≈1, far≈20000)`. Se hacen en una `Scene` temporal con copias de hemi y sun, una vez por escenario:
- **A, interior**: `rig.shell` desde el origen. Se asigna como `material.envMap` a la mecánica, la gota analítica y las ventanas.
- **B, laboratorio**: `env.group` con los `cut` visibles, desde un punto fuera de la cámara. Va a `scene.environment`, para los racks. Las luminarias emisivas quedan horneadas en su reflejo.

Las dos se liberan en `swapEnv` y en `dispose()`.

**Luces:**
- El número de luces es fijo: las que sobran quedan con intensidad 0, no se eliminan.
- Sin sombras dinámicas. El contacto se resuelve con **decals oscuros de AO falseado** bajo las bridas y los cajones. N8AO queda en la lista opcional.

### 3.6 Racks y escenarios
**Archivo:** `app/src/render/lab/environments.js`.
- **ISS / hábitat** (prioridad):
  - `MeshLambertMaterial` pasa a `MeshStandardMaterial`;
  - rack "semi-3D": cajones y paneles `RoundedBox` de 40-120 mm de profundidad, con la disposición que ya dibuja `rackFace()`, y el canvas como albedo y etiquetas;
  - bolsas CTB con el set CC0 de tela;
  - luminarias emisivas >1 que florecen con el bloom.
- **Recorte al orbitar**: se conservan los planos de una cara y los grupos `cut`. Las piezas con volumen nuevas entran en el mismo grupo `cut`.
- Las etiquetas y fondos casi blancos en `MeshBasic` (`environments.js:105,112`, placas) se limitan a < 0.8 en lineal o se pasan a `MeshStandard`, para que no florezcan.
- **CO₂, ZGF, Tierra/Luna**: lista opcional (sección 4).

> **Implementado el 7 nov (F3, secciones 3.3 a 3.6).** Todo es procedural: no se descargan imágenes ni sets CC0.
> - **Materiales** (`lab/surface.js`, nuevo): ruido fbm periódico calculado una vez. Con él se generan albedo, rugosidad y relieve (`bumpMap`) para:
>   - acero y aluminio cepillados;
>   - pintura, anodizado y fundas de cable;
>   - mangueras corrugadas y tejido de las bolsas;
>   - vidrio `MeshPhysical` con capa transparente y tornasol.
>
>   Las UV de varillas y mangueras van a escala real (100 mm por repetición). En el nivel bajo no hay relieve.
> - **Racks semi-3D** (`lab/rack.js`, nuevo):
>   - casilleros, cajones de aviónica, estaciones y bolsas CTB abombadas como cajas redondeadas de 8 a 230 mm de fondo;
>   - una sola geometría por diseño, con proyección plana del dibujo;
>   - sombra de contacto horneada bajo cada pieza;
>   - LED y pantallas en un mapa de emisión.
>
>   Cada pared se oculta cuando la cámara queda detrás. Donde hay ventana (WORF, hábitat), el rack queda plano.
> - **Cámara de combustión:**
>   - inserto perforado con dos paredes y bisel en el relieve, en vez de aros pintados (alpha-to-coverage solo en nivel alto);
>   - mazos de cables de 3 a 6 hilos con bridas en lugar de las mangueras rojas y azules;
>   - cajas redondeadas y ventanas de vidrio físico.
> - **Entorno:** dos capturas PMREM por escenario (dentro de la cámara y en el módulo) en lugar de `RoomEnvironment`. Las luminarias y los LED van por encima de 1, para que florezcan con el bloom.
> - **Coste.** Medido con `readPixels` sincronizado a 1600×900 en Intel UHD, en el nivel medio:
>
>   | Vista | Coste añadido |
>   |---|---|
>   | Gota | +2 ms |
>   | Cámara | +2 ms |
>   | Laboratorio | +6 ms |
>
>   El cuadro total queda en unos 30 ms. Ya antes de F3, el post-procesado (≈15 ms) y la iluminación por entorno sobre superficies a pantalla completa eran lo más caro: candidatos para F4.
>
>   El chunk 3D pasa de 163 a 172 KB gz. Generar un escenario lleva unos 110 ms de CPU.

### 3.7 Post-procesado
**Archivo nuevo:** `app/src/render/lab/post.js`. Punto de inserción: `draw()` (`flame3d.js:490-528`).

**Configuración del renderer y del composer:**
- `renderer.toneMapping = NoToneMapping` y `antialias:false`.
- `EffectComposer` con `HalfFloatType` si existe `EXT_color_buffer_float`/`half_float` (comprobado con `renderer.extensions.has`). En el nivel bajo, o si no hay soporte, `UnsignedByteType` sin MSAA.

**Pases:**
- **Pase A**: Bloom (mipmap blur, **luminanceThreshold 1.0-1.2**: solo la llama, el hilo, los LEDs y la lámpara superan 1), ToneMapping **AgX** y exposición (una sola vez), Vignette y Noise leve.
- **Pase B**: SMAA en los niveles bajo y medio (`multisampling 0`). En el nivel alto, MSAA×4, solo si la medición lo permite.

La aberración cromática va solo dentro del shader de sensor. DOF queda fuera de alcance.

**Orden fijo en `draw()`:**
1. `composer.render()` de la vista principal.
2. Monitores desde sus RT con quads que aplican **su propio tone mapping y conversión a sRGB**, con `autoClear=false` y limpieza explícita de cada scissor.
3. Restaurar el estado.

**Ajustes asociados:**
- `composer.setSize`/`setPixelRatio` en `resize()`, `lab-max` y fullscreen.
- `far` ajustado a la escala (con `F.inside`, far ≈ 800) para mejorar la precisión de profundidad.
- **Recalibración global** al pasar de ACES a AgX: racks, metales y llama, contra las 6 poses de referencia.

**CSS** (`lab3d.css`):
- Quitar solo los `filter:` del canvas y el grano de los feeds.
- **Mantener la alarma roja de CO₂** de `.lab-fx`.
- Quitar el `box-shadow` de `.lab-frame` cuando la viñeta del sensor esté activa.

### 3.8 Cámaras científicas y monitores
**Archivos:** nuevo `app/src/render/lab/sensor.js`, `flame3d.js` y `flame3dView.js`.

**Vista de instrumento principal:**
- Se pasa `fcam` al RenderPass con aspect = W/H a pantalla completa.
- El efecto de sensor **enmascara fuera del rectángulo del sensor** (uniform con el rect). Así desaparece el viewport parcial.
- `F.feed {x,y,w,h,pxmm}` se sigue calculando igual para `.lab-frame` y la barra de escala.

**Un solo efecto de sensor con 3 presets:** ganancia, curva de respuesta, monocromo o tinte, ruido de lectura, viñeta óptica y downsample a la resolución nativa.
- **Color**: saturación del hollín hacia amarillo-blanco y leve aberración cromática.
- **HiBMS**: fondo retroiluminado con gradiente y speckle, la gota en silueta (`inkMat`) y el hollín como sombra gris (modo de absorción del volumen).
- **LLUV**: solo la capa de emisión (`camera.layers` + `uMode`), monocromo con tinte de fósforo y ruido dependiente de la ganancia.
- Persistencia de fósforo y borde de difracción quedan en la lista opcional.

**Monitores:** RT de 256×192 a 12-15 fps, con el mismo efecto. Apagados en el nivel bajo.

**UI:** rótulo "emulación ilustrativa del instrumento".

> **Implementado el 7 nov (F4).** Datos de las cámaras tomados del informe de FLEX (NASA/TP-2015-216046, Dietrich et al., sec. 2.2, en `data/ntrs/flex/20150023456.txt`).
> - **`lab/sensor.js`** (nuevo): un solo GLSL con tres presets y su resolución nativa.
>   - **Color** (640×480): lo brillante satura por canal y el hollín pasa de naranja a amarillo-blanco. Lleva aberración cromática lateral, viñeta cos⁴, ruido de lectura y de disparo, y el negro algo levantado.
>   - **HiBMS** (1024×1024, 12 bits): monocromo. El fondo retroiluminado no es uniforme, como dice el informe, y la óptica tiene moteado y polvo fijos. La retroiluminación es un diodo láser de 650-660 nm, no infrarroja: se corrigieron los textos de `model/lab.js`.
>   - **LLUV** (512×512, binning 2×2 de un CCD de 1024): intensificador con el círculo del tubo y el tinte del fósforo. La ganancia sube con llamas débiles y con ella el ruido; hay destellos de un solo píxel.
>
>   El ruido cambia a 30 cuadros por segundo, como las cámaras reales.
> - **Píxel nativo y zoom digital:** la imagen se muestrea en la rejilla nativa del sensor, con cuatro lecturas por píxel. Con el zoom digital se ven los píxeles, y crecen también la viñeta, el polvo y el círculo del intensificador. Por debajo de 1× el sensor queda como a 1×.
> - **Vista principal:** el sensor es un tercer pase (`post.js`) y enmascara fuera de su rectángulo. Así desaparecen las bandas negras recortadas a mano. En las vistas de cámara se quitan la viñeta y el grano genéricos del pase A y B. SMAA se omite cuando el píxel nativo es mayor que el de pantalla (color, LLUV), porque el promedio de cuatro lecturas ya suaviza los bordes.
> - **Monitores:** cada cámara se dibuja en su render target (HDR, ≤192 px de alto). Se refresca la más atrasada, como mucho una por cuadro y a ≤15 fps cada una. Se copian al lienzo con el mismo sensor y AgX. En el nivel bajo siguen apagados. `?legacy3d` conserva el camino de antes.
> - **CSS:** con post-procesado se quitan la sombra de `.lab-frame` y el grano y la viñeta de `.lab-fx` en las vistas de cámara. La alarma de CO₂ se mantiene.
> - **Coste.** Medido con `readPixels` sincronizado a 1600×900 en Intel UHD, nivel medio, comparando contra el camino anterior en la misma sesión:
>
>   | Vista | Antes | Ahora |
>   |---|---|---|
>   | Color | 45.8 ms | 40.5 ms |
>   | LLUV | 23.0 ms | 14.7 ms |
>   | HiBMS | 24.5 ms | 24.5 ms |
>   | Libre, con monitores | 41.0 ms | ≈41.8 ms |
>
>   El chunk 3D pasa de 172.0 a 175.1 KB gz y el de post-procesado de 74.7 a 75.2 KB.
> - **Precompilación:** los programas de las cámaras se compilan durante la carga, tanto los de la vista principal como el de los monitores. También se dibuja un cuadro de prueba con el sensor y otro sin él. El primer cambio a una vista de cámara ya no da tirones: su primer cuadro cuesta lo mismo que los siguientes.
> - **Revisión adversarial** con 3 revisores y un verificador. Se corrigieron tres fallos:
>   - `pow` con base negativa en el polvo de la HiBMS, que da NaN (mancha negra) en macOS y en algunos drivers;
>   - ganancia de la llama en los monitores, que ahora pasan por un búfer que se comprime después, como la vista principal;
>   - compilación del sensor en el primer uso.
>
>   Persistencia de fósforo y borde de difracción siguen en la lista opcional.

### 3.9 Infraestructura transversal
**Archivos:** nuevo `app/src/render/lab/quality.js`, `flame3d.js` y `flame3dView.js`.
- **Precompilación**: `renderer.compileAsync(scene, camera)` y también con `fcam`, detrás de `#v3-msg`, al montar y en cada `swapEnv`.
- **Depuración**:
  - `?debug` muestra fps, calls y memoria, con `renderer.info.autoReset=false` y `info.reset()` al inicio de cada cuadro;
  - `?pose=…` fija las 6 poses de captura.
- **Rollback**: `?legacy3d` conserva la ruta de render actual hasta el 13 de noviembre.
- **`dispose()`** libera el composer y sus RT, la LUT, el `Data3DTexture`, los env maps A y B, el PMREM y los RT de los monitores.
- **CREDITS**: archivo con cada asset CC0 y de NASA (URL y fecha), sin usar la insignia de NASA.

---

## 4. Fases priorizadas

**Tres entregables seguros:**
1. AgX + bloom + monitores a RT.
2. Llama nueva.
3. Materiales de racks y agujas.

| Fase | Fecha | Días | Contenido | Por qué en este orden |
|---|---|---|---|---|
| **F0. Base y medición** | 6 nov (mañana) | 0.5 | 3D por defecto + fallback + aviso. Flags `?legacy3d`, `flameMode`, `?debug`, `?pose`. Capturas "antes" de las 6 poses. `vite build` + visualizer. FPS de referencia en la iGPU y el Android de prueba. | Sin línea base no hay criterios verificables. |
| **F1. Pipeline HDR (entregable 1)** | 6-7 nov | 1.5 | **Prototipo de riesgo primero**: composer + vista de instrumento con máscara + monitores a RT. Luego `post.js` (pase A/B, AgX, bloom, detección de HalfFloat), limpieza de CSS, recalibración global, ignitor HDR con LUT, niveles manuales + `pointer:coarse`, `compileAsync`, `webglcontextlost`. | Es el mayor salto percibido y la tubería HDR que necesita todo lo demás. |
| **F2. Llama (entregable 2)** | 8-9 nov | 2 | `flameVolume.js`: proxy, ruido 3D, LUT, CH\*, hollín, llama fría, `g`, modos por `present()`, gota analítica, coherencia con el HUD, partículas en GPU y nube post-extinción. **Medir ≤ 4 ms en iGPU el 9.** | Protagonista del pitch. Si no pasa los criterios el 9, se activa `flameMode=legacy` con las capas actuales bajo el nuevo bloom. |
| **F3. Materiales (entregable 3)** | 10-11 nov (mediodía) | 1.5 | Env maps A/B, `bumpMap`/roughness desde canvas, agujas, inserto, ventanas, paquetes, cables, racks ISS semi-3D, 2-3 sets CC0, `disposeTree`, merges por grupo y decals de AO. | Mucho volumen de trabajo con riesgo bajo. Con 2 personas va en paralelo a F2. |
| **F4. Sensor** | 11 nov (tarde) | 0.5 | `sensor.js` con 3 presets en la vista principal y en los monitores. | Refuerza el relato científico. |
| **Pitch / QA / congelación** | 12-13 nov | 2 | Pruebas en iGPU, Android e iOS. Capturas "después". Video, pitch y página. Tag y respaldo. | Reservado; no se usa para gráficos salvo medio día de retraso. |

**Lista opcional** (solo si sobra tiempo), en este orden:
1. N8AO en el nivel alto.
2. Persistencia de LLUV y difracción de HiBMS.
3. Pozo ZGF iluminado.
4. Humo de CO₂ en GPU.
5. Tierra (Blue Marble) y Luna (LROC) con shader de esfera ortográfica.
6. Inercia orbital y colisión de hotspots con el HUD.
7. Media resolución de la llama.

**Recorte si hay retraso**, en este orden: sets CC0 (queda solo lo procedural) → sensor (los monitores quedan como RT sin shader) → racks semi-3D (queda el bump plano). F1 no se recorta. La llama tiene su plan B (`legacy`).

---

## 5. Presupuesto de rendimiento y peso

### Peso (cifras a confirmar con `vite build` el 6 de noviembre)
| Concepto | Hoy | Objetivo |
|---|---|---|
| Chunk `flame3d` | ~155 KB gz | + ≤ 100 KB gz (postprocessing con tree-shaking más código propio; N8AO aparte si se activa) |
| Texturas CC0 WebP (2-3 sets, 512-1K) | 0 | ≤ 1.5 MB, **diferidas** después del primer cuadro |
| `dist` total | ~2 MB | ≤ 4 MB; el primer cuadro 3D no espera a la red |

### VRAM
Referencias: 1K RGBA con mips ≈ 5.6 MB; 2048 ≈ 22 MB.

| | Bajo | Medio | Alto |
|---|---|---|---|
| Objetivo | ≤ 64 MB | ≤ 100 MB | ≤ 150 MB |

Se mide con `renderer.info.memory` y el perfilador de Chrome.

### Niveles de calidad
- **Selección al arrancar:** `pointer:coarse` → bajo; en otro caso, medio. Después de la intro se hace **una** medición de unos 60 cuadros a escala gota, con histéresis, que puede subir a alto o bajar a bajo. También se puede forzar a mano en la UI.
- **En caliente solo cambian** el DPR y la resolución del composer: no recompilan nada.

| | Bajo (móvil) | Medio (laptop iGPU) | Alto |
|---|---|---|---|
| DPR | 1 | 1.25-1.5 | ≤ 2 |
| Framebuffer | UnsignedByte | HalfFloat | HalfFloat |
| Llama | 8 pasos, ruido 32³ | 12 pasos, 64³ | 16 pasos, 64³ |
| AA | SMAA | SMAA | MSAA×4 (si se mide bien) + alphaToCoverage |
| Bloom | media resolución | mipmap | mipmap |
| Monitores | apagados | 256 px a 12-15 fps | 256 px a 15 fps |
| Texturas | 512 | 1024 | 1024 (+1 rack a 2048) |
| N8AO (opcional) | no | no | sí, a media resolución |

### FPS objetivo
- Alto (GPU dedicada): ≥ 60.
- Medio (iGPU, 1080p): ≥ 30 estables.
- Bajo (Android de gama media o iPhone reciente): ≥ 30.
- Llama: ≤ 4 ms en iGPU a escala gota.

### Fallback
- Sin WebGL2 o con error al crear el contexto: 2D automático con aviso.
- Sin float color buffer: framebuffer LDR.
- Si fallan las texturas: se queda el procedural.
- Si se pierde el contexto: aviso, con opción de reconstruir o volver a 2D.
- Si la nueva pipeline falla en el equipo de la demo: `?legacy3d`.

---

## 6. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| El composer rompe el feed letterbox o los monitores | Feed a pantalla completa con máscara del sensor. Monitores en RT con su propio tone mapping. Orden fijo en `draw()`. Prototipo el 6 de noviembre. |
| Fill-rate de la llama a escala gota | Simetría radial, 8-16 pasos, ruido en textura 3D, salida temprana y medición ≤ 4 ms el 9. Plan B `flameMode=legacy`. |
| La gota no refracta la llama | Gota analítica dentro del shader del volumen (sin `transmission`). |
| Env map recortado o incoherente | `near≈1`/`far≈20000`, copias de las luces y dos capturas (interior y laboratorio). |
| El bloom lava etiquetas y fondos | Umbral ≥ 1.0 y blancos `MeshBasic` < 0.8 o en `MeshStandard`. |
| Cambio de color global al pasar a AgX | Recalibración contra las 6 poses en F1. |
| Tirones por compilación de shaders | `compileAsync` detrás de `#v3-msg`, número fijo de luces y sin cambiar de nivel en caliente. |
| HalfFloat o MSAA no soportados en móvil | Detección de extensiones, framebuffer LDR y SMAA. |
| `mergeGeometries` rompe el corte o la silueta | Fusionar solo por grupo de visibilidad, nunca `mech`, y reconstruir `mechMeshes`. |
| Bump/normal mal decodificados | `NoColorSpace` en los mapas de datos. |
| Fugas de memoria al cambiar de escenario | `disposeTree` ampliado y `dispose()` completo. Verificar con `renderer.info.memory`. |
| VRAM en iOS (pérdida de contexto) | Tabla de VRAM por nivel, 512 px en el nivel bajo y prueba en un iPhone real. |
| Desfase entre la llama y el HUD | Pico CH\* en rF y hollín en 0.75-0.86·rF, comprobados en el feed con la barra de escala. |
| Tiempo (9 días, otras entregas) | Gráficos limitados al 6-11. El 12-13 es intocable. Recorte ordenado y lista opcional. |
| Honestidad científica | Esférica en µg y alargada solo con g > 0. Rótulos de "recreación ilustrativa" y "emulación del instrumento". Sin hardware no documentado. Colores calibrados con fotos NASA de dominio público del CIR/MDCA. CREDITS sin insignia. |

---

## 7. Criterios de aceptación (verificables)

1. **Capturas antes/después** de 6 poses fijas (`?pose=`), con el mismo tamaño de ventana:
   - llama a escala gota;
   - ignición;
   - rack ISS;
   - agujas en despliegue;
   - HiBMS;
   - LLUV.
2. **Llama:**
   - en µg, proporción alto/ancho de la silueta ≤ 1.05;
   - en 1g, ≥ 1.5, sin recortes de la pluma;
   - el borde azul y el cascarón naranja se distinguen en la captura;
   - sin anillos de contorno duro;
   - el diámetro CH\* medido en el feed coincide con `flame = 2·rF` del HUD (±10 %).
3. **Gota:** muestra reflejo y Fresnel, y la llama se ve refractada y distorsionada a través de ella.
4. **Ignitor:** el color cambia de forma visible entre el calentamiento y el enfriamiento, y florece con el bloom. Las etiquetas blancas no florecen.
5. **Racks y agujas:** al orbitar, un reflejo especular recorre los paneles y se ve relieve de bump. Las agujas no muestran facetas a escala gota.
6. **Instrumentos:**
   - HiBMS muestra fondo con speckle y la gota en silueta;
   - LLUV muestra solo la emisión con ruido de ganancia;
   - no queda ningún `filter:` CSS sobre el canvas;
   - la alarma de CO₂ sigue funcionando.
7. **Rendimiento:**
   - ≥ 30 fps durante 60 s en la iGPU de prueba (nivel medio) y en el Android de prueba (nivel bajo);
   - ≥ 60 fps en el nivel alto;
   - llama ≤ 4 ms en iGPU;
   - medido con `?debug`.
8. **Memoria:** tras 5 cambios de escenario, `renderer.info.memory.textures` y `geometries` vuelven al valor base (±5 %). La VRAM queda dentro de la tabla por nivel.
9. **Peso:**
   - `vite build`: chunk `flame3d` + ≤ 100 KB gz;
   - `dist` ≤ 4 MB;
   - el primer cuadro 3D aparece sin esperar a las texturas diferidas.
10. **Por defecto y fallback:**
    - el Simulador abre en 3D aunque el hash diga `/2d`, salvo que el usuario haya elegido 2D con un clic;
    - con WebGL desactivado, abre en 2D con aviso;
    - tras `webglcontextlost`, aparece el aviso y la recuperación funciona;
    - `?legacy3d` reproduce el render actual.
---

## 8. Resultados de QA (7 nov, laptop con Intel UHD)

Lo que se añadió en esta fase:
- **`?pose=drop|ignition|rack|needles|hibms|lluv`**: las 6 poses fijas, en pausa y sin giro. La interfaz muestra la vista de la pose.
- **Densidad de píxeles adaptativa** (`createAdaptive` en `quality.js`), solo sin `?q`:
  - mide la **media** de los intervalos entre cuadros y baja un escalón (2 → … → 0.75) si pasa de 36 ms en dos ventanas seguidas de 60 cuadros. Así no baja sin motivo con el navegador limitado a 30 Hz;
  - con la GPU saturada, el navegador intercala cuadros de 17 ms con otros de 60-90 ms, y por eso no sirve la mediana;
  - sube una sola vez si sobra margen y nunca vuelve a subir después de bajar.
- **Sin WebGL 2** (o con `?nowebgl`), la pestaña Simulador abre las gráficas 2D con un aviso: `ok()`/`why` en `mountParts`.
- **LLUV en 1g**: abre algo más el campo para no cortar la pluma.

| # | Criterio | Resultado |
|---|---|---|
| 1 | Capturas de las 6 poses | Hechas con `?pose=` a 1600×900. La pose de ignición va en `pre = 3.0`, con el hilo casi al máximo. |
| 2 | Llama | µg: alto/ancho = 1.00 en LLUV (pasa ≤ 1.05). 1g: el elipsoide es 1.84:1; en la vista libre (24° de elevación) se proyecta a ≈1.73 (pasa ≥ 1.5). En LLUV/HiBMS, que miran desde 45°, se ve a ≈1.48, que es lo correcto para ese ángulo. El diámetro CH\* medido en la imagen a color queda a −1.2 % de `2·rF` del HUD (pasa ±10 %). |
| 3 | Gota | Tiene reflejo y Fresnel, y la llama se ve atenuada a través de ella. **No hay refracción con distorsión.** |
| 4 | Ignitor | El hilo brilla con color de cuerpo negro y florece con el bloom. |
| 5 | Racks y agujas | Verificado en F3. |
| 6 | Instrumentos | HiBMS con fondo no uniforme, moteado y gota en silueta. LLUV solo con emisión y ruido de ganancia. Ningún `filter:` en el lienzo. La alarma de CO₂ funciona. |
| 7 | Rendimiento | A 1920×1080, nivel medio, la adaptación baja a 0.85 y la vista de la gota (la más cara) queda en 33 fps. Con el umbral anterior (34 ms, una sola ventana) bajaba hasta 0.75 y daba 34-44 fps (gota 33.7, laboratorio 41, color 43.6). La llama cuesta ≈1.3 ms (pasa ≤ 4 ms). Falta medir en Android y en GPU dedicada. |
| 8 | Memoria | Tras 6 cambios de escenario, 267 geometrías y 115 texturas, igual que al inicio. |
| 9 | Peso | `dist` 2.3 MB (pasa ≤ 4 MB). Chunks 3D +95.6 KB gz sobre la base (flame3d 175.6 + post 75.2; pasa ≤ +100). |
| 10 | Fallback | `?nowebgl` abre 2D con aviso. Tras `loseContext()` aparece el aviso y «Reintentar» reconstruye la escena. `?legacy3d` dibuja como antes. |

**De dónde sale el coste** (vista de la gota, 1080p, densidad 1):
- La escena cuesta unos 20 ms. De eso, ≈8 ms son los reflejos del entorno (PMREM) en todas las superficies, ≈3 ms las luces puntuales y ≈1.5 ms los mapas de relieve y rugosidad.
- El post-procesado añade unos 11 ms.
- No hay un recorte barato sin perder calidad. Por eso se adapta la densidad de píxeles.

**Pendiente para las personas:** pruebas en Android e iOS, video, pitch, página, tag y respaldo (commit único).
