# research/ — motor de evidencia (consulta)

Esta carpeta es el motor de Liam dentro del repo del equipo Flame in Freefall (NASA Space Apps 2026).
Para el hackathon solo se usa la **consulta**: API `scripts/serve_scientific_console.py` (puerto 8765)
y la consola `apps/scientific-console`, que monta `app/index.html` en la raíz del repo.

- `AGENTS.md` tiene las reglas científicas inmutables; siguen vigentes.
- `CONTINUATION.md` es la bitácora de Liam del motor de consulta (estado de validación, errores
  conocidos y causas pendientes): léela antes de cambiar la búsqueda o la verificación.
- `HANDOFF_CODEX.md` y `docs/CLAUDE_DIEGO_FASE1.md` son las instrucciones originales de Diego para la
  ingesta generalizada (rama `diego/research`); se conservan como referencia, no aplican a este repo.
- La ingesta generalizada (fase 1), la curaduría y la app de Streamlit (`app/`) son restos de otro
  trabajo: no se usan ni se modifican aquí. `app/` se conserva porque la usan pruebas de curaduría.
- Modelos de conversación: `src/nasa_fire_ai/llm/model_catalog.py` (NVIDIA API + Amazon Bedrock,
  elegido por petición con `ChatRequest.model`). Los embeddings de búsqueda siguen en NVIDIA porque
  el índice de vectores se construyó con ese modelo.
- Los archivos de `research/` se guardan sin conversión de saltos de línea (`.gitattributes` de la
  raíz): el snapshot verifica SHA-256 de código y datos. Nunca reescribas `data/raw/`, `data/snapshots/`
  ni `artifacts/hackathon/`.
- Credenciales: `research/.env` (NVIDIA) y `~/.aws` (Bedrock); nunca se suben a Git.
