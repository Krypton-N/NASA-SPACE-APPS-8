# Auditoría de hackathon — 2026-11-05

Base: `941d34cb13c82bf2f7ccc5e6d07788c90bdb4fa6`, worktree existente
`/home/liam/NASA/.worktrees/NASA_hackathon`, rama `NASA_hackathon`.
`git ls-remote` confirma la misma base en `diego/research`; la referencia local de
research está 413 commits atrasada. No se modificó ninguna otra rama. Main tiene
eliminaciones pendientes ajenas. No se encontró rama literal `hackathon`.
El PDF de transferencia está disponible en Descargas; no se encontró el ZIP.

`uv sync` y `research.py status` pasan. La pregunta PMMA se ejecutó sin proveedor:
NO_DIRECT, no una conclusión científica. El SQLite inicial tiene esquema pero
no corpus experimental recuperable. Los vectores sólo tienen metadatos; no se
habilitan. Suite completa y Ruff se registran aparte: el estado inicial no es verde.

Componentes reutilizables:

| Componente | Estado comprobado / decisión |
|---|---|
| phase3 | Servicio existente; V1 por defecto. El CLI activa seis flags; evitarlo para el perfil acotado. |
| query/v2 | Contrato, validación y evaluador genérico; reutilizar. |
| query/native + services/native | Compilador RDF, clasificación y parser determinista operativos; reutilizar. |
| hierarchy | Taxonomía revisada, con procedencia; no inferir equivalencia desde SKOS. |
| ontology_navigation | Rutas tipadas y acotadas existentes; reutilizar. |
| retrieval/semantic | Embeddings e híbrido implementados; faltan vectores locales y beneficio medido. Desactivados. |
| evidence/registry | SQLite/FTS5, resolución y localizadores existentes; reutilizar en snapshot aislado. |
| investigation | Investigación acotada existente; fuera de la ruta determinista inicial. |
| scientific_synthesis | Presentación existente, no autoridad para clasificar. |
| claim_verification + grounding | Validadores existentes; no sustituyen verificación del original. |
| config | Carga .env del worktree; no se copian credenciales. |

NATIVE_V2, HIERARCHICAL_SEMANTIC_RETRIEVAL, RELATIONAL_RELATED_RETRIEVAL,
SEMANTIC_QUERY_EXPANSION y los flags de contexto están apagados por defecto;
el nuevo límite interno debe seleccionar explícitamente sólo navegación y RELATED.
No se cambia la configuración global ni se ejecuta inferencia pagada.

Ruta vertical: tablas originales verificadas → EvidenceRegistry con celdas y hashes
→ SemanticGraph con clases/relaciones aprobadas → QueryIntentV2 determinista
→ execute_native → respuesta estructurada conservadora con matriz y fuentes.
Los documentos entran como B y los catálogos como C. No se reutilizan las condiciones
de gravedad añadidas por el adaptador heredado sin anclaje local.

Puerta 0: aislamiento y ruta definidos; las incidencias de la suite heredada se deben
registrar y distinguir de los controles del incremento. No se declara aceptación
científica por importar módulos.
