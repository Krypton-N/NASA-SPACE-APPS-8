"""Prepara las respuestas de las preguntas de ejemplo de la consola.

Corre cada pregunta de `research/apps/scientific-console/src/prompts.json` contra la API real del
motor de evidencia (misma búsqueda, verificación y capa conversacional que una pregunta en vivo) y
guarda los resultados en `app/public/data/demo-answers.json`. La consola los muestra al instante
cuando alguien abre una de esas tarjetas con el mismo modelo, marcados como "Prepared answer".

Uso (con la API corriendo):
    python scripts/precompute_demo_answers.py [--api http://127.0.0.1:8765/api/v1] [--model ID]

Sin --model usa el modelo por defecto que reporta la API. Volver a correrlo antes de la demo
si cambia el motor, los datos o el modelo por defecto.
"""

import argparse
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROMPTS = ROOT / "research/apps/scientific-console/src/prompts.json"
OUTPUT = ROOT / "app/public/data/demo-answers.json"


def call(api, path, body=None, timeout=30):
    request = urllib.request.Request(
        api + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def ask(api, question, model):
    # Same request body the console sends for a standard question.
    body = {
        "message": question,
        "detail": "standard",
        "max_queries": 2,
        "evidence_limit": 12,
        "max_output_tokens": 3000,
        "model": model,
    }
    operation = call(api, "/chat/operations", body)["operation_id"]
    while True:
        state = call(api, "/chat/operations/" + operation)
        if state["status"] in {"completed", "failed", "canceled"}:
            return state
        time.sleep(3)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--api", default="http://127.0.0.1:8765/api/v1")
    parser.add_argument("--model")
    args = parser.parse_args()

    model = args.model or call(args.api, "/models").get("default")
    if not model:
        raise SystemExit("La API no reporta un modelo disponible.")
    prompts = json.loads(PROMPTS.read_text(encoding="utf-8"))
    answers = {}
    for prompt in prompts:
        question = prompt["text"].strip()
        started = time.time()
        state = ask(args.api, question, model)
        seconds = time.time() - started
        if state["status"] != "completed":
            print(f"FALLÓ ({state['status']}) {question[:70]}")
            continue
        result = state["result"]
        verified = result.get("verification_status", {})
        interpretation = (result.get("interpretation") or {}).get("status")
        print(
            f"{seconds:5.0f}s  verificadas={verified.get('retained_claim_count')} "
            f"rechazadas={verified.get('rejected_claim_count')} interpretación={interpretation}  "
            f"{question[:70]}"
        )
        answers[question] = {"model": model, "result": result}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "model": model,
                "answers": answers,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"{len(answers)}/{len(prompts)} respuestas en {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
