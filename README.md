# Flame in Freefall — NASA Space Apps 2026 (Reto #08)

Datos para el reto *"Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data"*.
Hackathon: 14–15 nov 2026. Statement completo y datasets oficiales: 28 oct 2026.

## Estructura

```
data/
  ntrs/          Corpus de papers y reportes de NTRS (PDF + texto completo .txt) por tema
                 catalog.csv / catalog.jsonl → id, título, autores, fecha, URL (la cita de cada documento)
  psi/           NASA Physical Sciences Informatics, 24 investigaciones de Combustion Science
                 psi_index.csv → resumen por investigación (DOI, licencia, tamaño total vs. bajado)
                 <PSI-xx_ACRÓNIMO>/investigation.json   metadatos completos (objetivos, hipótesis, publicaciones)
                 <PSI-xx_ACRÓNIMO>/files_manifest.csv   TODOS los archivos de la investigación, bajados o no
                 <PSI-xx_ACRÓNIMO>/Experimental table/  matriz de ensayos (condiciones de cada prueba) ← empezar aquí
  taskbook/      NASA Task Book: 138 proyectos de Combustion Science (descripción, avances, bibliografía)
  standards/     NASA-STD-6001B (Change 3, 2025), JSC-29353B, paper sobre el Test 1
  mechanisms/    Mecanismos cinéticos para Cantera: gri30.yaml (GRI-Mech 3.0) y sandiego20161214.yaml
  clean/         Tablas de PSI limpias y unificadas (las genera scripts/clean_psi.py; no editar a mano)
                 droplets / gas_flames / solids / aerosols / sessions .csv → una fila por ensayo o día
                 experiments_all.csv → columnas comunes + enlaces a PSI y DOI
                 campaigns.csv, publications.csv → ficha de cada investigación y sus papers
                 data_dictionary.md → unidades y significado de cada columna y de cada qc_flag
                 qc_report.md → qué se encontró al limpiar, por campaña
scripts/         Descargadores (se pueden re-ejecutar; no vuelven a bajar lo que ya existe)
                 clean_psi.py + cleaning/ → limpieza (un adaptador por familia física)
app/             App web (Vite): index.html monta la consola científica de research/ y le agrega
                 las secciones Simulation Lab (laboratorio 3D, simulador) y Mission Data (panorama,
                 gráficas FLEX, ensayos), que viven en lab.html y se muestran en un iframe.
                 Datos: scripts/build_dashboard_data.py → app/public/data/dashboard.json
research/        Motor de evidencia de Liam (NASA-Fire-AI-SpaceApps, vía git subtree): API en 8765,
                 búsqueda por pasaje + grafo RDF + verificación NLI. Sus archivos se guardan sin
                 conversión de saltos de línea (.gitattributes) porque verifica sus SHA-256.
legacy/          RAG anterior (cubo OLAP + Amazon Bedrock), retirado. Ver legacy/README.md
GUIA_PRESENTACION.md   Guion para presentar el prototipo al equipo
.venv/           Entorno Python con cantera, pandas, requests
```

## Levantar la demo

Una sola vez (requiere Python con [uv](https://docs.astral.sh/uv/) y Node 22):

```powershell
python scripts\restore_research_assets.py RUTA\NASA_FIRE_AI_RUNTIME_ASSETS.zip   # 1.2 GB, verifica cada SHA-256
cd research; uv sync --frozen; cd ..
cd app; npm install; cd ..
```

Cada vez: `.\start_demo.ps1` y abre http://localhost:5173. Si `research\.env` tiene `NVIDIA_API_KEY`
(cópialo de `research\.env.example`; no se sube a Git), el asistente redacta y verifica respuestas con
Nemotron + verificador NLI local. Sin llave arranca sin conexión: la búsqueda, Investigations, Compare,
Discover y Evidence funcionan igual, pero el asistente solo muestra fragmentos de fuente.

### Rendimiento y demo

Variables del motor (en `research\.env` o el entorno del servicio; todas tienen un valor por defecto):

| Variable | Defecto | Para qué |
|---|---|---|
| `NASA_NLI_THREADS` | vCPU − 1, máximo 8 | Hilos del verificador NLI (antes fijo en 2). Mismos resultados, más rápido |
| `NASA_SERVING_CACHES` | `1` | Cachés de evidencia y stemming (`research/src/nasa_fire_ai/perf.py`) |
| `NASA_EMBEDDING_TIMEOUT_SECONDS` | `10` | Si NVIDIA tarda más (medido: mediana 0.49 s, máx. 0.65 s), sigue sin vectores |
| `NASA_DEFAULT_MODEL` | `nvidia.nemotron-super-3-120b` (Bedrock) | Modelo por defecto del asistente |
| `NASA_WARMUP` | `1` | Carga el motor al arrancar en vez de en la primera pregunta |
| `NASA_INTERPRETATION_ENABLED` | `1` | Capa conversacional sobre la respuesta verificada |

Antes de una demo, con la API corriendo, prepara las respuestas de las tarjetas de ejemplo
(se muestran al instante marcadas como "Prepared answer"):

```powershell
python scripts\precompute_demo_answers.py
```

## Despliegue en AWS

Guía, scripts y configuración en [`deploy/README.md`](deploy/README.md): EC2 con Caddy, systemd y
Bedrock por rol IAM. La revisión de la arquitectura híbrida (Lambda NLI) está en
[`docs/aws/revision_arquitectura_hibrida.md`](docs/aws/revision_arquitectura_hibrida.md).

## Totales (27 sep 2026)

| Fuente | Contenido | Tamaño |
|---|---|---|
| PSI | 24 investigaciones, ~21 900 archivos, 20 tablas experimentales | 4.2 GB |
| NTRS | 277 documentos (PDF + texto completo) | 818 MB |
| Task Book | 138 proyectos | 4 MB |
| Estándares + mecanismos | 3 PDF + 2 mecanismos Cantera | 4 MB |

## Qué se bajó y qué no

- **PSI** pesa ~13.5 TB en total, casi todo video (.mp4/.ts) e imágenes crudas. Se bajaron metadatos,
  tablas experimentales, documentos (≤40 MB) y archivos tabulares de datos reducidos (≤2 MB en *Raw Data*).
  Todo lo demás está listado en cada `files_manifest.csv` con su `s3_key` por si hace falta algo puntual
  (p. ej. un video de FLEX para visión por computadora).
- Los archivos públicos de PSI tienen licencia **CC0** y se descargan sin cuenta.
- **Archivos rotos en PSI**: ~2 600 archivos "legacy" dan 404 en el propio servidor de NASA
  (`data/psi/_errors.log`), casi todos de FLEX-2. `scripts/recover_psi_from_zips.py` recuperó 978
  extrayendo el `.txt` de dentro del `.zip` de cada prueba con lecturas parciales (sin bajar las imágenes).
  Los ~1 600 restantes no tienen respaldo en el servidor: sobre todo `*_Settings.txt` y `*_Readings.txt`
  de FLEX-2 y los *proof sheets* PDF de BASS-II.
- **SLICE (PSI-106)**: se omitieron ~23 000 archivos `.dat` (matrices de imagen, ~7 GB).
- **data.nasa.gov / science.data.nasa.gov**: no tienen datasets de combustión propios; science.data.nasa.gov
  apunta a los mismos registros de PSI (DOIs `10.60555/...`).
- **SoFIE / MIST / Confined Combustion**: todavía no tienen investigación publicada en PSI; su información
  está en `data/ntrs/sofie/` y en Task Book.
- **MAPTIS** (base de flamabilidad de materiales) es de acceso restringido: fuera del plan.

## Uso

```bash
.venv/Scripts/python scripts/download_ntrs.py --per-query 40
.venv/Scripts/python scripts/download_psi.py --doc-mb 40 --raw-mb 2
.venv/Scripts/python scripts/download_taskbook.py
.venv/Scripts/python scripts/recover_psi_from_zips.py
.venv/Scripts/python scripts/clean_psi.py
```

### Limpieza (`scripts/clean_psi.py`)

Lee las 20 tablas experimentales de PSI y escribe `data/clean/`. Reglas:

- **Nada se corrige en silencio.** Cada valor interpretado, completado o sospechoso deja una marca
  `columna:motivo` en `qc_flags` (p. ej. `thickness_mm:decimal_faltante` para el `037 mm` de SAFFIRE-II).
  Las filas no se borran: `excluded = true` solo para copias exactas.
- **Trazabilidad.** Cada fila trae `source_file` y `source_line` de la tabla original de PSI.
- **Unidades comunes.** Presión en atm, fracciones molares de 0 a 1, longitudes en mm/cm, temperaturas en K,
  fechas ISO. Cuando la tabla no da el año, la fecha queda vacía en lugar de inventarse.
- **Tres familias de combustión** con columnas propias: gotas (FLEX, CFI), llamas de gas
  (ACME Flame Design, ACME CFI-G, SPICE) y sólidos (SAFFIRE I–III, BASS, BASS-II). Aparte quedan los
  aerosoles (SAME, SAME-R, DAFT) y las bitácoras por día (ACME BRE/CLD/E-FIELD/s-Flame, SLICE), que no
  describen ensayos individuales.
- El script se detiene si aparece una columna o una marca que no esté en `scripts/cleaning/schema.py`,
  para que `data_dictionary.md` nunca quede desactualizado.

Para agregar una tabla nueva (p. ej. los datasets oficiales del reto): escribir su adaptador en
`scripts/cleaning/<familia>.py`, sumarlo al `build()` de esa familia y documentar sus columnas en `schema.py`.

Cantera (prueba rápida de que todo funciona):

```python
import cantera as ct
gas = ct.Solution("data/mechanisms/gri30.yaml")
gas.TPX = 300, 101325, "CH4:1, O2:2, N2:7.52"
flame = ct.FreeFlame(gas, width=0.03)
flame.solve(loglevel=0, auto=True)
print(flame.velocity[0])   # ≈ 0.385 m/s
```

Nota: los mecanismos incluidos son para gases ligeros (metano, etileno, propano). FLEX usó
heptano, decano y metanol; para esos combustibles hace falta un mecanismo específico
(p. ej. el submecanismo de heptano de San Diego).
