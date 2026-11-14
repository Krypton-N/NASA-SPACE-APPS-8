#!/usr/bin/env bash
# Prueba rápida del despliegue.
# Uso: bash /opt/flame/deploy/smoke_test.sh [https://tu-dominio]
# Sin argumento prueba solo el motor en 127.0.0.1:8765; con URL prueba también Caddy y el frontend.
set -uo pipefail
API=http://127.0.0.1:8765/api/v1
fail=0

check() {
  local name=$1 url=$2 out
  if out=$(curl -fsS --max-time 120 "$url"); then
    echo "OK     $name: ${out:0:200}"
  else
    echo "FALLA  $name ($url)"
    fail=1
  fi
}

check health "$API/health"
check readiness "$API/readiness"
check models "$API/models"
check resolve "$API/resolve?query=flame%20spread"

ready=$(curl -fsS --max-time 120 "$API/readiness" 2>/dev/null || true)
if [[ $ready != *hybrid_conversational* ]]; then
  echo "AVISO  el motor está en modo 'partial': revisa en /readiness qué falta"
  echo "       (vector -> NVIDIA_API_KEY; generation -> Bedrock/AWS_REGION; semantic_verifier -> modelo NLI)."
fi

if [[ -n ${1:-} ]]; then
  check frontend "$1/"
  check lab "$1/lab.html"
  check proxy-api "$1/api/v1/health"
  check demo-answers "$1/data/demo-answers.json"
fi

[[ $fail -eq 0 ]] && echo "Todo bien." || { echo "Hubo fallas."; exit 1; }
