# Arranca la demo completa de Flame in Freefall:
#   1. motor de evidencia de Liam (API en http://127.0.0.1:8765), en una ventana aparte;
#   2. app web (consola científica + simuladores) en http://localhost:5173.
#
# Uso (desde la raíz del repo):
#   .\start_demo.ps1            # con NVIDIA si research\.env tiene NVIDIA_API_KEY; si no, sin conexión
#   .\start_demo.ps1 -Offline   # fuerza sin conexión: búsqueda, registros, grafo y solo fragmentos de fuente
#
# Sin llave, el asistente no redacta ni verifica respuestas (solo muestra fragmentos). Para la demo:
#   copy research\.env.example research\.env   y llena NVIDIA_API_KEY (research\.env no se sube a Git).
#
# Antes, una sola vez:
#   python scripts\restore_research_assets.py RUTA\NASA_FIRE_AI_RUNTIME_ASSETS.zip
#   (cd research; uv sync --frozen)   y   (cd app; npm install)
param([switch]$Offline)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

foreach ($need in @("research\data\snapshots\hackathon-20261112-scientific-rc14\evidence.sqlite",
                    "research\artifacts\hackathon\official_tables.json")) {
  if (-not (Test-Path (Join-Path $root $need))) {
    Write-Warning "Falta $need. Sin eso la API responde 503: revisa research\README y los assets de Liam."
  }
}

$envFile = Join-Path $root "research\.env"
$hasKey = (Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^\s*NVIDIA_API_KEY\s*=\s*\S' -Quiet)
$hasAws = Test-Path (Join-Path $HOME ".aws\credentials")
if (-not $Offline -and -not $hasKey -and $hasAws) {
  Write-Warning "Sin NVIDIA_API_KEY: el asistente usará solo modelos de Amazon Bedrock y la búsqueda sin vectores."
} elseif (-not $Offline -and -not $hasKey) {
  Write-Warning "Sin NVIDIA_API_KEY ni credenciales de AWS: arranco sin conexión (el asistente solo mostrará fragmentos)."
  $Offline = $true
}
if (-not $Offline) {
  Write-Host "Modo en línea: modelos de NVIDIA y/o Amazon Bedrock (elige en el asistente) + verificador NLI local."
  $serve = "`$env:PYTHONUTF8='1'; `$env:NASA_SCIENTIFIC_LLM_PROVIDER='nvidia'; uv run python scripts/serve_scientific_console.py"
} else {
  $serve = "`$env:PYTHONUTF8='1'; uv run python scripts/serve_scientific_console.py --offline"
}
Start-Process powershell -WorkingDirectory (Join-Path $root "research") `
  -ArgumentList "-NoExit", "-Command", $serve | Out-Null
Write-Host "API de evidencia arrancando en otra ventana (la primera carga tarda ~1 min)."

Set-Location (Join-Path $root "app")
if (-not (Test-Path "node_modules")) { npm install }
npm run dev
