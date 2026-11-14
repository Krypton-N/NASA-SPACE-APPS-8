"""De dónde sale cada dato: ficha de cada investigación de PSI y sus publicaciones, enlazadas a NTRS."""
import csv, json, os, re

from .common import BASE, PSI, TABLE_NOTES, parse_date, read_table, table_path

PSI_URL = "https://psi.nasa.gov/physci/repo/data/studies/{}"

# Qué contiene la tabla experimental de cada investigación.
TABLE_KIND = {
    "PSI-69": "ensayos", "PSI-159": "ensayos", "PSI-107": "ensayos", "PSI-98": "ensayos", "PSI-99": "ensayos",
    "PSI-100": "ensayos", "PSI-25": "ensayos", "PSI-101": "ensayos", "PSI-102": "ensayos",
    "PSI-39": "condiciones", "PSI-10": "condiciones", "PSI-26": "condiciones", "PSI-47": "condiciones",
    "PSI-20": "bitacora", "PSI-21": "bitacora", "PSI-22": "bitacora", "PSI-23": "bitacora", "PSI-106": "bitacora",
    "PSI-68": "matriz_de_diseno", "PSI-142": "indice_de_figuras",
}
# Carpeta temática de data/ntrs con los papers relacionados.
NTRS_TOPIC = {
    "PSI-69": "flex", "PSI-68": "flex", "PSI-39": "droplet_coolflame", "PSI-142": "droplet_coolflame",
    "PSI-117": "droplet_coolflame", "PSI-10": "acme", "PSI-159": "acme", "PSI-20": "acme", "PSI-21": "acme",
    "PSI-22": "acme", "PSI-23": "acme", "PSI-107": "spice_slice", "PSI-106": "spice_slice", "PSI-60": "spice_slice",
    "PSI-26": "bass", "PSI-25": "bass", "PSI-62": "bass", "PSI-98": "saffire", "PSI-99": "saffire",
    "PSI-100": "saffire", "PSI-102": "same_smoke", "PSI-101": "same_smoke", "PSI-115": "same_smoke",
    "PSI-47": "detection_atmosphere",
}

# Hardware experimental por investigación PSI (Rack/Plataforma, Aparato/Cámara, Instrumentación/Sensores)
HARDWARE_BY_ACCESSION = {
    "PSI-69": (
        "ISS · Combustion Integrated Rack (CIR)",
        "Multi-user Droplet Combustion Apparatus (MDCA) · Chamber Insert Assembly (CIA)",
        "Cámara HiBMs (retroiluminación de gota), cámara LLUV (OH* 310 nm), radiómetros de banda ancha y estrecha, agujas de despliegue y electrodos de chispa",
    ),
    "PSI-68": (
        "ISS · Combustion Integrated Rack (CIR)",
        "Multi-user Droplet Combustion Apparatus (MDCA) · Configuración FLEX-2",
        "Cámaras HiBMs y LLUV de alta resolución, agujas piezoeléctricas duales, radiómetros para gotas binarias y arreglos de gotas",
    ),
    "PSI-39": (
        "ISS · Combustion Integrated Rack (CIR)",
        "Multi-user Droplet Combustion Apparatus (MDCA) · Cool Flames Investigation (CFI)",
        "Gota soportada en fibra de cuarzo SiC (80 μm), intensificador UV/CH* para llama fría invisible (500–800 K) y radiómetros infrarrojos",
    ),
    "PSI-142": (
        "ISS · Combustion Integrated Rack (CIR)",
        "Multi-user Droplet Combustion Apparatus (MDCA) · FLEX-2J (Japón/JAXA)",
        "Cámaras ópticas de alta velocidad, radiómetros térmicos y sistema de traslación lineal de gota en el MDCA",
    ),
    "PSI-117": (
        "ISS · Combustion Integrated Rack (CIR)",
        "Multi-user Droplet Combustion Apparatus (MDCA) · FLEX Italian Combustion Experiment (FLEX-ICE-GA)",
        "Cámaras HiBMs y LLUV, radiómetros y agujas de despliegue para biocombustibles y alcoholes superiores",
    ),
    "PSI-10": (
        "ISS · Combustion Integrated Rack (CIR)",
        "ACME Chamber Insert · Quemador Coaxial de Gas (CFI-G)",
        "Sonda pirométrica de filamento delgado (TFP de SiC), cámaras intensificadas UV/visibles (OH*/CH*), termopares tipo R/S y MFCs",
    ),
    "PSI-159": (
        "ISS · Combustion Integrated Rack (CIR)",
        "ACME Chamber Insert · Quemador Coaxial en Atmósfera Enriquecida (CFI-G Inverse)",
        "Sonda TFP, cámaras intensificadas para llamas inversas (O2 en chorro, combustible en cámara hasta 85% O2) y radiómetros",
    ),
    "PSI-20": (
        "ISS · Combustion Integrated Rack (CIR)",
        "ACME Chamber Insert · Burning Rate Emulator (BRE)",
        "Quemador plano de bronce poroso (25–50 mm) con flujo de gas controlado que emula calor de vaporización de polímeros y telas, radiómetros y termopares",
    ),
    "PSI-21": (
        "ISS · Combustion Integrated Rack (CIR)",
        "ACME Chamber Insert · Coflow Laminar Diffusion Flame (CLD Flame)",
        "Quemador coaxial laminar en coflujo, cámara color de alta resolución, extinción de luz por hollín y pirómetros ópticos",
    ),
    "PSI-22": (
        "ISS · Combustion Integrated Rack (CIR)",
        "ACME Chamber Insert · Electric-Field Effects on Laminar Diffusion Flames (E-FIELD)",
        "Quemador de difusión con malla de alto voltaje (±10 kV) para convección iónica en 0 g, amperímetro de corriente iónica y cámaras",
    ),
    "PSI-23": (
        "ISS · Combustion Integrated Rack (CIR)",
        "ACME Chamber Insert · Spherical Flame (s-Flame)",
        "Quemador esférico poroso para llamas de difusión esféricas, radiómetros espectrales, termopares y cámaras para oscilaciones radiativas",
    ),
    "PSI-107": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "Conducto de Flujo Modular Accionado por Ventilador (SPICE Flow Duct)",
        "Boquillas intercambiables (1.6, 2.4 y 4.1 mm), ventilador de coflujo calibrado, cámara de video para altura de punto de humo y termopares",
    ),
    "PSI-106": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "Conducto de Flujo Modular Accionado por Ventilador (SLICE / SPICE Hardware)",
        "Quemadores de chorro en coflujo, filtros interferenciales CH*/OH*/C2*, cámaras digitales y termopares para estructura y liftoff de llama",
    ),
    "PSI-60": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "Enclosed Laminar Flames (ELF) Hardware en la MSG",
        "Túnel de flujo laminar cerrado con ventilador regulado en la MSG, quemador coaxial de gas, termopares y cámara de video",
    ),
    "PSI-26": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "BASS Hardware + Conducto de Flujo Modular de SPICE en la MSG",
        "Túnel de viento miniaturizado (0 a 55 cm/s), cámara de imagen fija Nikon D300s, cámara de video, radiómetro y anemómetro de hilo caliente",
    ),
    "PSI-25": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "BASS-II Hardware + Conducto de Flujo Modular de SPICE en la MSG",
        "Portamuestras para películas, placas (PMMA), barras, esferas y textiles (SIBAL/Nomex), ignitor Kanthal, sensores de O2/CO2/CO y cámaras",
    ),
    "PSI-62": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "BASS-M (Milliken) + Conducto de Flujo Modular en la MSG",
        "Cámara de flujo forzado en la MSG para textiles tratados con retardantes de llama, ignitor térmico y cámaras de video",
    ),
    "PSI-98": (
        "Vehículo de Carga Cygnus (Orbital ATK OA-6) · Vuelo Autónomo Post-ISS",
        "Módulo Experimental Saffire-I (94 × 133 cm) con túnel de flujo forzado",
        "Muestra a gran escala de tela SIBAL (0.4 × 1.0 m), arreglo de termopares, radiómetros, sensores de O2/CO2/presión y cámaras HD",
    ),
    "PSI-99": (
        "Vehículo de Carga Cygnus (Orbital ATK OA-5) · Vuelo Autónomo Post-ISS",
        "Módulo Experimental Saffire-II con carrusel de 9 muestras (5 × 30 cm)",
        "Cámaras de video con iluminación LED verde estroboscópica, termopares, radiómetros y sensores ambientales (PMMA, SIBAL, silicón, Nomex)",
    ),
    "PSI-100": (
        "Vehículo de Carga Cygnus (Orbital ATK OA-7) · Vuelo Autónomo Post-ISS",
        "Módulo Experimental Saffire-III con ducto de flujo variable",
        "Muestra grande de tela SIBAL a 20 y 30 cm/s, arreglo denso de termopares, sensores de O2/CO2 y cámaras HD",
    ),
    "PSI-102": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "Cámara de Envejecimiento y Generación de Humo SAME (Smoke Point / Aerosol Chamber)",
        "Detector de ionización (Americio-241) y fotoeléctrico láser de la ISS, medidor de momentos de aerosol (AMM), precipitador térmico y pirólisis (Teflon, Kapton, silicón)",
    ),
    "PSI-101": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "Cámara de Humo y Envejecimiento SAME-R (Re-flight)",
        "Detectores de humo de cabina ISS/Orion, analizador de tamaño de partículas, ventilador de mezcla primaria y portamuestras térmicos",
    ),
    "PSI-115": (
        "ISS · Microgravity Science Glovebox (MSG)",
        "Hardware SAME reutilizado para DAFT (Dust and Aerosol Measurement Feasibility Test)",
        "Inyector de polvo calibrado, detectores de humo de la ISS y monitor óptico de aerosoles reutilizado de SAME",
    ),
    "PSI-47": (
        "Estación Espacial Mir · Módulo Priroda / Túnel de Vuelo",
        "Forced Flow Flame Spreading Test (FFFT) · Túnel de Viento en Microgravedad",
        "Ducto de flujo forzado a baja velocidad (1 a 16 cm/s) para muestras de celulosa y polietileno, ignitor de alambre caliente, termopares y cámaras",
    ),
}


def _norm(t):
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()


def _doi_url(doi):
    doi = (doi or "").strip()
    if not doi:
        return None
    return doi if doi.startswith("http") else f"https://doi.org/{doi}"


def _index():
    return list(csv.DictReader(open(os.path.join(PSI, "psi_index.csv"), encoding="utf-8")))


def _investigation(folder):
    return json.load(open(os.path.join(PSI, folder, "investigation.json"), encoding="utf-8"))


def campaigns(stats, names):
    """stats: accession -> {family, rows, flagged, excluded}; names: accession -> nombre corto."""
    out = []
    for r in _index():
        acc = r["accession"]
        inv = _investigation(r["folder"])
        s = stats.get(acc, {})
        hw = HARDWARE_BY_ACCESSION.get(acc, (
            "ISS · Microgravity Combustion Rack",
            "Cámara Experimental PSI",
            "Sensores térmicos, ópticos y de presión/O2",
        ))
        out.append({
            "accession": acc, "campaign": names.get(acc) or r["acronym"] or acc, "title": r["title"],
            "family": s.get("family"), "table_kind": TABLE_KIND.get(acc, "sin_tabla"),
            "hardware_rack": hw[0], "hardware_apparatus": hw[1], "hardware_sensors": hw[2],
            "n_rows": s.get("rows", 0), "n_flagged": s.get("flagged", 0), "n_excluded": s.get("excluded", 0),
            "sub_area": inv.get("subResearchArea") or None, "mission": inv.get("missionName") or None,
            "start": parse_date(inv.get("investigationStartDate"), "%m-%d-%Y"),
            "end": parse_date(inv.get("investigationEndDate"), "%m-%d-%Y"),
            "doi": r["doi"] or None, "doi_url": _doi_url(r["doi"]), "psi_url": PSI_URL.format(acc),
            "ntrs_topic": NTRS_TOPIC.get(acc), "n_publications": len(inv.get("publications") or []),
            "table_notes": " | ".join(TABLE_NOTES.get(acc, [])) or None,
        })
    return out


def publications():
    ntrs = {_norm(c["title"]): c for c in csv.DictReader(open(os.path.join(BASE, "data", "ntrs", "catalog.csv"),
                                                                encoding="utf-8"))}
    out = []
    for r in _index():
        acc = r["accession"]
        hw = HARDWARE_BY_ACCESSION.get(acc, (
            "ISS · Microgravity Combustion Rack",
            "Cámara Experimental PSI",
            "Sensores térmicos, ópticos y de presión/O2",
        ))
        for p in _investigation(r["folder"]).get("publications") or []:
            hit = ntrs.get(_norm(p.get("title")))
            out.append({"accession": acc, "title": (p.get("title") or "").strip() or None,
                        "authors": (p.get("authorList") or "").strip() or None, "doi": p.get("doi") or None,
                        "doi_url": _doi_url(p.get("doi")), "ntrs_id": hit["id"] if hit else None,
                        "ntrs_url": hit["url"] if hit else None,
                        "hardware_rack": (hit.get("hardware_plataforma") if hit else None) or hw[0],
                        "hardware_apparatus": (hit.get("hardware_aparato") if hit else None) or hw[1],
                        "hardware_sensors": (hit.get("hardware_sensores") if hit else None) or hw[2],
                        "origin": "investigation.json"})
    # PSI-142 no trae ensayos: su tabla es un índice figura -> publicación. Se aprovecha como fuente.
    hw_142 = HARDWARE_BY_ACCESSION["PSI-142"]
    rows, _, _ = read_table(table_path("PSI-142"))
    for x in rows:
        out.append({"accession": "PSI-142", "title": f"{x['Data Description']} (fig. {x['Figure ID in Reference']})",
                    "authors": None, "doi": None, "doi_url": x["Reference Publication Link"], "ntrs_id": None,
                    "ntrs_url": None,
                    "hardware_rack": hw_142[0], "hardware_apparatus": hw_142[1], "hardware_sensors": hw_142[2],
                    "origin": "tabla_experimental"})
    return out
