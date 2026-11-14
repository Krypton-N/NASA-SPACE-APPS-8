# Resultado de fases 0–2 — 2026-11-05

## Fase 0: aceptada

Worktree existente `.worktrees/NASA_hackathon`, rama `NASA_hackathon`, base
`941d34c`, coincidente con el remoto research consultado. Main y research no se
modificaron. Sin push, merges, claves copiadas, llamadas LLM ni proveedores nuevos.
Se leyeron reglas, contratos, continuidad y PDF de transferencia. ZIP no localizado.
La página del desafío devolvió 502; no se presupone validación reglamentaria del evento.

`uv sync`, status y consulta inicial ejecutados. La consulta inicial se abstuvo.
Se identificó un índice vacío; se reutilizaron las tablas de procedencia y el contexto
locales mediante lectura de main, sin copiar vectores ni cachés de modelos.
Auditoría y ruta vertical: `phase0.md`. Commit `6e71971`.

## Fase 1: aceptada para el corpus acotado

Snapshot `4e1a3278e25ea2c1d6400b93a89b76979fbb22fb33c201795d1a4d39604773ba`.
8 fuentes A, 7 B y 24 C.
A comprende siete tablas de corridas y una de especímenes; B, seis PDF y la tabla
de configuraciones FLEX-2; C, 24 fichas PSI del equipo. No son 39 investigaciones
independientes. El grafo tiene nueve identidades de investigación, incluidos los
registros de campaña. Los catálogos no acreditan resultados.

646 registros de corrida, 654 descripciones de muestra,
1577 valores respaldados y 582 páginas documentales;
44490 triples. Estos recuentos no son especímenes físicos distintos ni
observaciones nuevas. No se promocionaron configuraciones a mediciones NASA.

Se preservaron 48 archivos nuevos con bytes verificados también contra Git.
Reutilización de EvidenceRegistry, SemanticRegistry, RDF, celdas y round_trip.
Los valores canónicos añaden normalización sin sustituir originales. Se conservaron
rangos, aproximaciones, ausencias y modalidad derivada en la columna Saffire-II
que remite a Note 1. Notas y cámaras quedan fuera de las corridas.
Importación idempotente y segunda construcción con hashes idénticos comprobadas.
Código, originales y manifiesto: commit `7560d33`.

## Fase 2: funcional; aceptación global pendiente

`ScientificSearchService.search` y `scripts/search_science.py` funcionan sin API.
Reutilizan QueryIntentV2 y execute_native. Navegan relaciones aprobadas y recuperan
subclases reales de condiciones a través de ExperimentalCondition. Comparan corridas,
filtran fuentes antes de ranking y separan DIRECT, RELATED, DISCOVERY y DOCUMENTARY.
Devuelven matrices, localizadores, evidencia, rutas, razones, límites y snapshot.
No se habilitaron vectores ni expansión semántica sin beneficio medido.

227 pruebas del incremento y regresiones relevantes pasaron; el último control del
snapshot pasó 30 pruebas y los cuatro guardias B8 pasaron 50. Ruff global pasó.
Los conjuntos se superponen: no se suman. No se añadieron skips ni se modificó gold.
La suite completa inicial, ejecutada por lotes para acotar temporales, dio 3431 passed,
13 failed, 23 errors y 40 skips heredados. Los 13 fallos de índices ausentes se
resolvieron reutilizando los índices locales y se reejecutaron sus archivos.
Los 23 errores restantes corresponden al binario histórico ausente indicado abajo.
La primera ejecución sin lotes llenó el disco y se interrumpió; no cuenta como pass.

13 consultas medidas; 86 evidencias verificadas por bytes y localizadores, sin errores
de reconstrucción. Cero DIRECT en los diez casos que debían abstenerse. Mediana
415.4 ms, máximo 2629.8 ms. Mediciones locales con otras pruebas
concurrentes; no acreditan mejora, precisión general ni adjudicación científica experta.
Código del motor y controles: commit `2f09aa9`. Recibos: `query_measurements.json`,
`test_results.json`, `snapshot_manifest.json` y `legacy_index_reuse.json`.

## Límite y mínima intervención para cerrar

Restaurar el original `artifacts/phase3c_real_context_evidence_v1.sqlite`,
365543424 bytes, SHA-256
`b038f8ba09d48419b724f3bd516c6881f46d4c18a7d654a3391691b71e862977`.
Ningún SQLite local coincide. No se reconstruyó una copia distinta bajo ese nombre
ni se alteraron las pruebas para ocultar el bloqueo. Después corresponde reejecutar
las 23 pruebas y la suite completa. Por AGENTS.md no se declara cerrado el encargo.

Task Book no está ingerido; ACME tiene sólo catálogo. Faltan taxonomías revisadas
de materiales y relaciones de fenómenos suficientes para resolver toda pregunta
estructuralmente. Las consultas nuevas recuperan texto y conservan lo no resuelto;
no se rellenan esos huecos con conocimiento general. Los flags QC del equipo se
preservan en sus archivos y no se han aplicado a los valores crudos del snapshot.
No hay frontend, simulador, nueva API HTTP ni integración de síntesis Nemotron.

Operación reproducible: `docs/HACKATHON_ENGINE.md`.
