"""Servidor API REST para el Asistente RAG Conversacional, Deep Research y Notebook con Amazon Bedrock.

Ejecuta un servidor FastAPI con soporte CORS para comunicarse con el frontend
de la aplicación web ('Flame in Freefall') de NASA Space Apps 2026.

Capacidades integradas:
- Catálogo de 40 Foundation Models en AWS Bedrock (Claude, Nova, Llama 4, DeepSeek, Gemma, Mistral, Qwen, Nemotron, etc.)
- Memoria conversacional multi-turno (seguimiento de preguntas estilo Gemini / Claude)
- Modo Deep Research (Investigación profunda multi-documento con trazabilidad de pasos)
- Notebook Studio (Generación de guías de estudio, matrices 1g vs 0g, brechas e hipótesis sobre fuentes acumuladas)
- Persistencia de sesiones de conversación e investigaciones

Uso:
    python scripts/rag_api_server.py
"""
import json
import os
import sys
import uvicorn
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

LEGACY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # legacy/
BASE_DIR = os.path.dirname(LEGACY_DIR)  # raíz del repo: entradas data/psi, data/ntrs, data/taskbook
OUT_DIR = os.path.join(LEGACY_DIR, "data")  # salidas de este RAG retirado
if LEGACY_DIR not in sys.path:
    sys.path.insert(0, LEGACY_DIR)  # 'scripts.' = legacy/scripts

from scripts.rag_service import FreefallRAGService, EMBED_MODEL_ID
from scripts.bedrock_models import (
    BEDROCK_MODELS,
    DEFAULT_MODEL_ID,
    get_catalog_summary,
    get_model,
)

CONVERSATIONS_FILE = os.path.join(OUT_DIR, "conversations_store.json")

app = FastAPI(
    title="Flame in Freefall — Amazon Bedrock Conversational RAG & Notebook API",
    description="API de síntesis científica conversacional, Deep Research y Notebook con Foundation Models de Bedrock, IVF y Cubo OLAP",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service: Optional[FreefallRAGService] = None


def get_service() -> FreefallRAGService:
    global rag_service
    if rag_service is None:
        rag_service = FreefallRAGService()
    return rag_service


class QueryRequest(BaseModel):
    question: str = Field(..., description="Pregunta del usuario sobre combustión o microgravedad")
    model_id: Optional[str] = Field(None, description="ID o perfil del Foundation Model de Bedrock a utilizar")
    n_probe: int = Field(3, description="Número de clusters Voronoi a explorar en el índice IVF")
    top_k: int = Field(3, description="Número de documentos principales a recuperar")
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0, description="Temperatura de muestreo")
    max_tokens: Optional[int] = Field(None, ge=100, le=4096, description="Límite máximo de tokens generados")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-P nucleus sampling")
    history: Optional[List[Dict[str, Any]]] = Field(default=None, description="Historial de mensajes previos de la conversación")
    mode: Optional[str] = Field("standard", description="Modo de ejecución: 'standard' o 'deep_research'")
    pinned_paper_ids: Optional[List[str]] = Field(default=None, description="IDs de documentos NTRS fijados en el Notebook")


class NotebookActionRequest(BaseModel):
    action_type: str = Field("study_guide", description="Tipo de síntesis: study_guide, comparison_matrix, research_gaps, faq_briefing")
    sources: Optional[List[Dict[str, Any]]] = Field(default=None, description="Fuentes activas en el cuaderno de investigación")
    history: Optional[List[Dict[str, Any]]] = Field(default=None, description="Historial reciente de la conversación")
    custom_prompt: Optional[str] = Field(default=None, description="Instrucción personalizada sobre las fuentes del cuaderno")
    model_id: Optional[str] = Field(default=None, description="ID del Foundation Model de Bedrock a utilizar")


@app.get("/api/rag/status")
def get_status():
    """Estado general del servicio RAG, embeddings y catálogo Bedrock."""
    service = get_service()
    has_ivf = service.ivf_index is not None
    summary = get_catalog_summary()
    return {
        "status": "online",
        "embedding_model": EMBED_MODEL_ID,
        "active_llm_model": service.default_model_id,
        "total_available_fms": summary["total_models"],
        "verified_fms": summary["verified_models"],
        "providers_count": len(summary["providers"]),
        "providers": summary["providers"],
        "ivf_index_loaded": has_ivf,
        "total_documents": len(service.ivf_index.documents) if has_ivf else 0,
        "n_clusters": service.ivf_index.metadata.get("n_clusters", 0) if has_ivf else 0,
        "foreign_key": "titulo_paper",
        "olap_database": "data/olap_experimentos.db",
        "features": ["multi_turn_memory", "deep_research", "gemini_notebook_studio"],
    }


@app.get("/api/rag/models")
def get_bedrock_models():
    """Retorna el catálogo completo de Foundation Models de Bedrock disponibles."""
    return get_catalog_summary()


@app.get("/api/rag/sample_prompts")
def get_sample_prompts():
    """Preguntas científicas sugeridas de prueba para la evaluación del reto."""
    return [
        {
            "id": 1,
            "title": "Silicón en Saffire-II vs Tierra",
            "prompt": "¿Por qué el silicón se autoextinguió en microgravedad durante Saffire-II mientras ardió completo en las pruebas en la Tierra?",
            "recommended_model": "us.anthropic.claude-sonnet-4-6",
            "focus": "Mecanismos de pérdida radiativa y extinción sin boyamiento",
        },
        {
            "id": 2,
            "title": "Gotas de Heptano y Llama Fría (FLEX)",
            "prompt": "¿Qué observó el experimento FLEX en la ISS sobre la extinción de gotas de heptano y la presencia de llama fría?",
            "recommended_model": "us.deepseek.r1-v1:0",
            "focus": "Cinética química de baja temperatura y ley d²",
        },
        {
            "id": 3,
            "title": "Atmósfera de Exploración (34% O₂)",
            "prompt": "¿Qué riesgo existe en la atmósfera propuesta para misiones de exploración a 0.57 atm y 34% de oxígeno según los ensayos de NASA?",
            "recommended_model": "us.amazon.nova-pro-v1:0",
            "focus": "Huecos de cobertura y seguridad de hábitats",
        },
        {
            "id": 4,
            "title": "Tela SIBAL vs PMMA Acrílico",
            "prompt": "¿Cómo se compara la velocidad de propagación de la tela SIBAL frente al PMMA acrílico en flujo forzado de 20 cm/s en órbita?",
            "recommended_model": "us.meta.llama4-maverick-17b-instruct-v1:0",
            "focus": "Convección forzada en sólidos",
        },
        {
            "id": 5,
            "title": "Certificación NASA-STD-6001B Test 1",
            "prompt": "¿Cuáles son las limitaciones del Test 1 de NASA-STD-6001B al predecir la inflamabilidad de materiales en microgravedad real?",
            "recommended_model": "qwen.qwen3-32b-v1:0",
            "focus": "Estándares y pruebas de calificación de vuelo",
        },
    ]


@app.post("/api/rag/query")
def run_rag_query(req: QueryRequest):
    """Ejecuta consulta RAG conversacional o Deep Research: IVF (Titan) + Cubo OLAP + FM de Amazon Bedrock."""
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    service = get_service()
    try:
        response = service.ask(
            user_question=req.question.strip(),
            model_id=req.model_id,
            n_probe=req.n_probe,
            top_k=req.top_k,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            top_p=req.top_p,
            history=req.history,
            mode=req.mode or "standard",
            pinned_paper_ids=req.pinned_paper_ids,
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando RAG en Bedrock: {str(e)}")


@app.post("/api/rag/notebook")
def run_notebook_studio(req: NotebookActionRequest):
    """Genera una guía de estudio, matriz comparativa o análisis profundo sobre las fuentes del Notebook."""
    service = get_service()
    try:
        result = service.generate_notebook_artifact(
            action_type=req.action_type,
            sources=req.sources or [],
            history=req.history or [],
            custom_prompt=req.custom_prompt,
            model_id=req.model_id,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando artefacto del Notebook: {str(e)}")


def main():
    print("Iniciando Servidor RAG Conversacional & Notebook con Bedrock en http://127.0.0.1:5005 ...")
    uvicorn.run("scripts.rag_api_server:app", host="127.0.0.1", port=5005, reload=False)


if __name__ == "__main__":
    main()
