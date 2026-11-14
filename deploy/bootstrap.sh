#!/usr/bin/env bash
# Instala Flame in Freefall en una EC2 con Ubuntu Server 24.04 (arm64 o x86_64).
# Se puede volver a correr: lo que ya está instalado se salta.
#
# Antes: clonar el repo en /opt/flame
#   sudo git clone https://github.com/Krypton-N/NASA-SPACE-APPS-8.git /opt/flame
# Uso:
#   sudo FLAME_SITE=flameinfreefall.com bash /opt/flame/deploy/bootstrap.sh RUTA/NASA_FIRE_AI_RUNTIME_ASSETS.zip RUTA/research.env
#   FLAME_SITE=":80" (o sin definir) sirve solo por HTTP en la IP, útil para la primera prueba.
set -euo pipefail

ASSETS_ZIP="${1:?Falta la ruta del zip de assets (NASA_FIRE_AI_RUNTIME_ASSETS.zip)}"
SECRETS_ENV="${2:?Falta la ruta del archivo de llaves (research.env)}"
SITE="${FLAME_SITE:-:80}"
ROOT=/opt/flame

[[ $EUID -eq 0 ]] || { echo "Corre este script con sudo."; exit 1; }
[[ -d $ROOT/.git ]] || { echo "Primero clona el repo en $ROOT."; exit 1; }
[[ -f $ASSETS_ZIP ]] || { echo "No encuentro $ASSETS_ZIP"; exit 1; }
[[ -f $SECRETS_ENV ]] || { echo "No encuentro $SECRETS_ENV"; exit 1; }

as_flame() { sudo -u flame -H bash -c "$*"; }

echo "== 1/8 Paquetes del sistema (git, Caddy, Node 22, uv)"
apt-get update -y
apt-get install -y git curl unzip ca-certificates gnupg debian-keyring debian-archive-keyring \
  apt-transport-https python3
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') -lt 22 ]]; then
  # Vite 8 necesita Node 22 o más nuevo.
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v uv >/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh
fi

echo "== 2/8 Usuario de servicio 'flame' y permisos"
id flame >/dev/null 2>&1 \
  || useradd --system --create-home --home-dir /var/lib/flame --shell /usr/sbin/nologin flame
chown -R flame:flame "$ROOT"
chmod 755 "$ROOT"
git config --system --get-all safe.directory | grep -qx "$ROOT" \
  || git config --system --add safe.directory "$ROOT"

echo "== 3/8 Swap de 2 GB (margen para los ~3.3 GB del motor)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 4/8 Entorno de Python del motor (uv sync --frozen)"
as_flame "cd $ROOT/research && uv sync --frozen"

echo "== 5/8 Assets de Liam: modelo NLI, snapshot y vectores (verifica SHA-256)"
install -m 644 "$ASSETS_ZIP" /tmp/flame-assets.zip
as_flame "$ROOT/research/.venv/bin/python $ROOT/scripts/restore_research_assets.py /tmp/flame-assets.zip"
rm -f /tmp/flame-assets.zip

echo "== 6/8 Llaves y ajustes"
install -m 600 -o flame -g flame "$SECRETS_ENV" "$ROOT/research/.env"
sed -i 's/\r$//' "$ROOT/research/.env"   # por si viene de Windows
install -d -m 750 -o root -g flame /etc/flame
if [[ ! -f /etc/flame/flame.env ]]; then
  install -m 640 -o root -g flame "$ROOT/deploy/flame.env.example" /etc/flame/flame.env
fi

echo "== 7/8 Frontend (npm ci + vite build -> app/dist)"
as_flame "cd $ROOT/app && npm ci --no-audit --no-fund && npm run build"

echo "== 8/8 Servicios (flame + Caddy)"
sed "s|FLAME_SITE|$SITE|" "$ROOT/deploy/Caddyfile" > /etc/caddy/Caddyfile
install -m 644 "$ROOT/deploy/flame.service" /etc/systemd/system/flame.service
systemctl daemon-reload
systemctl enable flame caddy
systemctl restart flame caddy

echo "Esperando a que cargue el motor (~20-60 s)..."
for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1:8765/api/v1/readiness >/dev/null 2>&1 && break
  sleep 3
done
bash "$ROOT/deploy/smoke_test.sh"
echo "Listo. Logs: journalctl -u flame -f"
