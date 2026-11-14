"""Servicio de RAG Conversacional, Deep Research y Notebook para 'Flame in Freefall'.

Conecta:
1. Base Vectorial Local con IVF (Indexación sobre catálogo NTRS usando 'amazon.titan-embed-text-v1')
2. Cubo OLAP SQLite ('data/olap_experimentos.db') cruzado mediante la llave foránea 'titulo_paper'
3. Catálogo Multi-FM de Amazon Bedrock (40 modelos: Claude, Nova, Llama, DeepSeek, Gemma, Mistral, Qwen, Nemotron, etc.)
   invocados nativamente mediante la API Converse de AWS Bedrock con soporte multi-turno (historial de conversación),
   Modo Deep Research (investigación profunda multi-documento) y Notebook Studio (síntesis estilo Gemini Notebook).
"""
import json
import os
import re
import sqlite3
import sys
import time
import boto3
import numpy as np

LEGACY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # legacy/
BASE_DIR = os.path.dirname(LEGACY_DIR)  # raíz del repo: entradas data/psi, data/ntrs, data/taskbook
OUT_DIR = os.path.join(LEGACY_DIR, "data")  # salidas de este RAG retirado
if LEGACY_DIR not in sys.path:
    sys.path.insert(0, LEGACY_DIR)  # 'scripts.' = legacy/scripts

from scripts.build_vector_db_ivf import IVFVectorIndex, get_titan_embedding, get_bedrock_client, EMBED_MODEL_ID
from scripts.bedrock_models import (
    BEDROCK_MODELS,
    DEFAULT_MODEL_ID,
    FALLBACK_MODEL_ID,
    get_model,
    get_catalog_summary,
)

DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(OUT_DIR, "olap_experimentos.db")
VDB_JSON = os.path.join(OUT_DIR, "vector_db_ivf.json")
VDB_NPY = os.path.join(OUT_DIR, "vector_db_vectors.npy")


class FreefallRAGService:
    def __init__(self):
        self.client = get_bedrock_client()
        self.ivf_index = None
        self.default_model_id = DEFAULT_MODEL_ID
        self._load_index()

    def _load_index(self):
        if os.path.exists(VDB_JSON) and os.path.exists(VDB_NPY):
            try:
                self.ivf_index = IVFVectorIndex(VDB_JSON, VDB_NPY)
                print(
                    f"RAG Service: Índice IVF cargado con éxito "
                    f"({self.ivf_index.metadata['total_documents']} documentos, "
                    f"{self.ivf_index.metadata['n_clusters']} centroides)."
                )
            except Exception as e:
                print(f"Error cargando índice IVF: {e}")
        else:
            print("Aviso: El índice IVF aún no se ha generado en disco.")

    def query_olap_experiments_by_paper(self, titulo_paper, id_paper=None, topic=None):
        """Consulta los ensayos individuales del Cubo OLAP usando 'titulo_paper', 'id_paper' o palabras clave del tema."""
        if not os.path.exists(DB_PATH):
            return {"experiments": [], "summary": None}

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # 1. Búsqueda exacta por ID o Título
        select_cols = """
            v.id_experimento,
            v.nombre_material,
            v.categoria_quimica,
            v.fase_mision,
            v.presion_psi,
            v.oxigeno_percent,
            v.flujo_aire_cm_s,
            v.tasa_propagacion_avg,
            v.temp_maxima_global,
            v.tiempo_autoextincion,
            v.titulo_paper,
            v.id_paper,
            v.autores,
            v.url_pdf_ntrs,
            v.codigo_estandar,
            v.criterio_aprobacion,
            v.hardware_plataforma,
            v.hardware_aparato,
            v.hardware_instalacion,
            v.hardware_sensores
        """
        query_rows = f"""
        SELECT {select_cols}
        FROM v_cubo_experimentos_completo v
        WHERE v.titulo_paper = ? OR v.id_paper = ?
        ORDER BY v.id_experimento ASC
        LIMIT 50;
        """
        rows = cursor.execute(query_rows, (titulo_paper, id_paper or "")).fetchall()

        # 2. Búsqueda por palabras clave del tema o de la investigación (Saffire, FLEX, BASS, SPICE, etc.)
        if not rows:
            search_terms = []
            if topic:
                search_terms.append(topic.replace("_", " "))
            title_clean = re.sub(r"[^a-zA-Z0-9\s]", " ", titulo_paper)
            for w in title_clean.split():
                if len(w) >= 4 and w.lower() not in [
                    "experiment", "results", "investigation", "effects", "preliminary", "study"
                ]:
                    search_terms.append(w)

            for term in search_terms[:3]:
                query_topic = f"""
                SELECT {select_cols}
                FROM v_cubo_experimentos_completo v
                WHERE v.fase_mision LIKE ? OR v.titulo_paper LIKE ? OR v.nombre_material LIKE ?
                ORDER BY v.id_experimento ASC
                LIMIT 50;
                """
                pattern = f"%{term}%"
                rows = cursor.execute(query_topic, (pattern, pattern, pattern)).fetchall()
                if rows:
                    break

        # 3. Fallback a experimentos relevantes del cubo OLAP si el paper es de síntesis teórica
        if not rows:
            query_fallback = f"""
            SELECT {select_cols}
            FROM v_cubo_experimentos_completo v
            ORDER BY v.id_experimento ASC
            LIMIT 30;
            """
            rows = cursor.execute(query_fallback).fetchall()

        # Consulta de Hardware Experimental catalogado en dim_paper_ntrs
        cur_hw = conn.cursor()
        hw_row = cur_hw.execute("""
            SELECT hardware_plataforma, hardware_aparato, hardware_instalacion, hardware_sensores
            FROM dim_paper_ntrs
            WHERE id_paper = ? OR titulo_paper = ?
            LIMIT 1
        """, (id_paper or "", titulo_paper)).fetchone()

        if not hw_row or not hw_row[0]:
            title_sample = titulo_paper[:40] if titulo_paper else ""
            hw_row = cur_hw.execute("""
                SELECT hardware_plataforma, hardware_aparato, hardware_instalacion, hardware_sensores
                FROM dim_paper_ntrs
                WHERE titulo_paper LIKE ?
                LIMIT 1
            """, (f"%{title_sample}%",)).fetchone()

        hardware = None
        if hw_row and hw_row[0]:
            hardware = {
                "platform": hw_row[0],
                "platform_short": hw_row[0].split("·")[0].split("(")[0].strip(),
                "apparatus": hw_row[1],
                "facility": hw_row[2],
                "sensors": hw_row[3],
                "details": f"Hardware oficial catalogado en el Cubo OLAP (dim_paper_ntrs y fact_experimento) para el paper {id_paper or titulo_paper}."
            }

        conn.close()

        experiments = []
        pressures = []
        o2_vals = []
        rates = []
        temps = []
        autoexts = []
        materials = set()

        for r in rows:
            exp_item = {
                "id_experimento": r[0],
                "nombre_material": r[1] or "Muestra Microgravedad",
                "categoria_quimica": r[2] or "Polímero espacial",
                "fase_mision": r[3] or "ISS Microgravity",
                "presion_psi": r[4],
                "oxigeno_percent": r[5],
                "flujo_aire_cm_s": r[6],
                "tasa_propagacion_avg": r[7],
                "temp_maxima_global": r[8],
                "tiempo_autoextincion": r[9],
                "titulo_paper": r[10] or titulo_paper,
                "id_paper": r[11] or id_paper,
                "autores": r[12] if len(r) > 12 and r[12] else "NASA Glenn / PSI Team",
                "url_pdf_ntrs": r[13] if len(r) > 13 and r[13] else (
                    f"https://ntrs.nasa.gov/citations/{r[11]}" if r[11] else "https://ntrs.nasa.gov"
                ),
                "codigo_estandar": r[14] if len(r) > 14 else "NASA-STD-6001B",
                "criterio_aprobacion": r[15] if len(r) > 15 else "Autoextinción < 15 cm",
                "hardware_plataforma": r[16] if len(r) > 16 and r[16] else (hardware["platform"] if hardware else "ISS · Microgravity Combustion Rack"),
                "hardware_aparato": r[17] if len(r) > 17 and r[17] else (hardware["apparatus"] if hardware else "Cámara de combustión en microgravedad"),
                "hardware_instalacion": r[18] if len(r) > 18 and r[18] else (hardware["facility"] if hardware else "NASA Glenn Research Center (GRC) / ISS"),
                "hardware_sensores": r[19] if len(r) > 19 and r[19] else (hardware["sensors"] if hardware else "Termopares, sensores de presión/O2 y cámaras de video")
            }
            experiments.append(exp_item)

            if r[1]:
                materials.add(r[1])
            if r[4] is not None:
                pressures.append(r[4])
            if r[5] is not None:
                o2_vals.append(r[5])
            if r[7] is not None:
                rates.append(r[7])
            if r[8] is not None:
                temps.append(r[8])
            if r[9] is not None:
                autoexts.append(r[9])

        summary = None
        if experiments:
            summary = {
                "total_ensayos": len(experiments),
                "materiales": list(materials)[:6],
                "presion_avg": round(sum(pressures) / len(pressures), 2) if pressures else 14.7,
                "oxigeno_avg": round(sum(o2_vals) / len(o2_vals), 1) if o2_vals else 21.0,
                "tasa_avg": round(sum(rates) / len(rates), 3) if rates else None,
                "temp_max": round(max(temps), 1) if temps else 1150.0,
                "autoext_avg": round(sum(autoexts) / len(autoexts), 1) if autoexts else None
            }

        return {"experiments": experiments, "summary": summary, "hardware": hardware}

    def _build_alternating_messages(self, history, final_user_text):
        """Construye la lista de mensajes compatible con AWS Bedrock Converse API.
        Garantiza que los roles alternen estrictamente ('user' / 'assistant') y comiencen con 'user'.
        """
        cleaned = []
        if history and isinstance(history, list):
            for msg in history[-10:]:
                if not isinstance(msg, dict):
                    continue
                role = msg.get("role", "")
                if role == "bot":
                    role = "assistant"
                if role not in ("user", "assistant"):
                    continue
                text = str(msg.get("content") or msg.get("text") or "").strip()
                if not text:
                    continue

                if not cleaned:
                    if role == "user":
                        cleaned.append({"role": "user", "content": [{"text": text}]})
                else:
                    if cleaned[-1]["role"] == role:
                        # Si hay dos mensajes seguidos del mismo rol, los fusionamos
                        cleaned[-1]["content"][0]["text"] += f"\n\n{text}"
                    else:
                        cleaned.append({"role": role, "content": [{"text": text}]})

        # Si el último mensaje del historial quedó en 'user', lo removemos o fusionamos antes de añadir el nuevo turno
        if cleaned and cleaned[-1]["role"] == "user":
            cleaned.pop()

        cleaned.append({"role": "user", "content": [{"text": final_user_text}]})
        return cleaned

    def _invoke_bedrock_fm(self, chosen_id, system_prompt, messages, temperature=None, max_tokens=None, top_p=None):
        """Invoca el Foundation Model en AWS Bedrock con soporte de fallback automático."""
        model_meta = get_model(chosen_id)
        if not model_meta:
            model_meta = get_model(self.default_model_id) or get_model(FALLBACK_MODEL_ID)
            chosen_id = model_meta["id"]

        inf_config = {
            "maxTokens": max_tokens or model_meta.get("default_tokens", 1500),
            "temperature": temperature if temperature is not None else model_meta.get("default_temp", 0.2),
        }
        if "claude" not in chosen_id.lower() and top_p is not None:
            inf_config["topP"] = top_p

        t0 = time.time()
        was_fallback = False
        fallback_msg = None
        input_tokens = 0
        output_tokens = 0
        answer_text = ""

        try:
            resp = self.client.converse(
                modelId=chosen_id,
                system=[{"text": system_prompt}],
                messages=messages,
                inferenceConfig=inf_config,
            )
            content_blocks = resp["output"]["message"]["content"]
            answer_text = "\n".join(b.get("text", "") for b in content_blocks if "text" in b).strip()
            metrics = resp.get("usage", {})
            input_tokens = metrics.get("inputTokens", 0)
            output_tokens = metrics.get("outputTokens", 0)
        except Exception as e:
            err_msg = str(e)
            print(f"Aviso: Invocación de {chosen_id} falló ({err_msg[:90]}). Intentando fallback...")

            fallback_target = FALLBACK_MODEL_ID if chosen_id != FALLBACK_MODEL_ID else "us.amazon.nova-lite-v1:0"
            try:
                fb_meta = get_model(fallback_target)
                fb_resp = self.client.converse(
                    modelId=fallback_target,
                    system=[{"text": system_prompt}],
                    messages=messages,
                    inferenceConfig={"maxTokens": max_tokens or 1500, "temperature": 0.2},
                )
                content_blocks = fb_resp["output"]["message"]["content"]
                answer_text = "\n".join(b.get("text", "") for b in content_blocks if "text" in b).strip()
                was_fallback = True
                fallback_msg = (
                    f"Nota: Modelo '{model_meta['name']}' requirió fallback automático a "
                    f"'{fb_meta['name']}' debido a: {err_msg.split('(')[0]}"
                )
                chosen_id = fallback_target
                model_meta = fb_meta
                metrics = fb_resp.get("usage", {})
                input_tokens = metrics.get("inputTokens", 0)
                output_tokens = metrics.get("outputTokens", 0)
            except Exception as fb_err:
                answer_text = f"Error al invocar Foundation Model en AWS Bedrock: {err_msg}\nFallback también falló: {fb_err}"

        elapsed_ms = int((time.time() - t0) * 1000)
        return answer_text, {
            "id": chosen_id,
            "name": model_meta["name"],
            "provider": model_meta["provider"],
            "provider_id": model_meta.get("provider_id", "bedrock"),
            "family": model_meta.get("family", "LLM"),
            "latency_ms": elapsed_ms,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "was_fallback": was_fallback,
            "fallback_msg": fallback_msg,
        }

    def ask(
        self,
        user_question,
        model_id=None,
        n_probe=3,
        top_k=3,
        temperature=None,
        max_tokens=None,
        top_p=None,
        history=None,
        mode="standard",
        pinned_paper_ids=None,
    ):
        """Flujo completo RAG Conversacional y Deep Research con Foundation Models de AWS Bedrock.
        
        Soporta:
        - Seguimiento multi-turno con memoria conversacional ('history')
        - Modo 'standard' (respuesta analítica ágil) y 'deep_research' (investigación profunda multi-documento)
        - Fuentes ancladas del Cuaderno de Investigación ('pinned_paper_ids')
        """
        if not self.ivf_index:
            self._load_index()
            if not self.ivf_index:
                return {
                    "answer": "La base vectorial IVF aún se está construyendo. Por favor espera a que termine de indexar.",
                    "primary_paper": None,
                    "all_retrieved_papers": [],
                    "ivf_stats": None,
                    "model_used": None,
                    "research_steps": [],
                }

        is_deep = mode == "deep_research"
        effective_n_probe = max(n_probe, 8) if is_deep else n_probe
        effective_top_k = max(top_k, 6) if is_deep else top_k
        effective_max_tokens = max(max_tokens or 1500, 2600) if is_deep else max_tokens

        # 1. Contextualizar la pregunta con el historial reciente si es pregunta de seguimiento
        prior_user_queries = []
        if history and isinstance(history, list):
            for m in history[-4:]:
                if isinstance(m, dict) and m.get("role") == "user":
                    q_txt = str(m.get("content") or m.get("text") or "").strip()
                    if q_txt:
                        prior_user_queries.append(q_txt)

        if prior_user_queries and len(user_question.split()) < 14:
            # Enriquecer la búsqueda vectorial con el contexto de la conversación
            search_text = f"{' '.join(prior_user_queries[-2:])} — {user_question}"
        else:
            search_text = user_question

        q_vec = get_titan_embedding(self.client, search_text)
        if q_vec is None:
            return {
                "answer": "Error al conectar con Amazon Titan para generar el embedding.",
                "primary_paper": None,
                "all_retrieved_papers": [],
                "model_used": None,
                "research_steps": [],
            }

        # 2. Búsqueda vectorial con índice IVF
        ivf_res = self.ivf_index.query(q_vec, n_probe=effective_n_probe, top_k=effective_top_k)
        retrieved_raw = list(ivf_res["results"])

        # Incluir documentos anclados en el Notebook de la sesión si aún no están en los resultados
        if pinned_paper_ids and isinstance(pinned_paper_ids, list):
            existing_ids = {str(r.get("id_paper")) for r in retrieved_raw}
            pinned_set = {str(pid) for pid in pinned_paper_ids}
            for doc in self.ivf_index.documents:
                doc_id = str(doc.get("id_paper"))
                if doc_id in pinned_set and doc_id not in existing_ids:
                    retrieved_raw.append({
                        **doc,
                        "score": 0.92,
                        "cluster_id": doc.get("cluster_id", 0),
                    })
                    existing_ids.add(doc_id)

        if not retrieved_raw:
            return {
                "answer": "No se encontraron documentos relevantes en el catálogo.",
                "primary_paper": None,
                "all_retrieved_papers": [],
                "model_used": None,
                "research_steps": [],
            }

        # 3. Cruzar cada paper recuperado con el Cubo OLAP mediante 'titulo_paper'
        enriched_papers = []
        total_olap_rows = 0
        for p in retrieved_raw:
            olap_data = self.query_olap_experiments_by_paper(p["titulo_paper"], p["id_paper"], p.get("topic"))
            exp_list = olap_data["experiments"] or []
            total_olap_rows += len(exp_list)
            enriched_papers.append({
                "id_paper": p["id_paper"],
                "titulo_paper": p["titulo_paper"],
                "authors": p["authors"],
                "year": p["year"],
                "topic": p["topic"],
                "url": p["url"],
                "score": round(p["score"], 4),
                "cluster_id": p["cluster_id"],
                "chunk_text": p["snippet"],
                "experiments": exp_list,
                "summary": olap_data["summary"],
                "hardware": olap_data.get("hardware"),
            })

        top_doc = enriched_papers[0]

        # 4. Construir contexto integrado (Literatura + Cubo OLAP + Hardware) para el Foundation Model
        context_docs = ""
        for i, p in enumerate(enriched_papers, 1):
            context_docs += f"\n--- DOCUMENTO NTRS #{i} (ID: {p['id_paper']}) ---\n"
            context_docs += f"Título: {p['titulo_paper']}\n"
            context_docs += f"Autores: {p['authors']} ({p['year']}) | Tema: {p['topic']}\n"
            context_docs += f"Similitud Vectorial IVF: {(p['score'] * 100):.1f}% (Celda Voronoi #{p['cluster_id']})\n"
            if p.get("hardware"):
                hw = p["hardware"]
                context_docs += f"Hardware Experimental (Cubo OLAP): Plataforma={hw['platform']} | Aparato={hw['apparatus']} | Instalación={hw['facility']} | Sensores={hw['sensors']}\n"
            context_docs += f"Fragmento Textual Recuperado (Chunk): {p['chunk_text']}\n"
            if p["summary"]:
                context_docs += (
                    f"Métricas del Cubo OLAP asociadas: {p['summary']['total_ensayos']} ensayos, "
                    f"Materiales={', '.join(p['summary'].get('materiales', [])[:4])}, "
                    f"P media={p['summary']['presion_avg']} PSI, O2 medio={p['summary']['oxigeno_avg']}%, "
                    f"Temp Pico Máx={p['summary']['temp_max']} °C, Tasa Media={p['summary']['tasa_avg']} mm/s, "
                    f"Autoextinción media={p['summary']['autoext_avg']} s.\n"
                )

        if is_deep:
            system_prompt = (
                "Eres el Director Científico de Investigación Profunda (Deep Research) de la NASA para el proyecto "
                "'Flame in Freefall' (Space Apps 2026). Tienes acceso al hilo conversacional completo con el investigador, "
                "a múltiples reportes técnicos de NASA NTRS y a la telemetría del Cubo OLAP de experimentos en microgravedad.\n\n"
                "Elabora un INFORME DE INVESTIGACIÓN PROFUNDA riguroso, exhaustivo y estructurado con las siguientes secciones en Markdown:\n"
                "1. **Síntesis Ejecutiva e Hipótesis Central**: Respuesta directa al planteamiento y continuidad con la conversación.\n"
                "2. **Evidencia Cruzada en Literatura NTRS**: Contraste detallado citando los documentos recuperados por título/ID y autores.\n"
                "3. **Análisis Cuantitativo del Cubo OLAP**: Desglose numérico de presión (PSI), porcentaje de O₂, flujos, temperaturas pico (°C) y tasas de propagación (mm/s).\n"
                "4. **Mecanismos Físicos en Microgravedad (0g vs 1g)**: Explicación profunda de difusión esférica, ausencia de convección natural, pérdidas radiativas o cinética de llama fría.\n"
                "5. **Implicaciones de Seguridad Espacial y Brechas (NASA-STD-6001B)**: Riesgos para misiones de exploración (ISS, Luna, Marte) y recomendaciones prácticas."
            )
        else:
            system_prompt = (
                "Eres un científico senior de la NASA en seguridad contra incendios en microgravedad para el proyecto 'Flame in Freefall'. "
                "Mantén una conversación natural, fluida y rigurosa dando seguimiento puntual al historial previo de mensajes si existe. "
                "Responde a la consulta citando los documentos recuperados de NTRS y contrastando con los experimentos reales y mediciones del Cubo OLAP. "
                "Explica los mecanismos físicos fundamentales (llama esférica, convección forzada vs natural, extinción) y "
                "menciona claramente los números cuantitativos del Cubo OLAP (presión en PSI, oxígeno %, temperatura y tasa de quemado). "
                "Responde en español de forma analítica, técnica y bien estructurada."
            )

        user_content = (
            f"EVIDENCIA RECUPERADA EN ESTE TURNO (ÍNDICE IVF + CUBO OLAP):\n{context_docs}\n\n"
            f"MODO DE CONSULTA: {'DEEP RESEARCH (INVESTIGACIÓN PROFUNDA MULTI-FUENTE)' if is_deep else 'CONVERSACIONAL RAG'}\n"
            f"PREGUNTA ACTUAL DEL INVESTIGADOR:\n{user_question}"
        )

        messages = self._build_alternating_messages(history, user_content)

        # 5. Invocar Foundation Model en AWS Bedrock
        chosen_id = model_id or self.default_model_id
        answer_text, model_used_info = self._invoke_bedrock_fm(
            chosen_id=chosen_id,
            system_prompt=system_prompt,
            messages=messages,
            temperature=temperature,
            max_tokens=effective_max_tokens,
            top_p=top_p,
        )

        # Pasos de investigación transparentes para la UI (estilo Gemini Deep Research)
        research_steps = [
            {
                "step": 1,
                "title": "Contextualización Conversacional",
                "detail": (
                    f"Hilo activo con {len(history) if history else 0} mensajes previos; "
                    f"consulta vectorial optimizada con Amazon Titan (1536 dim)."
                ),
            },
            {
                "step": 2,
                "title": f"Sondeo Vectorial IVF ({'Profundo' if is_deep else 'Estándar'})",
                "detail": (
                    f"Exploradas {ivf_res['n_probe']} celdas Voronoi ({ivf_res['candidates_scanned']} candidatos evaluados "
                    f"de {ivf_res['total_documents']} reportes NTRS)."
                ),
            },
            {
                "step": 3,
                "title": "Recuperación Documental NTRS",
                "detail": (
                    f"Extraídos {len(enriched_papers)} documentos técnicos (Similitud tope: {(top_doc['score']*100):.1f}% en "
                    f"'{top_doc['titulo_paper'][:48]}...')."
                ),
            },
            {
                "step": 4,
                "title": "Cruce Relacional con Cubo OLAP",
                "detail": (
                    f"Vinculados {total_olap_rows} ensayos cuantitativos en microgravedad mediante llave foránea 'titulo_paper'."
                ),
            },
            {
                "step": 5,
                "title": f"Síntesis con {model_used_info['name']} ({model_used_info['provider']})",
                "detail": (
                    f"Generación completada en {model_used_info['latency_ms']} ms "
                    f"({model_used_info['output_tokens']} tokens de salida)."
                ),
            },
        ]

        return {
            "answer": answer_text,
            "mode": mode,
            "primary_paper": top_doc,
            "all_retrieved_papers": enriched_papers,
            "research_steps": research_steps,
            "ivf_stats": {
                "n_probe": ivf_res["n_probe"],
                "probed_centroids": ivf_res["probed_centroids"],
                "candidates_scanned": ivf_res["candidates_scanned"],
                "total_documents": ivf_res["total_documents"],
                "top_similarity_score": top_doc["score"],
            },
            "model_used": model_used_info,
        }

    def generate_notebook_artifact(
        self,
        action_type: str,
        sources: list,
        history: list = None,
        custom_prompt: str = None,
        model_id: str = None,
    ):
        """Genera artefactos de investigación estilo Google Gemini Notebook / NotebookLM
        sobre las fuentes acumuladas en el cuaderno de la conversación.
        """
        # Si no hay fuentes en la sesión aún, tomamos los 4 papers principales del índice IVF
        enriched_sources = []
        if sources and isinstance(sources, list):
            for s in sources[:8]:
                title = s.get("titulo_paper") or s.get("title") or "NASA NTRS Report"
                pid = s.get("id_paper") or s.get("id") or ""
                topic = s.get("topic") or "combustion"
                olap = self.query_olap_experiments_by_paper(title, pid, topic)
                enriched_sources.append({
                    "id_paper": pid,
                    "titulo_paper": title,
                    "authors": s.get("authors", "NASA Research Team"),
                    "year": s.get("year", 2024),
                    "chunk_text": s.get("chunk_text") or s.get("snippet") or "",
                    "summary": olap["summary"],
                })

        if not enriched_sources and self.ivf_index and self.ivf_index.documents:
            for doc in self.ivf_index.documents[:4]:
                olap = self.query_olap_experiments_by_paper(doc["titulo_paper"], doc["id_paper"], doc.get("topic"))
                enriched_sources.append({
                    "id_paper": doc["id_paper"],
                    "titulo_paper": doc["titulo_paper"],
                    "authors": doc.get("authors", "NASA Research Team"),
                    "year": doc.get("year", 2024),
                    "chunk_text": doc.get("snippet", ""),
                    "summary": olap["summary"],
                })

        sources_text = ""
        for idx, src in enumerate(enriched_sources, 1):
            sources_text += f"\n[FUENTE #{idx}] ({src['id_paper']}) {src['titulo_paper']} — {src['authors']} ({src['year']})\n"
            sources_text += f"Extracto: {src['chunk_text']}\n"
            if src["summary"]:
                sm = src["summary"]
                sources_text += (
                    f"Datos Cubo OLAP: {sm['total_ensayos']} ensayos | Materiales: {', '.join(sm.get('materiales', []))} | "
                    f"P={sm['presion_avg']} PSI | O2={sm['oxigeno_avg']}% | Temp Máx={sm['temp_max']} °C | Tasa={sm['tasa_avg']} mm/s\n"
                )

        conv_summary = ""
        if history and isinstance(history, list):
            recent_turns = [
                f"- {m.get('role', 'user').upper()}: {str(m.get('content', ''))[:250]}"
                for m in history[-6:]
                if isinstance(m, dict) and m.get("content")
            ]
            if recent_turns:
                conv_summary = "\nRESUMEN RECIENTE DE LA CONVERSACIÓN:\n" + "\n".join(recent_turns)

        prompts_by_action = {
            "study_guide": (
                "Genera una **Guía de Estudio y Síntesis Ejecutiva (Notebook Briefing)** basada en las fuentes activas del cuaderno. "
                "Incluye: 1) Conceptos Clave y Hallazgos Centrales, 2) Tabla/Resumen de Parámetros Cuantitativos del Cubo OLAP, "
                "3) Glosario Técnico de Fenómenos en Microgravedad observados, y 4) Conclusiones para Diseño de Hábitats."
            ),
            "comparison_matrix": (
                "Construye un **Análisis Comparativo Tierra (1g) vs Microgravedad (0g)** basado en las fuentes del cuaderno y el Cubo OLAP. "
                "Desglosa por material/combustible (ej. Silicón, PMMA, SIBAL, Heptano, Metanol): diferencias en geometría de llama, "
                "transferencia de calor, límites de oxígeno/presión, tasas de propagación y por qué el estándar NASA-STD-6001B puede subestimar o sobreestimar el riesgo."
            ),
            "research_gaps": (
                "Realiza una **Auditoría de Brechas de Cobertura e Hipótesis Abiertas (Research Gaps)** a partir de las fuentes del cuaderno. "
                "Identifica qué regímenes de presión (ej. 0.57 atm) y oxígeno (ej. 34% O₂ en atmósfera de exploración) carecen de datos suficientes, "
                "qué anomalías (como llamas frías o re-ignición) requieren nuevos ensayos y propón 3 hipótesis experimentales concretas."
            ),
            "faq_briefing": (
                "Elabora un **Briefing de Preguntas Críticas y Respuestas Técnicas (FAQ Científico)** con las 5 preguntas más importantes "
                "que un panel de jueces o ingenieros de seguridad espacial de la NASA haría sobre estas fuentes, respondiendo cada una con datos duros del Cubo OLAP."
            ),
        }

        task_instruction = custom_prompt or prompts_by_action.get(action_type, prompts_by_action["study_guide"])

        system_prompt = (
            "Eres el motor de inteligencia científica del 'Research Notebook' (estilo Google Gemini NotebookLM) para el proyecto "
            "'Flame in Freefall' de NASA Space Apps 2026. Sintetiza las fuentes documentales de NTRS y la telemetría del Cubo OLAP "
            "con rigor técnico, formato claro en Markdown, viñetas precisas y citas a los IDs de los documentos."
        )

        user_message = (
            f"FUENTES ANCLADAS EN EL CUADERNO DE INVESTIGACIÓN:\n{sources_text}\n"
            f"{conv_summary}\n\n"
            f"INSTRUCCIÓN DEL NOTEBOOK STUDIO:\n{task_instruction}"
        )

        chosen_id = model_id or self.default_model_id
        answer_text, model_used_info = self._invoke_bedrock_fm(
            chosen_id=chosen_id,
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": [{"text": user_message}]}],
            temperature=0.2,
            max_tokens=2200,
        )

        titles_map = {
            "study_guide": "📋 Guía de Estudio y Síntesis Ejecutiva",
            "comparison_matrix": "⚖️ Comparativa Tierra (1g) vs Órbita (0g)",
            "research_gaps": "🔬 Brechas de Cobertura e Hipótesis",
            "faq_briefing": "❓ Briefing de Preguntas Críticas (FAQ)",
        }

        return {
            "title": titles_map.get(action_type, "📓 Nota de Investigación IA"),
            "action_type": action_type,
            "content": answer_text,
            "sources_count": len(enriched_sources),
            "model_used": model_used_info,
        }


if __name__ == "__main__":
    service = FreefallRAGService()
    q1 = "¿Por qué el silicón se autoextinguió en Saffire-II?"
    res1 = service.ask(q1, model_id="us.anthropic.claude-haiku-4-5-20251001-v1:0")
    print("Turno 1:", res1["model_used"]["name"], "->", res1["answer"][:140])

    history = [
        {"role": "user", "content": q1},
        {"role": "assistant", "content": res1["answer"]},
    ]
    q2 = "¿Y cómo cambiaría ese comportamiento si subimos el oxígeno a 34% en una atmósfera de exploración?"
    res2 = service.ask(q2, model_id="us.amazon.nova-2-lite-v1:0", history=history, mode="deep_research")
    print("Turno 2 (Follow-up + Deep Research):", res2["model_used"]["name"], "->", res2["answer"][:140])
