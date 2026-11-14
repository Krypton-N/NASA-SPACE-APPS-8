# legacy/ — asistente RAG anterior (retirado)

Primer asistente del equipo, reemplazado el 14 nov 2026 por el motor de evidencia de Liam
(`research/`). Se conserva para consulta e historial; la app ya no lo usa.

| Carpeta | Qué hay | Autor |
|---|---|---|
| `scripts/build_olap_cube.py`, `query_cube.py` | Cubo OLAP en SQLite (esquema estrella sobre PSI, NTRS, Task Book) y visor HTML | Luis |
| `scripts/build_vector_db_ivf.py` | Índice IVF con un vector por documento NTRS (Amazon Titan, 1536 dim) | Luis |
| `scripts/rag_service.py`, `rag_api_server.py`, `bedrock_models.py` | API RAG en el puerto 5005 con catálogo de modelos de Amazon Bedrock, multi-turno y Deep Research | Rodrigo |
| `app/` | Pestaña Asistente (`rag.js`), biblioteca de evidencia, vista "Cómo funciona" y la entrada anterior de la app | equipo |
| `data/` | Salidas generadas: `olap_experimentos.db`, `vector_db_*`, `embeddings_cache.json`, `visor_cubo_olap.html` | — |

**Por qué se retiró.** Recupera documentos completos (un vector por paper, con los primeros ~1 500
caracteres) y deja que el LLM redacte sin verificar contra la fuente; además depende de credenciales
de AWS. El motor de `research/` busca por pasaje (FTS5 + vectores + grafo RDF), conserva valores y
unidades originales y verifica cada afirmación contra el texto citado, sin conexión.

Los scripts siguen funcionando si alguien los necesita: leen las entradas de la raíz (`data/psi`,
`data/ntrs`, `data/taskbook`) y escriben en `legacy/data/`. El RAG necesita credenciales de AWS Bedrock.

```bash
python legacy/scripts/build_olap_cube.py
python legacy/scripts/rag_api_server.py
```

`app/` ya no compila por sí sola: era la entrada de la app anterior y sus vistas importan módulos de
`app/src/`. Para verla completa, usa el historial de Git (commit `3669cd4`).
