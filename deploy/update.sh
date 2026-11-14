#!/usr/bin/env bash
# Trae lo último de la rama actual (main) y aplica solo lo que cambió.
# Uso: sudo bash /opt/flame/deploy/update.sh
#  - Cambios de interfaz: recompila app/dist. No reinicia; nadie pierde su conversación.
#  - Cambios del motor (research/src, research/scripts, dependencias): reinicia el servicio.
set -euo pipefail
ROOT=/opt/flame
[[ $EUID -eq 0 ]] || { echo "Corre este script con sudo."; exit 1; }

as_flame() { sudo -u flame -H bash -c "cd $ROOT && $*"; }

old=$(as_flame git rev-parse HEAD)
as_flame git pull --ff-only
new=$(as_flame git rev-parse HEAD)
if [[ $old == "$new" ]]; then
  echo "Sin cambios."
  exit 0
fi
changed=$(as_flame git diff --name-only "$old" "$new")
echo "Archivos cambiados:"
echo "$changed"

if grep -q '^research/uv\.lock$\|^research/pyproject\.toml$' <<<"$changed"; then
  as_flame "cd research && uv sync --frozen"
fi

if grep -q '^app/\|^research/apps/scientific-console/' <<<"$changed"; then
  if grep -q '^app/package-lock\.json$' <<<"$changed"; then
    as_flame "cd app && npm ci --no-audit --no-fund"
  fi
  as_flame "cd app && npm run build"
  echo "Frontend actualizado (sin reiniciar)."
fi

if grep -q '^research/src/\|^research/scripts/\|^research/uv\.lock$\|^research/pyproject\.toml$' <<<"$changed"; then
  echo "Cambió el motor: reinicio (se pierden las conversaciones abiertas)."
  systemctl restart flame
  for _ in $(seq 1 60); do
    curl -fsS http://127.0.0.1:8765/api/v1/readiness >/dev/null 2>&1 && break
    sleep 3
  done
fi

if grep -q '^deploy/' <<<"$changed"; then
  echo "AVISO: cambió deploy/. Revisa si hay que volver a copiar Caddyfile, flame.service o flame.env.example."
fi

bash "$ROOT/deploy/smoke_test.sh"
