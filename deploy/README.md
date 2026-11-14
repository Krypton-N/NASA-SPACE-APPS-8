# Despliegue en AWS (EC2 + Caddy + Bedrock)

Primera etapa: todo en una EC2. El verificador NLI corre local y **no hay Lambda todavía**.
La Lambda NLI es la etapa 2. Antes hay que medir con `--diagnostics` (ver abajo) y aplicar los
ajustes de `docs/aws/revision_arquitectura_hibrida.md`.

## Qué llega por cada medio

| Qué | Por dónde | Dónde va en la EC2 |
|---|---|---|
| Código | Este repo (GitHub) | `/opt/flame` (`git clone`) |
| Assets de Liam (`NASA_FIRE_AI_RUNTIME_ASSETS.zip`, 678 MB, con `.sha256`) | Drive o Proton Drive | Cualquier ruta temporal; `bootstrap.sh` lo verifica y lo restaura en `research/` |
| Llaves (`research.env`, con `NVIDIA_API_KEY`) | Proton Mail | Cualquier ruta temporal; `bootstrap.sh` la copia a `/opt/flame/research/.env` (modo 600) y luego **hay que borrar la copia temporal** |

Bedrock **no** usa llaves en la EC2: usa el rol IAM de la instancia (`iam-ec2-policy.json`).

## Instalación (Ubuntu Server 24.04, arm64 o x86_64)

Recomendado: ≥ 8 GB de RAM y 30 GB de gp3. El motor usa ~3.3 GB con todo cargado.

1. **Rol IAM** con la política `deploy/iam-ec2-policy.json` (cambia `<ACCOUNT_ID>`) asociado a la instancia.
2. **Security Group:** 80 y 443 abiertos; 22 solo para las IPs del equipo. **No** abrir el 8765.
3. Clonar e instalar:
   ```bash
   sudo git clone https://github.com/Krypton-N/NASA-SPACE-APPS-8.git /opt/flame
   sudo FLAME_SITE=flameinfreefall.com bash /opt/flame/deploy/bootstrap.sh ~/NASA_FIRE_AI_RUNTIME_ASSETS.zip ~/research.env
   rm ~/research.env
   ```
   - Para una primera prueba solo por IP y sin HTTPS, omite `FLAME_SITE` (Caddy escucha en `:80`).
   - Con dominio, el registro A debe apuntar a la EIP **antes**; Caddy pide el certificado solo.
4. Revisar:
   ```bash
   bash /opt/flame/deploy/smoke_test.sh https://flameinfreefall.com
   ```
   `readiness` debe decir `"scientific_mode": "hybrid_conversational"`.

## Actualizar (cuando haya cambios en `main`)

```bash
sudo bash /opt/flame/deploy/update.sh
```

- Si solo cambió la interfaz, recompila `app/dist` sin reiniciar.
- Si cambió el motor, reinicia el servicio y se pierden las conversaciones abiertas. Evítalo
  durante la evaluación de los jueces.

## Medir antes de decidir la Lambda (etapa 2)

Mide cuánto tiempo de cada pregunta se va en NLI, búsqueda y LLM, en la máquina real:

```bash
sudo systemctl stop flame
sudo -u flame -H bash -c 'cd /opt/flame/research && set -a && . /etc/flame/flame.env && set +a && \
  .venv/bin/python scripts/serve_scientific_console.py --diagnostics /var/lib/flame/diag-$(date +%Y%m%d-%H%M)'
# Desde el navegador, haz las 5 preguntas de prueba. Luego Ctrl+C y:
sudo systemctl start flame
```

Cada `turn-NN.json` trae `chat_seconds`, `timings.nli_seconds`, `timings.retrieval_seconds` y
`provider_seconds`. Si el NLI es ≥ 50 % del tiempo, conviene la Lambda. Si es < 30 %, conviene una EC2
sin burst (por ejemplo, `m7g.large`). Los archivos incluyen las preguntas y respuestas: no los
compartas fuera del equipo.

## Comandos útiles

| Para | Comando |
|---|---|
| Ver logs del motor | `journalctl -u flame -f` |
| Reiniciar el motor | `sudo systemctl restart flame` (tarda ~20-60 s en cargar) |
| Cambiar ajustes | editar `/etc/flame/flame.env` y reiniciar |
| Logs de Caddy / HTTPS | `journalctl -u caddy -f` |
| Volver a una versión | `sudo -u flame git -C /opt/flame checkout <commit>` y luego `cd /opt/flame/app && sudo -u flame npm run build` y `sudo systemctl restart flame` |

## Problemas comunes

- **`generation: NOT_CONFIGURED` o el selector no muestra modelos de Bedrock:** falta
  `AWS_REGION` en `/etc/flame/flame.env`, o falta el rol IAM en la instancia.
- **`vector: NOT_PROVISIONED`:** falta `NVIDIA_API_KEY` en `/opt/flame/research/.env`.
- **503 "Question queue is full":** hay 8 preguntas en curso o en cola. Responde una pregunta a la vez.
- **El restaurador dice "Archivo de Git distinto":** el checkout no es el de `main` o alguien
  editó un archivo protegido de `research/`.
