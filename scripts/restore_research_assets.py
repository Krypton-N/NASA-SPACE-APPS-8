"""Restaura los assets de ejecución del motor de Liam (research/) desde su ZIP.

El script original (research/scripts/runtime_assets.py restore) exige que HEAD sea el
commit exacto del release de Liam, cosa que no se cumple dentro de este repo. Este
script hace lo mismo sin esa condición:

  1. comprueba el SHA-256 del ZIP contra el que entregó Liam;
  2. comprueba cada archivo del ZIP contra SHA256SUMS y el manifiesto;
  3. comprueba que los archivos de Git que el release necesita sean idénticos;
  4. extrae solo lo que falta, sin sobrescribir nada distinto.

Uso:
    python scripts/restore_research_assets.py RUTA/NASA_FIRE_AI_RUNTIME_ASSETS.zip
"""

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "research"
ZIP_SHA256 = "2016683040221ad0eee813a3aba63ac9ab10767ddf0573d4f6f79e52a381a774"


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("archive", type=Path)
    parser.add_argument("--sha256", default=ZIP_SHA256)
    args = parser.parse_args()

    print("Verificando SHA-256 del ZIP (1.2 GB, tarda un poco)...")
    if sha256_file(args.archive) != args.sha256:
        sys.exit("El ZIP no coincide con el SHA-256 esperado.")

    with ZipFile(args.archive) as archive:
        sums = {}
        for line in archive.read("SHA256SUMS").decode().splitlines():
            digest, name = line.split(maxsplit=1)
            sums[name.lstrip("*")] = digest
        manifest = json.loads(archive.read("RUNTIME_ASSET_MANIFEST.json"))

        missing = []
        for row in manifest["required_git_files"]:
            path = RESEARCH / row["path"]
            if not path.is_file():
                missing.append(row["path"])
            elif sha256_file(path) != row["sha256"]:
                sys.exit("Archivo de Git distinto al del release: research/" + row["path"])
        if missing:
            print("AVISO: faltan archivos de Git que el backend verifica al arrancar:")
            for name in missing:
                print("   research/" + name)
            print("Los assets se restauran igual, pero el backend no arrancará sin ellos.")

        for row in manifest["files"]:
            name = row["path"]
            if sums.get(name) != row["sha256"]:
                sys.exit("Manifiesto y SHA256SUMS no coinciden: " + name)
            target = (RESEARCH / name).resolve()
            if not target.is_relative_to(RESEARCH.resolve()):
                sys.exit("Ruta fuera de research/: " + name)
            if target.exists():
                if sha256_file(target) != row["sha256"]:
                    sys.exit("Ya existe un archivo distinto: research/" + name)
                print("ya estaba  ", name)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(name) as src, open(target, "xb") as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
            if sha256_file(target) != row["sha256"]:
                target.unlink()
                sys.exit("El archivo extraído no coincide: " + name)
            print("restaurado ", name)
    print("Listo.")


if __name__ == "__main__":
    main()
