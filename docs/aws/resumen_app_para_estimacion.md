# Flame in Freefall — resumen técnico para estimar uso e instancia en AWS

Documento pensado para pegarse a Amazon Q (o a cualquier asistente de AWS) y obtener una estimación de uso, instancia EC2 y costo. Describe la app **tal como está hoy** en la rama local `integracion-final` (NASA Space Apps 2026, reto 08).

Convención: **[MEDIDO]** = cifra obtenida en la laptop del equipo (i7-13650HX, 20 hilos, 23.7 GB RAM, Windows); **[ESTIMADO]** = proyección o supuesto, sin medir en AWS.

---

## 1. Qué es la app

Una consola científica web con un asistente de preguntas y respuestas sobre experimentos de combustión en microgravedad (datos PSI de la NASA) más un laboratorio 3D y visores de datos. Cada respuesta del asistente se genera con un LLM, **se verifica afirmación por afirmación contra la evidencia** (modelo NLI local) y se entrega con citas.

Se despliega como **un solo servidor** (una EC2 en us-east-1) con dominio en Route 53, Elastic IP, Caddy (TLS) y systemd.

## 2. Componentes hoy

### 2.1 En el navegador del visitante (no consume servidor)
- Frontend 100 % estático (Vite build en `app/dist`, **4.3 MB en disco** [MEDIDO]; ~1 MB comprimido en la primera carga [ESTIMADO a partir del build]).
- `app/index.html`: consola científica (asistente, historial de chats con contador de prompts, Deep Research, Notebook para guardar respuestas con citas y exportar Markdown, Investigations / Compare / Discover / Evidence).
- `app/lab.html` (iframe): Simulation Lab (Laboratorio 3D con three.js, Flame Simulator) y Mission Data (Panorama, FLEX Charts, Test Records). **El 3D y las gráficas corren en la CPU/GPU del visitante.**
- El historial de chats vive en el navegador (localStorage), no en el servidor.
- No existe Notebook Studio generativo.

### 2.2 En el servidor
Un **único proceso** FastAPI + Uvicorn (`research/scripts/serve_scientific_console.py`), puerto **8765**, rutas **`/api/v1/*`**. FastAPI **no** sirve el frontend.

| Pieza | Detalle |
|---|---|
| Búsqueda léxica | SQLite FTS5, `evidence.sqlite` 33 MB |
| Búsqueda vectorial | 1 371 vectores de 2048 dim; embeddings `nvidia/nemotron-3-embed-1b` por **API de NVIDIA** (1 llamada por pregunta) |
| Grafo de conocimiento | RDF ~400 000 tripletas **en memoria** (rdflib, `graph.ttl` 105 MB) |
| Registros PSI | Unidades originales, consulta directa |
| Verificador NLI | mDeBERTa ONNX local, **1.1 GB**, **CPU**, umbral 0.92; revisa cada afirmación generada |
| LLM | 13 modelos curados: 2 vía API NVIDIA (Nemotron 3.5 Super —default actual—, Lightning) y 11 en **Amazon Bedrock** (Nemotron Super 3 y Nano 3, Claude Sonnet 4.6, Haiku 4.5, Opus 4.6, Nova Pro, Nova 2 Lite, Mistral Large 3, gpt-oss 120B, Qwen3 Next 80B, DeepSeek V3.2). Claude 5.x da AccessDenied en la cuenta del equipo. |

**Concurrencia (restricción de diseño):**
- Las sesiones viven en memoria del proceso → **1 solo worker Uvicorn** (varios workers rompen las conversaciones).
- Carril de **conversación**: 1 pregunta activa a la vez, hasta 8 en cola, después responde 503.
- Carril de **lectura** (Investigations/Compare/Discover/Evidence): hasta 16 en paralelo, 40–290 ms [MEDIDO por Liam en su equipo, con un chat activo].

## 3. Perfil de recursos

| Recurso | Valor | Origen |
|---|---|---|
| RAM del proceso cargado | ~3.3 GB privada | MEDIDO |
| Arranque en frío | ~19–22 s | MEDIDO |
| `research/data/index` | 1.07 GB | MEDIDO |
| snapshots / `data/raw` | 0.13 GB / 0.21 GB (0.22 GB en `du`) | MEDIDO |
| venv Python | 0.47 GB | MEDIDO |
| Repo `research/` | ~240 MB | MEDIDO |
| `app/dist` | 4.3 MB | MEDIDO |
| Disco sugerido | 30 GB gp3 | decisión |
| GPU | No se necesita | — |

**Latencia por pregunta** (limitada a 4 hilos de CPU, 5 corridas) [MEDIDO]: **67–126 s** en total, de los cuales el LLM aporta solo **8–25 s**. El resto es CPU local: verificación NLI, consultas al grafo y a la base de evidencia. Varía con el número de afirmaciones que escribe el modelo (3–11).

- Optimizaciones propuestas **aún NO aplicadas** (pendiente OK del equipo): NLI con vCPU−1 hilos, caché de `registry.resolve` y del stemming. En benchmark: ~6.5 s por afirmación vs ~12–19 s hoy → ~1–1.5 min por pregunta típica [MEDIDO en laptop; no aplicado].
- Una EC2 c7i/m7i puede ser **15–25 % más lenta por hilo** que la laptop [ESTIMADO].
- Deep Research hace más búsquedas y mete más evidencia: más tokens y más tiempo [sin cifra medida].

**Llamadas al LLM por pregunta:** 4–5 (planeación, explicación 1–2, revisión de relevancia, capa conversacional en el idioma del usuario).
Tokens: ~88 700 de entrada y ~1 500 de salida en las 4 primeras llamadas [MEDIDO por Liam, vía NVIDIA]; la capa conversacional suma unos pocos miles más [ESTIMADO]. Total por pregunta típica ≈ **~92 000 tokens de entrada y ~2 000–3 000 de salida** [ESTIMADO].

## 4. Perfil de uso supuesto (SUPUESTO, ajustable)

- Evaluación/demostración de unas horas con **~20 jueces/visitantes** activos; en promedio ~3 preguntas por persona por hora → **~60 preguntas/hora** en pico.
- Casi todo el tráfico "pesado" es el asistente; el resto (lectura y estáticos) es despreciable.

**Qué variable domina costo y latencia:** el **número de preguntas concurrentes**, porque el carril de conversación procesa **una a la vez** y cada una usa CPU a fondo 1–2 min.
- Capacidad de una instancia: ~30–60 preguntas/hora (a 1–2 min cada una). Con 60/hora en pico la cola se llena (8 en espera → 503) y la espera percibida llega a varios minutos.
- Por eso importa más **la velocidad por hilo y el número de vCPU** (NLI usa vCPU−1 hilos) que la RAM por encima de ~8 GB.
- Escalar horizontalmente **no** es trivial (sesiones en memoria; un worker). Para más carga, subir de tamaño la instancia, no añadir procesos.
- Costo de Bedrock es secundario frente al de la instancia salvo que se use Opus o Deep Research intensivo (ver §7).

## 5. Opciones de instancia (us-east-1, Linux on-demand; precios de lista **aproximados**, verifique en la calculadora)

| Instancia | vCPU / RAM | ~USD/h | Pros | Contras |
|---|---|---|---|---|
| t3.medium | 2 / 4 GB | ~0.04 | Barata | **No alcanza** (ver abajo) |
| t3.large | 2 / 8 GB | ~0.083 | Cabe en RAM | Solo 2 vCPU; créditos de CPU; ~2–4× más lenta que lo medido [ESTIMADO] |
| c7i.xlarge | 4 / 8 GB | ~0.18 | CPU dedicada (sin créditos), iguala el perfil de 4 hilos medido | 8 GB deja poco margen si se añade otro servicio; ~2–3 min/pregunta con el código actual, ~1.5 min con las optimizaciones [ESTIMADO] |
| m7i.xlarge | 4 / 16 GB | ~0.20 | Mismo CPU, mucha RAM libre (caché de disco para `index` de 1 GB) | Paga RAM que no se usa |
| **c7i.2xlarge** | 8 / 16 GB | ~0.36 | NLI con 7 hilos → mejor latencia por pregunta; RAM holgada; carril de lectura con núcleo libre | El doble de costo/hora que c7i.xlarge |

**Recomendación:** **c7i.2xlarge** para el día de evaluación (latencia por pregunta es lo que perciben los jueces); **c7i.xlarge** como plan económico si se acepta 2–3 min por pregunta; apagar o reducir fuera de horario (EBS + Elastic IP se conservan). Cambiar de tamaño es solo detener/iniciar la instancia, por lo que se puede medir y ajustar. Prueba recomendada antes del evento: 5 preguntas seguidas y medir con `top`/CloudWatch.

**Por qué no t3.medium:** 4 GB de RAM contra ~3.3 GB del proceso + SO + Caddy + caché de página → swap u OOM-kill. Además, solo 2 vCPU.

**Por qué las t3 son riesgosas aquí:** son instancias *burstable*: la CPU sostenida está limitada a una línea base (~20–40 % por vCPU) y el resto sale de créditos. Cada pregunta usa la CPU al 100 % durante 1–2 min; unas pocas preguntas seguidas agotan los créditos y la instancia se estrangula (o, en modo *unlimited*, cobra extra por créditos). La c7i/m7i da rendimiento constante.

## 6. Seguridad e infraestructura

- **Bedrock:** por **IAM Role** de la instancia (el código usa la cadena estándar de boto3, sin llaves en disco). Permisos mínimos: `bedrock:InvokeModel` y `bedrock:InvokeModelWithResponseStream` sobre los modelos y perfiles de inferencia que se usen, en lugar de `AmazonBedrockFullAccess`.
- **Llave de NVIDIA** (embeddings, y LLM si se usa): `research/.env` en el servidor o SSM Parameter Store. No va en el repo.
- **Red:** 443/80 abiertos; **puerto 22 solo para IPs del equipo**; 8765 solo en 127.0.0.1.
- **Caddy:** `file_server` sobre `app/dist` + `reverse_proxy /api/* 127.0.0.1:8765`; systemd para el proceso Uvicorn.
- **Recomendación de modelo por defecto:** usar Bedrock en la demo; la API gratuita de NVIDIA limita peticiones y en el peor caso tardó minutos.
- Salida a internet necesaria: Bedrock (VPC endpoint opcional) y la API de NVIDIA para embeddings (1 llamada por pregunta).

## 7. Costo de Bedrock por pregunta [ESTIMADO, precios de lista aproximados]

Base: ~92 000 tokens de entrada + ~2 500 de salida por pregunta típica. Precios por millón de tokens (entrada/salida), **de memoria, no verificados hoy**: confirmar en la página de precios de Bedrock.

| Modelo | Precio supuesto (USD/M tok. ent./sal.) | ~USD por pregunta |
|---|---|---|
| Claude Haiku 4.5 | ~1 / ~5 | ~0.10 |
| Claude Sonnet 4.6 | ~3 / ~15 | ~0.30 |
| Claude Opus 4.6 | ~5 / ~25 | ~0.50 |
| Amazon Nova Pro | ~0.8 / ~3.2 | ~0.08 |
| Nemotron, Mistral, gpt-oss, Qwen, DeepSeek, Nova 2 Lite | no verificado | verificar en la calculadora |

A ~60 preguntas/hora: Haiku ≈ 6 USD/h, Sonnet ≈ 18 USD/h, Opus ≈ 30 USD/h. Deep Research puede multiplicar por 2–3 [ESTIMADO]. Con modelos baratos, el LLM cuesta menos que la instancia; con Opus, domina.

## 8. Correcciones al borrador de arquitectura (con cariño)

El borrador describe el **RAG anterior**, hoy movido a `legacy/`. Para la versión desplegable:

| Borrador | Hoy |
|---|---|
| Índice IVF de 277 NTRS | Motor de evidencia de Liam: FTS5 + 1 371 vectores + grafo RDF + registros PSI + verificador NLI |
| Cubo OLAP `olap_experimentos.db` | Ya no se usa (en `legacy/`) |
| Embeddings Amazon Titan 1536 | `nvidia/nemotron-3-embed-1b`, 2048 dim, vía API de NVIDIA |
| Ruta `/api/rag/*`, puerto 5005 | `/api/v1/*`, puerto **8765** |
| "40 modelos" | **13** modelos curados y probados (2 NVIDIA, 11 Bedrock) |
| Research Notebook Studio | Notebook simple (guardar respuestas con citas y exportar Markdown); no hay Studio generativo |
| FastAPI sirve el frontend | No: **Caddy** sirve `app/dist` y hace proxy de `/api/*` |
| t3.medium (4 GB) | No alcanza (~3.3 GB solo el proceso) y las t3 dependen de créditos de CPU |

Lo que **sí está bien** y se mantiene: Route 53, Elastic IP, Caddy/TLS, systemd e IAM Role.

## 9. Preguntas para Amazon Q

1. Con este perfil (1 proceso, ~3.3 GB RAM, CPU intensiva 1–2 min por pregunta, ~60 preguntas/hora en pico), ¿qué instancia entre c7i.xlarge, m7i.xlarge y c7i.2xlarge minimiza latencia por costo?
2. Costo mensual/por evento de la instancia + EBS gp3 30 GB + Elastic IP + Route 53, con y sin apagado fuera de horario.
3. Costo de Bedrock por modelo con los tokens de §3 en us-east-1 (incluyendo perfiles de inferencia).
4. ¿Conviene Savings Plans/Spot para un evento de pocos días? (Supuesto: no, on-demand.)
