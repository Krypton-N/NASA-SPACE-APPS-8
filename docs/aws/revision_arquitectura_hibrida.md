# Revisión: ¿corre la app en la arquitectura híbrida (EC2 Graviton + Lambda NLI + Bedrock)?

**Fecha:** 14 nov 2026 · **Código revisado:** rama `integracion-final`, commit `8a7a4e2`
(copia de trabajo en `flame_Infra/`, idéntica al proyecto original).
**Documentos revisados:** *Flame in Freefall — Arquitectura híbrida* v1.0 (Word) y
*SPEC — Migración a arquitectura híbrida* v1.1 (Markdown), de Rodrigo, generados con Amazon Q.

Convenciones usadas en todo el documento:

- **[H] Hecho verificado en el repo:** lo leí en el código y cito el archivo.
- **[M] Dato medido:** con fecha y origen. “Hoy” significa una medición de esta revisión.
- **[S] Suposición:** no lo pude comprobar desde el repo. Falta medirlo o lo debe confirmar Rodrigo.

---

## 0. Veredicto en corto

1. **La app sí puede correr en esta arquitectura.** El reparto encaja con el motor: EC2 con FastAPI
   de un solo proceso, Caddy sirviendo el frontend, Bedrock por IAM Role y NLI fuera de la EC2. No
   hay paquetes sin soporte ARM64 y el estado en memoria se queda en la EC2, que es donde debe estar.
2. **El punto central del SPEC no coincide con el código.** El SPEC supone que el NLI recibe
   “una afirmación con N premisas”, que las afirmaciones son independientes y que se pueden verificar
   todas en paralelo sin cambiar veredictos. En el código:
   - el NLI se llama **por pares (premisa, hipótesis)**, decenas de veces por afirmación;
   - esas llamadas están **entrelazadas con reglas deterministas** (números, modalidad, alcance,
     equivalencia inversa);
   - las afirmaciones **dependen unas de otras**: antecedentes, referentes y un presupuesto compartido
     de 96 alineaciones.

   Por eso la Lambda con contrato “1 afirmación → 1 veredicto” y `nli_core.py` como lo describe el
   SPEC **no se pueden hacer sin reescribir la verificación**, y eso pondría en riesgo los veredictos
   (§3).
3. **Hay un camino equivalente que sí conserva los veredictos** (§6):
   - una Lambda que ejecuta **el mismo `LocalEntailment._infer` de hoy, sin copiar ni mover código**;
   - un `RemoteEntailment` en el servidor con la misma interfaz `check()`;
   - una **precarga en paralelo** del bucle de modalidad, que hoy revisa hasta 64 frases por
     afirmación una por una.

   Con eso se logra lo que buscaba la propuesta: EC2 pequeña, CPU pesada pagada por segundo y
   verificación en paralelo donde el código lo permite.
4. **Antes de construir nada, hay que medir cuánto del tiempo es NLI.** El servidor ya trae esa
   medición: `serve_scientific_console.py --diagnostics` registra `nli_seconds` por pregunta. Si el NLI
   no domina, la Lambda no compensa y lo mejor es una sola EC2 sin burst (§8).

---

## 1. Qué propone la arquitectura híbrida (resumen de los dos documentos)

- **Qué corre dónde:**
  - **Frontend estático** (Vite + three.js): lo sirve **Caddy** en la EC2. El 3D corre en el
    navegador del visitante.
  - **API FastAPI + Uvicorn** (1 worker, `127.0.0.1:8765`, sesiones en memoria, FTS5, vectores, grafo
    RDF y registros PSI): corre en una **EC2 `t4g.large`** (Graviton ARM64, 2 vCPU, 8 GB, Ubuntu
    24.04, gp3 de 30 GB, systemd).
  - **Verificador NLI** (mDeBERTa ONNX): pasa a una **AWS Lambda `flame-nli-verifier`** con imagen de
    contenedor ARM64, 6144 MB, timeout de 120 s y una invocación por afirmación, **todas en
    paralelo**. Si la Lambda falla, cada afirmación se verifica con el NLI local como respaldo.
  - **LLM:** **Amazon Bedrock** (Converse API, IAM Role, por defecto Nemotron 3 Super).
  - **Embeddings:** API de **NVIDIA**.
- **Servicios AWS:** EC2, Lambda, ECR (imagen de ~2 GB), Bedrock, Route 53 + Elastic IP, Security
  Group, CloudWatch (alarmas de errores, throttles y duración, más SNS), Budgets ($130), SAM para
  desplegar e IAM.
- **Qué busca ahorrar:** no pagar una EC2 grande 24/7 (estiman ~$111–180 hasta el 4 dic). Proponen
  una `t4g.large` (~$33) más Lambda ($0–5) y estiman un total de **~$43–51 de $130**. Además esperan
  bajar la latencia de 2–3 min a **≤ 70 s (p50)**, sin Provisioned Concurrency, con warm-up propio.
- **Diferencias entre los dos documentos** (manda el SPEC v1.1):
  - `NLI_BACKEND` vale `local` por defecto en el código.
  - La concurrencia reservada depende de la cuota de la cuenta.
  - El warm-up lo hace FastAPI y no EventBridge.
  - El Word decía que el modelo se carga “fuera del handler”; el SPEC lo carga de forma perezosa por
    el límite de 10 s de INIT.

---

## 2. Datos de partida

| Dato | Valor | Tipo |
|---|---|---|
| Proceso de la API | `research/scripts/serve_scientific_console.py`, Uvicorn en `127.0.0.1:8765`, 1 worker | [H] (línea `uvicorn.run(... host="127.0.0.1")`) |
| Carriles | `read` y `conversation`, cada uno con un `ThreadPoolExecutor(max_workers=1)` y **su propio servicio** cargado; el chat va en serie con `conversation_slot`; 503 con ≥ 8 operaciones activas; lectura 503 con ≥ 16 | [H] `research/src/nasa_fire_ai/api.py:260-376` |
| El chat es síncrono | `svc.chat(request)` corre en un hilo del executor y todo el pipeline de verificación es síncrono | [H] `api.py:290, 338` |
| Endpoints de salud | Ya existen `GET /api/v1/health` y `GET /api/v1/readiness` | [H] `api.py:434, 474` |
| RAM con todo cargado | ~3.3 GB, de ellos ~1.1 GB del modelo NLI | [M] sesión anterior |
| Arranque con precalentamiento | ~19 s (`NASA_WARMUP=1`) | [M] sesión anterior |
| Latencia por pregunta | 40–130 s según el número de afirmaciones; el LLM aporta 8–25 s | [M] sesión anterior |
| CPU por afirmación verificada | ~5.5 s con 4 hilos (laptop x86, 20 vCPU) | [M] sesión anterior |
| **Tiempo de un par NLI** | 1 hilo: 115 / 363 / 1126 ms; 2 hilos: 87 / 204 / 726 ms; 4 hilos: 59 / 155 / 503 ms (pares de 60 / 193 / 498 tokens; mediana de 5) | [M] hoy, laptop x86, onnxruntime 1.31.1 |
| Carga del modelo ONNX desde SSD | 2.4 s | [M] hoy |
| Embeddings NVIDIA | mediana 0.49 s, máximo 0.65 s; timeout de 10 s | [M] comentario en `api.py:165` |
| Wheels ARM64 | **Ningún** paquete de `research/uv.lock` carece de wheel `manylinux aarch64` para cp312 ni de wheel puro | [M] hoy, revisión de `uv.lock` |
| Versiones fijadas | onnxruntime 1.31.1, tokenizers 0.23.3, numpy 2.5.3, snowballstemmer 3.1.1, boto3 1.44.3, rdflib 7.6.0, fastapi 0.162.0, uvicorn 0.54.0; Python ≥ 3.12 (local: 3.12.11) | [H] `research/uv.lock` |

---

## 3. Hallazgo central: cómo se usa hoy el NLI

Esto responde de una vez la Fase 0 del SPEC (`docs/nli_discovery.md`).

1. **Ubicación y firma** [H]:
   - La clase es `LocalEntailment` en `research/src/nasa_fire_ai/services/semantic_support.py:20-110`.
   - La interfaz pública es `check(premise, hypothesis) -> dict`. Usa una caché LRU de 2048 pares y
     después llama a `_check_uncached`.
   - `_check_uncached` llama a `_infer` (modelo) y a `_changed_terms`, una guarda léxica con Snowball
     que puede anular un “supported”.
   - **No existe** una función “afirmación + N premisas → veredicto”.
2. **Quién la llama** [H]. Todas las llamadas son síncronas y pasan por el mismo objeto
   `entailment`:
   - `verify_paraphrase` en `semantic_support.py`:
     - l. 952 y 1004: verificación principal;
     - l. 1028-1031: **bucle de modalidad**, hasta **64 frases** de la fuente contra la hipótesis.
       Son independientes entre sí y no hay `break`;
     - l. 1101-1103: ausencias documentales, con verificación inversa y `break`;
     - l. 1139: remedios, hasta 24 frases, con `break`;
     - l. 1160: alcance.
   - `conversation.py`:
     - l. 1468 y 1474: relevancia;
     - l. 2616 y 2638-2639: equivalencia en ambos sentidos;
     - l. 2735 y 2814.
   - `claim_verification.py:110`: verificación inversa.
   - `structured_alignment.py:111`.
3. **Tokenizer y ventana** [H]:
   - Usa `tokenizers` 0.23.3 (`Tokenizer.from_file`) y `encode(premise, hypothesis)`.
   - **No trunca ni trocea**: si el par pasa de 512 tokens, devuelve `supported: False`. Lo hace a
     propósito: *“Never silently truncate”*.
4. **Salida** [H]:
   - Aplica softmax a los logits y toma el orden de etiquetas de `config.json["id2label"]`.
   - `supported = P(entailment) ≥ 0.92` y además que no haya sustituciones de términos.
   - Cuando la premisa y la hipótesis son idénticas, hay un atajo determinista que no llama al modelo.
   - La “agregación entre premisas” no está en el modelo: está repartida en las reglas de
     `verify_paraphrase` y de `conversation.py`.
5. **Rutas, hilos y RAM** [H]:
   - La ruta del modelo viene de `NASA_NLI_DIRECTORY`; el servidor la fija por defecto en
     `research/data/index/models/nasa-nli`.
   - Los hilos vienen de `NASA_NLI_THREADS`, o vCPU − 1 con un máximo de 8.
   - El modelo se carga al construir el servicio del carril `conversation`. El carril `read` es
     `readonly` y no lo carga.
   - Ocupa ~1.1 GB, con hashes en `models/nasa-nli/manifest.json`. **Ya hay huella del modelo**, así
     que no hace falta un archivo `VERSION`.
6. **Las afirmaciones no son independientes** [H] (`conversation.py:2172-2240` y `:1106-1339`):
   - `reference_predecessor` exige que la afirmación anterior **ya** esté verificada
     (`verified_statement_indices`).
   - `referents` se arrastra de una afirmación a la siguiente.
   - Hay un **presupuesto compartido** `max_alignment_checks=96` (`self._alignment_checks`), así que
     el orden decide qué afirmación se queda sin realineaciones.
   - Hay cachés de instancia (`_document_section_cache`, `_documentary_reexamination_pool`).

   **Paralelizar por afirmación puede cambiar veredictos.** Eso choca con el invariante principal del
   SPEC.
7. **La huella del código queda en cada recibo** [H]: `claim_ledger.py:140-152` guarda el SHA-256 de
   `semantic_support.py` y `conversation.py` en cada respuesta.
   - Editar esos archivos no rompe nada.
   - Pero sí cambia la huella de los recibos nuevos. Conviene que cualquier cambio en ellos sea mínimo
     y quede documentado.
   - Ninguno de los dos está en el manifiesto del snapshot (`evidence/registry.py`, `query/*`,
     `ingestion/*` y `normalization/units.py` sí lo están y **no se tocan**).

**Consecuencias para el SPEC:**

| SPEC dice | Código real | Ajuste |
|---|---|---|
| Lambda con `{claim_id, hypothesis, premises[]}` → `Verdict` | El NLI es por par y la agregación vive en reglas fuera del modelo | Contrato **por par** (o lote de pares independientes) que devuelve lo mismo que `_infer` |
| Extraer `nli_core.py` moviendo la lógica | La lógica de inferencia ya es pequeña y está aislada en `_infer` | **No mover código**: la Lambda importa `semantic_support.py` tal cual (solo depende de numpy al importarse) |
| `verify_claims_async` + `asyncio.gather` por afirmación | Pipeline síncrono con dependencias entre afirmaciones | `RemoteEntailment.check()` síncrono, más **precarga en lote** del bucle de modalidad |
| Golden set de afirmaciones | No hay entrada “afirmación” al NLI | Golden set de **pares** (premisa, hipótesis, probabilidades) capturado envolviendo `check`/`_infer` |
| `CHAT_MAX_ACTIVE=2` con locks | `ConversationService` guarda estado por pregunta en atributos de instancia (`_alignment_checks`, `_active_support_inventory`, …) | Dos chats a la vez requieren **dos instancias del servicio** (+1.1–2 GB de RAM), no solo locks. Dejarlo en 1 |
| `GET /api/v1/health` “o créalo” | Ya existe, igual que `/readiness` | Agregar el bloque `nli` al existente |

---

## 4. Componente por componente

| Componente | ¿Encaja? | Qué requiere | Riesgo |
|---|---|---|---|
| **Uvicorn de un solo proceso con estado en memoria** (sesiones, cola y operaciones) | **Sí**, en EC2. No encajaría en Lambda, Fargate con varias réplicas ni Spot | systemd con `Restart=always`. Mantener 1 worker | Un reinicio borra conversaciones y la cola, y la consola muestra “no encontrado” en operaciones viejas [H]. Es aceptable para la demo: no reiniciar durante la evaluación |
| **~3.3 GB de RAM** | **Sí**: en modo Lambda baja a ~2.2 GB [S, falta medir]; con respaldo local sube a ~3.3 GB. Una `t4g.large` (8 GB) alcanza | Swap de 2 GB por seguridad | Los dos carriles cargan cada uno su servicio (grafo y SQLite duplicados) [H]. No es nuevo |
| **CPU por pregunta** | **Depende de la medición** | Ver con `--diagnostics`: `chat_seconds − nli_seconds − provider_seconds` = CPU que se queda en la EC2 | `t4g.large` es **burstable**: línea base de 30 % por vCPU [S, verificar en AWS]. En modo *unlimited* cobra el exceso. Graviton2 tiene menos rendimiento por hilo que la laptop en Python puro (regex, rdflib, stemming) [S]. Si queda mucha CPU fuera del NLI, la pregunta puede tardar **más** que hoy |
| **Modelo NLI de 1.1 GB** | **Sí en Lambda**: la imagen de contenedor admite hasta 10 GB | Contrato por par o lote (§6). Carga perezosa en el handler | **Arranque en frío**: leer 1.1 GB de la imagen puede tardar 10–30 s [S]; en SSD tarda 2.4 s [M]. **Paridad x86 → ARM**: los logits pueden diferir en ~1e-5–1e-3 y un par cerca de 0.92 puede cambiar de veredicto [S]. Hay que probarlo con el golden set; si cambia algo, usar la Lambda en `x86_64` |
| **Respaldo NLI local en la EC2** | **Sí, pero lento** | `onnxruntime` sigue en el venv (ya está) | En `t4g.large`, vCPU − 1 = **1 hilo**: entre 115 y 1126 ms por par en x86 [M], probablemente más en Graviton2. Es un salvavidas, no un modo de operación |
| **Assets de 1.2 GB desde el zip** | **Sí** | Llevar el zip a la EC2 (S3 privado o `scp`) y correr `scripts/restore_research_assets.py`, que verifica el SHA-256 del zip y de cada archivo [H]. Otra opción es `rsync` de `research/data/index`, `research/data/snapshots` y `research/artifacts/hackathon` | El script exige que los archivos de Git del release sean idénticos [H]: hay que restaurar sobre un checkout limpio de la misma rama. La Lambda **también** necesita el modelo en su contexto de build: copiarlo desde la EC2 ya restaurada |
| **API de NVIDIA para embeddings** | **Sí** (sale a internet desde la EC2) | `NVIDIA_API_KEY` en `research/.env` o en el `EnvironmentFile` de systemd: `config.py` usa `load_dotenv(override=False)` y el entorno manda [H] | Límite de la API gratuita. Si tarda más de 10 s, la búsqueda sigue sin vectores [H]: degrada, no se cae. Una pregunta puede hacer varias búsquedas (hasta 3 rondas) [S]. Usar SSM requeriría un script de bootstrap y permiso `ssm:GetParameter`; el código no lo lee directo |
| **Bedrock por IAM Role** | **Sí** | **`AWS_REGION=us-east-1` es obligatorio**: `bedrock_available()` exige `session.region_name` y boto3 no toma la región del rol [H] `model_catalog.py:63-72`. También `NASA_SCIENTIFIC_LLM_PROVIDER=nvidia` (es el default [H]) | La política del SPEC (`InvokeModel*` sobre `foundation-model/*` en `*` y `inference-profile/*`) cubre `converse` y los perfiles `us.*` [H, IDs en `model_catalog.py`]. El acceso a modelos ya está habilitado en la cuenta [S: Rodrigo lo probó]. Para ahorrar, ocultar Opus y Sonnet con `NASA_HIDDEN_MODELS` [H], sin tocar código |
| **Frontend estático** | **Sí** | `npm run build` en una laptop y copiar `app/dist`. Caddy con `try_files` | La consola llama a `'/api/v1'` relativo (`VITE_API_BASE` opcional) [H], así que funciona detrás de Caddy sin CORS. **`app/dist` está desactualizado**: es de las 15:00 y **no incluye `data/demo-answers.json`**, generado a las 15:09 [M]. Hay que volver a compilar antes de subir |
| **Arranque en frío de la API (~19 s)** | **Sí** | `NASA_WARMUP=1` (default). `/api/v1/readiness` para saber cuándo está lista | Las peticiones que llegan durante esos ~19 s esperan o reciben 503. Si se apaga la EC2 por las noches, hay que encenderla ≥ 1 min antes |
| **Arranque en frío de la Lambda** | **Sí**, con warm-up | Warm-up desde el `lifespan` de FastAPI, como pide el SPEC | 10–30 s extra en la primera pregunta tras ~5–15 min sin uso [S]. Con un solo chat a la vez basta con calentar tantos contenedores como el *fan-out* de la precarga (p. ej., 8) |
| **Respuestas preparadas** (`app/public/data/demo-answers.json`, 1.1 MB) | **Sí**, sin backend | Se sirven como archivo estático (`fetch(BASE_URL + 'data/demo-answers.json')`) [H] | Hay que volver a compilar `app/dist` (ver arriba). Si cambia el modelo por defecto o el snapshot, regenerarlas con `scripts/precompute_demo_answers.py` contra la API real |
| **Caddy y el proxy** | **Sí** | El Caddyfile del SPEC sirve | El chat usa **operaciones con sondeo** (`POST /chat/operations`, luego `GET`) [H], no SSE: `flush_interval -1` no hace daño, pero no hace falta. Sin timeouts largos de proxy |
| **Recibos `claim_ledger`** | **Sí** | Se escriben en `research/data/index/claim_ledger` [H]: el usuario de systemd necesita permiso de escritura ahí | Se borran solos a los 30 días [H] |

### 4.1 Compatibilidad con servicios serverless o efímeros

| Opción | ¿Sirve para el motor? | Motivo |
|---|---|---|
| **Lambda para la API** | **No** | Sesiones y cola en memoria, carga de ~19 s y 3.3 GB, y preguntas de hasta ~130 s con sondeo entre peticiones |
| **Lambda para el NLI** | **Sí** | Inferencia pura y sin estado (`_infer`). Con contrato por par o lote |
| **Fargate para la API** | Solo con **1 tarea fija** | Lo mismo que EC2 pero más caro, y la imagen tendría que incluir 1.2 GB de assets. Varias tareas romperían las sesiones |
| **Spot para la API** | **No recomendado** | Una interrupción borra las conversaciones durante la evaluación |
| **Apagado automático fuera de horario** | **Sí** | EBS conserva los assets; arranque de ~19 s más el warm-up de la Lambda |
| **S3 + CloudFront para el frontend** | **Sí, opcional** | Es estático y llama a `/api/v1` relativo. Requiere un origen extra en CloudFront para `/api/*` hacia la EC2. Para el tráfico de jueces, Caddy alcanza |

---

## 5. Cuánto se puede ganar realmente (estimación)

- **Con NLI remoto por par y sin paralelismo:** cada par cuesta la inferencia en Lambda (~3.5 vCPU
  con 6 GB, ARM) más ~15–40 ms de invocación desde la misma región [S]. Para pares cortos, la
  invocación pesa tanto como la inferencia. Resultado esperado: **parecido a la laptop con 4 hilos**,
  pero con una EC2 pequeña. No llega a ≤ 70 s solo con esto.
- **Con precarga en paralelo del bucle de modalidad** (hasta 64 pares independientes por afirmación):
  es el bucle más grande y no tiene `break` [H]. Si domina el tiempo de NLI [S, se mide con
  `--diagnostics`], repartirlo entre 8 invocaciones puede recortar la mayor parte del NLI sin cambiar
  ningún veredicto.
- **Lo que no se paraleliza** sin tocar la semántica: el orden entre afirmaciones, los bucles con
  `break` (ausencias y remedios), la equivalencia inversa y las llamadas al LLM (8–25 s).
- **Costo de Lambda** [S]: con 300 pares de 0.2 s × 6 GB ≈ 360 GB-s ≈ **$0.005 por pregunta** (ARM a
  $0.0000133334 por GB-s). Cumple de sobra el tope de $0.02.

---

## 6. Diseño ajustado recomendado (conserva los veredictos por construcción)

```
navegador ──HTTPS──> Caddy (EC2) ──/api/*──> FastAPI 127.0.0.1:8765 (1 worker)
                       └─ app/dist                │
                                                  ├─ NVIDIA embeddings (HTTPS)
                                                  ├─ Bedrock Converse (IAM Role, us-east-1)
                                                  └─ RemoteEntailment.check(p, h)
                                                        ├─ caché LRU local (igual que hoy)
                                                        ├─ atajo de identidad y _changed_terms locales
                                                        └─ _infer ──lambda:Invoke──> flame-nli-verifier
                                                              (si falla: LocalEntailment perezoso)
```

1. **Lambda** `flame-nli-verifier`:
   - Copia `semantic_support.py` **sin cambios** al contexto de build e instancia `LocalEntailment`
     sobre `/opt/model`.
   - Por cada par llama a `_infer(premise, hypothesis)` y devuelve el dict tal cual (`supported`,
     `probabilities`, `threshold` o `reason`).
   - Request: `{"pairs": [{"premise": "...", "hypothesis": "..."}], "threshold": 0.92}`. Response:
     `{"ok": true, "results": [...], "model": "<revision>@<sha corto>", "env_id": "..."}`.
   - Procesa los pares **uno por uno**, sin padding en lote, para no alterar los logits.
   - Carga perezosa del modelo y warm-up `{"warmup": true}`, como en el SPEC.
   - Requirements: onnxruntime 1.31.1, tokenizers 0.23.3, numpy 2.5.3 y snowballstemmer 3.1.1 (lo
     importa el `__init__`).
2. **`research/src/nasa_fire_ai/services/remote_entailment.py`** (archivo nuevo):
   - Clase `RemoteEntailment(LocalEntailment)` que **no** abre sesión ONNX; carga el tokenizer, las
     etiquetas, el umbral, la caché y el stemmer.
   - Sobrescribe `_infer` para invocar la Lambda (boto3, `read_timeout` ~30 s, reintentos `standard`).
   - Si falla, usa un `LocalEntailment` perezoso detrás de un lock.
   - Agrega `prefetch(pairs)`: llena la caché con los pares que faltan, repartidos en lotes
     concurrentes (`NASA_NLI_MAX_PARALLEL`).
   - Registra métricas por pregunta: pares, ms, respaldos.
3. **`api.py`** (cambio mínimo en `default_service`):
   - Si `NASA_NLI_BACKEND=lambda`, construye `RemoteEntailment`; si no, `LocalEntailment` como hoy.
   - Agrega el bloque `nli` a `/api/v1/health`.
   - Agrega la tarea de warm-up en `lifespan`.
4. **`semantic_support.py`**: **una sola línea** antes del bucle de modalidad (l. 1027):
   `if hasattr(entailment, "prefetch"): entailment.prefetch([(s, semantic_hypothesis) for s in source_sentences[:64]])`.
   El bucle sigue igual y lee de la caché: mismo orden y mismos resultados. Cambia la huella de
   `semantic_support.py` en los recibos; dejarlo anotado. **Este paso es opcional**: hacerlo solo si
   `--diagnostics` muestra que el NLI domina.
5. **Variables** (con prefijo `NASA_` como el resto del motor):
   - `NASA_NLI_BACKEND=local|lambda` (default `local`);
   - `NASA_NLI_LAMBDA_FUNCTION`, `NASA_NLI_MAX_PARALLEL=8`, `NASA_NLI_TIMEOUT_SECONDS=30`;
   - `NASA_NLI_WARMUP_*`.

   **No** se agrega `NLI_THRESHOLD`: el umbral ya está fijo en el código (0.92) y no debe ser
   configurable.

---

## 7. Qué falta, en orden

### Paso 0 — Medir antes de decidir (sin cambiar código, en la laptop)

1. Arrancar la API con `--diagnostics <carpeta nueva>` y las llaves actuales. Correr las **5 preguntas
   de prueba**.
2. De cada `turn-NN.json`, anotar `chat_seconds`, `timings.nli_seconds`, `timings.retrieval_seconds`
   y `provider_seconds`.
3. Decidir con este criterio:
   - **NLI ≥ 50 % del tiempo:** seguir con la Lambda (pasos 1–6).
   - **NLI < 30 %:** saltar la Lambda e ir a la alternativa de §8.

### Paso 1 — Golden set de pares (antes de refactorizar)

- `scripts/nli_golden_capture.py`: envuelve `LocalEntailment._infer` y guarda `{premise, hypothesis,
  probabilities, supported, reason}` de las 5 preguntas en `research/tests/fixtures/nli_golden.json`.
- Además guarda, por pregunta, la lista de afirmaciones aceptadas y rechazadas de la respuesta final
  (paridad de extremo a extremo).
- Verificación: ≥ 200 pares, con casos `supported=false` y pares a 0.92 ± 0.02 marcados como
  *borderline*.

### Paso 2 — Lambda

- Archivos nuevos en `research/lambda/`: `template.yaml` (SAM; `Architectures` como parámetro
  `arm64`/`x86_64`), `deploy.sh`, `nli_verifier/handler.py`, `requirements.txt`, `Dockerfile`,
  `build_context.sh` (copia `semantic_support.py` y el modelo a `build/`, que va en `.gitignore`),
  `sample_event.json` y `README.md`.
- Revisar la cuota: `aws lambda get-account-settings`. Si es 10, `NASA_NLI_MAX_PARALLEL ≤ 8` y sin
  concurrencia reservada.
- Construir en la EC2 ARM, con `--provenance=false` si se usa buildx.
- Verificación: `test_nli_lambda_parity.py` con **labels idénticas** y |Δp| ≤ 1e-3. Si un caso
  *borderline* cambia de veredicto, **cambiar la Lambda a `x86_64`** y repetir.

### Paso 3 — Cliente en el servidor

- Agregar `remote_entailment.py`, el cambio mínimo en `api.py` y las pruebas
  `tests/test_remote_entailment.py` (Stubber de botocore):
  - `FunctionError`, `ok:false` y timeout → respaldo local;
  - throttling → reintento;
  - el orden se conserva;
  - nunca más de `NASA_NLI_MAX_PARALLEL` a la vez;
  - con `local` no se crea el cliente de Lambda.
- Opcional: la línea de `prefetch` (§6.4).
- Verificación: el golden de extremo a extremo da las mismas afirmaciones aceptadas y rechazadas con
  `local` y con `lambda`.

### Paso 4 — Archivos de despliegue (van a `deploy/` en el repo)

| Archivo | Contenido |
|---|---|
| `deploy/Caddyfile` | El del SPEC. `root * /opt/flame/app/dist`; `handle /api/*` hacia `127.0.0.1:8765` |
| `deploy/flame.service` | El del SPEC, con `ExecStart=/opt/flame/research/.venv/bin/python scripts/serve_scientific_console.py`, `Environment=PYTHONUTF8=1`, `WorkingDirectory=/opt/flame/research`, usuario `flame` con escritura en `data/index/claim_ledger` |
| `deploy/flame.env.example` | `NASA_SCIENTIFIC_LLM_PROVIDER=nvidia`, `NASA_DEFAULT_MODEL=nvidia.nemotron-super-3-120b`, **`AWS_REGION=us-east-1`**, `NASA_NLI_BACKEND=lambda`, `NASA_NLI_LAMBDA_FUNCTION`, `NASA_NLI_MAX_PARALLEL`, `NASA_NLI_THREADS=1`, `NASA_HIDDEN_MODELS=…` (si se ocultan Opus y Sonnet), `NASA_WARMUP=1`, `NVIDIA_API_KEY=` (vacío en el ejemplo) |
| `deploy/iam-ec2-policy.json` | La del SPEC (`lambda:InvokeFunction` sobre la función y `bedrock:InvokeModel*`); si se usa S3 para el zip, `s3:GetObject` sobre ese objeto |
| `deploy/bootstrap.sh` | Paquetes (`python3.12-venv`, `docker.io`, Caddy, AWS CLI, `uv`), usuario `flame`, checkout de la rama, `uv sync --frozen`, restauración de assets con verificación de SHA-256, swap de 2 GB, `systemctl enable --now flame caddy` |
| `deploy/smoke_test.sh` | `/api/v1/readiness`, `/api/v1/models`, una búsqueda y una pregunta corta. Comprobar `health.nli.backend` |

### Paso 5 — Infraestructura real (en este orden)

1. Revisar la cuota de Lambda y AWS Budgets (lo hace el equipo).
2. Lanzar la EC2, correr el bootstrap y restaurar los assets.
3. Correr `smoke_test.sh` con `NASA_NLI_BACKEND=local`: el motor en ARM sin Lambda.
4. **Paridad de búsqueda ARM vs x86** [S de riesgo bajo]: comparar los IDs de evidencia de las
   5 preguntas contra la laptop. El producto punto de los vectores en numpy puede desempatar distinto.
5. Construir y desplegar la Lambda, y correr la prueba de paridad.
6. Poner `NASA_NLI_BACKEND=lambda` y correr `bench_e2e.py` (5 preguntas ×2, en frío y en caliente, y
   3 usuarios). Revisar CloudWatch (`Duration`, `Throttles`, `Errors`) y `CPUCreditBalance` de la EC2.
7. Probar el respaldo: `put-function-concurrency 0` → la app responde sin 5xx.
8. `npm run build` local, subir `app/dist` (**con** `demo-answers.json`) y hacer el corte de DNS/EIP.

---

## 8. Recomendación final

1. **Mantener la base de la arquitectura híbrida:** EC2 + Caddy + Bedrock por IAM Role + frontend
   estático. Encaja con la app tal como está.
2. **Cambiar el contrato de la Lambda a “por par o lote de pares”** y no extraer `nli_core.py`. La
   Lambda debe reutilizar `semantic_support.py` sin tocarlo. Es menos código, la paridad está
   garantizada por construcción y es la única forma de respetar el invariante del SPEC (“sin cambiar
   ningún veredicto”).
3. **No paralelizar por afirmación.** Si hace falta paralelismo, usar la precarga del bucle de
   modalidad (1 línea).
4. **Decidir con la medición del Paso 0**, y tener lista la alternativa sin Lambda:
   - **Si el NLI no domina:** una sola EC2 **sin burst** con NLI local. Por ejemplo, `m7g.large`
     (Graviton3, 2 vCPU, 8 GB, ~$0.082/h [S]) o la `c7i.xlarge` del documento anterior. Menos piezas
     y sin arranques en frío. Con `--diagnostics` se elige con datos.
   - **Si se queda la `t4g.large`:** vigilar `CPUCreditBalance`. Con muchas preguntas seguidas, el
     modo *unlimited* cobra el exceso de CPU, y una `m7g.large` puede salir igual de cara y más
     estable.
5. **Mantener `CHAT_MAX_ACTIVE=1`.** Dos chats a la vez requieren otra instancia del servicio, no
   solo locks (§3).
6. **Paridad de arquitectura:** si un solo caso del golden cambia en ARM, poner la Lambda en
   `x86_64`. Cuesta ~20 % más por GB-s, pero son centavos por pregunta.

### Decisiones que le tocan al equipo o a Rodrigo

- [ ] ¿Aceptan el contrato **por par** en lugar de “por afirmación”? Es un cambio respecto al SPEC
  v1.1.
- [ ] ¿Se permite la línea de `prefetch` en `semantic_support.py`? Cambia la huella de ese archivo en
  los recibos; conviene avisar a Liam.
- [ ] ¿Quién corre el Paso 0 (`--diagnostics`, 5 preguntas, usa Bedrock/NVIDIA) y con qué
  presupuesto?
- [ ] Tipo de EC2: `t4g.large` (burstable) o `m7g.large`/`c7i.xlarge`, según el Paso 0.
- [ ] Arquitectura de la Lambda: `arm64` o `x86_64`, según el golden.
- [ ] Cuota de concurrencia de Lambda en la cuenta y si se pide el aumento.
- [ ] Cómo se lleva el zip de assets a la EC2 (S3 privado o `scp`) y dónde vive `NVIDIA_API_KEY`
  (`flame.env` o SSM).
- [ ] ¿Se ocultan Opus y Sonnet en la demo (`NASA_HIDDEN_MODELS`)?
- [ ] Horario de evaluación de los jueces (ventana de warm-up y apagado nocturno).
- [ ] Confirmar lo que el repo no muestra: que ya existen la EC2 actual, la EIP, el dominio
  `flameinfreefall.com` y el estado de Caddy que el SPEC da por hechos [S].
