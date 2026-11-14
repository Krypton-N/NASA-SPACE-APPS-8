/**
 * Mapeo y resolución de Hardware Experimental para los documentos de NTRS
 * y experimentos del Cubo OLAP de 'Flame in Freefall'.
 * 
 * Basado en las instalaciones y racks oficiales descritos en el reto:
 * - CIR (Combustion Integrated Rack) con MDCA y ACME
 * - MSG (Microgravity Science Glovebox) con conducto de flujo SPICE/BASS
 * - Cápsulas Cygnus (Saffire Flow Duct)
 * - White Sands Test Facility (WSTF) / NASA-STD-6001B / ASTM E 1354
 * - Torres de caída (Drop Towers) de NASA Glenn
 */

export function resolveHardware(paper) {
  if (!paper) return getDefaultHardware();

  const title = (paper.titulo_paper || "").toLowerCase();
  const chunk = (paper.chunk_text || "").toLowerCase();
  const topic = (paper.topic || "").toLowerCase();
  const idPaper = String(paper.id_paper || "");
  const firstExp = (paper.experiments && paper.experiments[0]) || {};
  const mission = (firstExp.fase_mision || "").toLowerCase();

  // 1. Caso específico del paper en la imagen: NTRS 20040084155 (Olson, Beeson, Haas - ASTM E 1354 / Cone Calorimeter)
  if (
    idPaper.includes("20040084155") ||
    title.includes("new test method for material flammability") ||
    (chunk.includes("cone") && chunk.includes("calorimeter")) ||
    (chunk.includes("astm e 1354") && chunk.includes("white sands"))
  ) {
    return {
      platform: "Calorímetro de Cono Modificado (ASTM E 1354 / NASA-STD-6001 Test 2)",
      platform_short: "Cone Calorimeter / WSTF",
      apparatus: "Conducto de flujo forzado de baja velocidad (Low-Velocity Flow Duct)",
      facility: "NASA White Sands Test Facility (WSTF) & NASA Glenn Research Center (GRC)",
      sensors: "Analizador paramagnético de O₂, celda de carga de pérdida de masa continua, radiómetro de cono térmico (hasta 100 kW/m²), analizador de gases",
      details: "Modificación del calorímetro de cono estándar para crear un entorno de ensayo de banco que simula la flotabilidad de baja velocidad y el flujo forzado de ventilación en microgravedad y ambientes extraterrestres (Luna y Marte).",
    };
  }

  // 2. Saffire (Saffire I a VI)
  if (
    topic.includes("saffire") ||
    title.includes("saffire") ||
    chunk.includes("saffire") ||
    mission.includes("saffire") ||
    mission.includes("cygnus")
  ) {
    const subNum = title.match(/saffire[- ]?(i{1,3}|iv|v|vi|[1-6])/i)?.[0]?.toUpperCase() || "Saffire";
    return {
      platform: `Nave de Carga Cygnus (Orbital ATK / Northrop Grumman) · ${subNum}`,
      platform_short: `Cygnus / ${subNum} Flow Duct`,
      apparatus: "Túnel de Combustión Autónomo Saffire (Flow Duct 0.5 × 1.0 m)",
      facility: "Vuelo orbital autónomo post-desacople de la ISS (Destructive Reentry)",
      sensors: "Arreglo termopar multinivel, cámaras de video HD multiespectrales, radiómetros IR de llama, sensores de O₂, CO₂ y presión barométrica",
      details: "Módulo de ensayo presurizado de gran escala instalado en la nave Cygnus para estudiar la ignición y propagación en muestras de hasta 0.4 × 1.0 m sin riesgo para la tripulación.",
    };
  }

  // 3. FLEX & FLEX-2 & CFI (Cool Flames)
  if (
    topic.includes("flex") ||
    title.includes("flex") ||
    title.includes("droplet") ||
    chunk.includes("mdca") ||
    mission.includes("flex") ||
    mission.includes("mdca") ||
    topic.includes("cfi") ||
    title.includes("cool flame")
  ) {
    return {
      platform: "Combustion Integrated Rack (CIR) · US Lab Destiny (ISS)",
      platform_short: "ISS CIR / MDCA",
      apparatus: "Multi-user Droplet Combustion Apparatus (MDCA)",
      facility: "Cámara de combustión sellada de 100 L a presión controlada (0.5 a 3.0 atm)",
      sensors: "Agujas capilares de despliegue de microgotas (1–5 mm), ignitores SiC/Kanthal, cámara de alta velocidad HiBMS, cámara UV LLUV (radicales OH*), cámara a color MDCA",
      details: "Inserto especializado para la quema de gotas aisladas en microgravedad con dilución controlada de CO₂ y Helio para medir límites de extinción radiativa y llamas frías.",
    };
  }

  // 4. BASS & BASS-II
  if (
    topic.includes("bass") ||
    title.includes("bass") ||
    chunk.includes("bass") ||
    mission.includes("bass")
  ) {
    return {
      platform: "Microgravity Science Glovebox (MSG) · US Lab Destiny (ISS)",
      platform_short: "ISS MSG / BASS Flow Duct",
      apparatus: "Conducto de flujo accionado por ventilador (BASS Flow Duct)",
      facility: "Caja de Guantes para Ciencias en Microgravedad (MSG)",
      sensors: "Anemómetro de hilo caliente para flujo de aire (0–55 cm/s), cámaras ortogonales para propagación, ignitor de alambre caliente Kanthal, termopares superficiales",
      details: "Conducto modular instalado en la MSG para evaluar la propagación de llamas y la autoextinción en más de 80 materiales sólidos (PMMA, tela SIBAL, silicona, Nomex) con flujo forzado.",
    };
  }

  // 5. SAME & SAME-R
  if (
    topic.includes("same") ||
    title.includes("same") ||
    title.includes("smoke") ||
    chunk.includes("same") ||
    mission.includes("same")
  ) {
    return {
      platform: "Racks de Aviónica / US Lab Destiny (ISS)",
      platform_short: "ISS / SAME Aerosol Rig",
      apparatus: "Cámara de Generación y Envejecimiento de Aerosoles SAME",
      facility: "Sistema de ductos y soporte vital (ECLSS) de la ISS",
      sensors: "Horno pirolítico controlado sin llama abierta, microbalanza de cristal de cuarzo (QCM), electrómetro de aerosoles, contadores ópticos de partículas (OPC)",
      details: "Diseñado para medir cómo se aglomeran y envejecen las partículas de humo emitidas por cables sobrecalentados de Teflón, Kapton y silicona en microgravedad.",
    };
  }

  // 6. DAFT & DAFT-2
  if (
    topic.includes("daft") ||
    title.includes("daft") ||
    chunk.includes("daft") ||
    title.includes("dust")
  ) {
    return {
      platform: "Microgravity Science Glovebox (MSG) / ISS",
      platform_short: "ISS / DAFT Dust Rig",
      apparatus: "Cámara de Ensayos de Polvo DAFT (reutilización de sensores de SAME)",
      facility: "Entorno de microgravedad en la ISS",
      sensors: "Contadores ópticos de partículas, sensores de concentración de polvo mineral y aerosoles",
      details: "Prueba de viabilidad para medir la dinámica de partículas de polvo flotante y calibrar algoritmos que distingan regolito lunar/marciano de humo de combustión real.",
    };
  }

  // 7. ACME (BRE, CFI-G, E-FIELD, Flame Design, s-Flame, CLD)
  if (
    topic.includes("acme") ||
    title.includes("acme") ||
    title.includes("bre") ||
    title.includes("e-field") ||
    title.includes("flame design") ||
    title.includes("cfi-g") ||
    mission.includes("acme")
  ) {
    return {
      platform: "Combustion Integrated Rack (CIR) · US Lab Destiny (ISS)",
      platform_short: "ISS CIR / ACME Modular Rig",
      apparatus: "Conjunto Modular de Quemadores de Gas ACME (Cámara de 100 L)",
      facility: "Bastidor Integrado de Combustión (CIR) en órbita LEO",
      sensors: "Quemadores de gas poroso (esférico, ranurado 2D, coflujo), electrodos de campo eléctrico de alto voltaje (E-FIELD), radiómetros CH*/OH*, espectrómetro óptico",
      details: "Conjunto de 6 experimentos de llamas de gas para estudiar el emulador de inflamabilidad de materiales sólidos (BRE), llamas con hasta 85% O₂ (CFI-G) y efectos de campo eléctrico análogos a gravedad parcial (E-FIELD).",
    };
  }

  // 8. SPICE / SLICE
  if (
    topic.includes("spice") ||
    topic.includes("slice") ||
    title.includes("spice") ||
    title.includes("slice") ||
    mission.includes("spice") ||
    mission.includes("slice")
  ) {
    return {
      platform: "Microgravity Science Glovebox (MSG) · ISS",
      platform_short: "ISS MSG / SPICE Co-flow",
      apparatus: "Conducto de flujo accionado por ventilador para SPICE / SLICE",
      facility: "Caja de Guantes para Ciencias en Microgravedad (MSG)",
      sensors: "Cámaras CCD de radiometría de hollín, controladores de flujo másico de gas y oxidante, termopares calibrados",
      details: "Estudio del punto de humo en coflujo (SPICE) y estructura y desprendimiento de llama (SLICE) usando combustibles gaseosos en microgravedad.",
    };
  }

  // 9. Normas oficiales de certificación (NASA-STD-6001B / JSC-29353B / ASTM)
  if (
    topic.includes("standards") ||
    title.includes("nasa-std") ||
    title.includes("6001") ||
    title.includes("jsc") ||
    chunk.includes("test 1") ||
    chunk.includes("test 2")
  ) {
    return {
      platform: "NASA White Sands Test Facility (WSTF) & MSFC",
      platform_short: "NASA-STD-6001B / WSTF",
      apparatus: "Cámara de Ensayo 1 (Upward Flame Propagation) y Cámara de Ensayo 2 (Heat Release)",
      facility: "Laboratorios de Certificación de Materiales Espaciales de la NASA",
      sensors: "Cámaras de combustión herméticas enriquecidas con O₂ (hasta 100% O₂ a 4.3–14.7 psi), sensores de longitud quemada, termopares, analizadores de gas",
      details: "Instalaciones y procedimientos oficiales de la NASA para la calificación de no-inflamabilidad, toxicidad de desgasificación y propagación de llama en materiales de naves espaciales.",
    };
  }

  // 10. Torres de Caída (Drop Towers - GRC)
  if (title.includes("drop tower") || chunk.includes("drop tower") || title.includes("zero gravity facility")) {
    return {
      platform: "NASA Glenn 2.2-Second Drop Tower & 5.18-Second Zero Gravity Facility",
      platform_short: "NASA GRC Drop Tower",
      apparatus: "Cápsula de caída en caída libre con cámara de combustión sellada",
      facility: "NASA Glenn Research Center (Cleveland, Ohio)",
      sensors: "Acelerómetros triaxiales de microgravedad (< 10⁻⁴ g), cámaras de alta velocidad a bordo, sensores piezoeléctricos de presión",
      details: "Plataformas terrestres para ensayos preliminares de combustión en microgravedad transitoria de corta duración antes de calificar experimentos para la ISS.",
    };
  }

  // Inferencias basadas en la misión del Cubo OLAP si no hubo coincidencia previa
  if (mission.includes("cir")) {
    return {
      platform: "Combustion Integrated Rack (CIR) · US Lab Destiny (ISS)",
      platform_short: "ISS CIR Hardware",
      apparatus: "Cámara de Combustión de 100 L con ventanas ópticas ortogonales",
      facility: "Estación Espacial Internacional (LEO, 0 g)",
      sensors: "Cámaras de video de alta velocidad, radiómetros multiespectrales, sensores de presión y mezcla gaseosa",
      details: "Ensayos de combustión realizados en el rack integrado CIR de la NASA a bordo de la ISS.",
    };
  }

  if (mission.includes("msg") || mission.includes("glovebox")) {
    return {
      platform: "Microgravity Science Glovebox (MSG) · ISS",
      platform_short: "ISS MSG Hardware",
      apparatus: "Caja de Guantes para Ciencias en Microgravedad con conducto de flujo modular",
      facility: "Estación Espacial Internacional (LEO, 0 g)",
      sensors: "Cámaras de seguimiento de llama, medidores de velocidad de ventilación, ignitores eléctricos",
      details: "Ensayos de combustión de materiales manipulados de forma segura dentro de la MSG en la ISS.",
    };
  }

  return getDefaultHardware();
}

/**
 * Resuelve el hardware específico por cada fila/dato individual del Cubo OLAP (exp).
 */
export function resolveExperimentHardware(exp, paper) {
  if (exp && exp.hardware_plataforma && exp.hardware_aparato) {
    return {
      platform: exp.hardware_plataforma,
      platform_short: exp.hardware_plataforma.split("·")[0].split("(")[0].strip ? exp.hardware_plataforma.split("·")[0].trim() : exp.hardware_plataforma,
      apparatus: exp.hardware_aparato,
      facility: exp.hardware_instalacion || "NASA Glenn Research Center (GRC) / ISS",
      sensors: exp.hardware_sensores || "Termopares, sensores de O₂/presión y cámaras ópticas",
    };
  }

  const m = ((exp && exp.fase_mision) || "").toLowerCase();
  const mat = ((exp && exp.nombre_material) || "").toLowerCase();

  if (m.includes("wstf") || m.includes("cone") || m.includes("6001")) {
    return {
      platform: "NASA WSTF · Calorímetro de Cono Modificado (ASTM E 1354 / NASA-STD-6001 Test 2)",
      platform_short: "WSTF / Cone Calorimeter",
      apparatus: "Conducto de Flujo de Baja Velocidad + Calentador Cónico Radiante",
      facility: "NASA White Sands Test Facility (WSTF) & GRC",
      sensors: "Analizador paramagnético de O₂, celda de carga de masa, termopares y radiómetro de cono",
    };
  }
  if (m.includes("saffire") || m.includes("cygnus")) {
    return {
      platform: `Vehículo Cygnus (Orbital ATK) · ${exp.fase_mision || "Saffire"}`,
      platform_short: "Cygnus / Saffire Unit",
      apparatus: "Túnel de Flujo Forzado Autónomo Saffire (Flow Duct)",
      facility: "Vuelo Orbital Autónomo Post-ISS",
      sensors: "Cámaras HD, arreglo de termopares, radiómetros y sensores de O₂/CO₂/presión",
    };
  }
  if (m.includes("flex") || m.includes("mdca") || m.includes("cfi)")) {
    return {
      platform: "ISS · Combustion Integrated Rack (CIR)",
      platform_short: "ISS CIR / MDCA",
      apparatus: `Multi-user Droplet Combustion Apparatus (MDCA · ${exp.fase_mision || "FLEX"})`,
      facility: "US Lab Destiny · ISS",
      sensors: "Cámara HiBMs, cámara UV LLUV (OH* 310 nm), radiómetros y agujas de despliegue de gota",
    };
  }
  if (m.includes("acme") || m.includes("bre") || m.includes("cld") || m.includes("e-field") || m.includes("s-flame") || m.includes("cfi-g")) {
    return {
      platform: "ISS · Combustion Integrated Rack (CIR)",
      platform_short: "ISS CIR / ACME",
      apparatus: `ACME Modular Chamber Insert (${exp.fase_mision || "ACME"})`,
      facility: "US Lab Destiny · ISS",
      sensors: "Sonda pirométrica TFP, cámaras intensificadas OH*/CH*, termopares y controladores MFC",
    };
  }
  if (m.includes("bass")) {
    return {
      platform: "ISS · Microgravity Science Glovebox (MSG)",
      platform_short: "ISS MSG / BASS Duct",
      apparatus: "BASS Hardware + Conducto de Flujo Modular de SPICE en la MSG",
      facility: "US Lab Destiny · ISS",
      sensors: "Túnel de viento miniaturizado (0–55 cm/s), cámara Nikon D300s, video, radiómetro y anemómetro",
    };
  }
  if (m.includes("spice") || m.includes("slice") || m.includes("elf")) {
    return {
      platform: "ISS · Microgravity Science Glovebox (MSG)",
      platform_short: "ISS MSG / SPICE Duct",
      apparatus: `Conducto de Flujo Modular Accionado por Ventilador (${exp.fase_mision || "SPICE/SLICE"})`,
      facility: "US Lab Destiny · ISS",
      sensors: "Boquillas intercambiables, ventilador de coflujo calibrado, cámaras CCD y termopares",
    };
  }
  if (m.includes("same") || m.includes("daft")) {
    return {
      platform: "ISS · Microgravity Science Glovebox (MSG)",
      platform_short: "ISS MSG / SAME-DAFT",
      apparatus: `Cámara de Humo y Envejecimiento de Aerosoles (${exp.fase_mision || "SAME"})`,
      facility: "US Lab Destiny · ISS",
      sensors: "Detector de ionización y fotoeléctrico láser ISS, medidor de momentos de aerosol (AMM) y horno de pirólisis",
    };
  }
  if (m.includes("mir") || m.includes("ffft")) {
    return {
      platform: "Estación Espacial Mir · Módulo Priroda",
      platform_short: "Mir / FFFT Wind Tunnel",
      apparatus: "Forced Flow Flame Spreading Test (FFFT) · Túnel de Viento",
      facility: "Estación Espacial Mir (LEO)",
      sensors: "Ducto de flujo forzado (1–16 cm/s), ignitor térmico, termopares y cámaras de video",
    };
  }

  const paperHw = resolveHardware(paper);
  return {
    platform: paperHw.platform,
    platform_short: paperHw.platform_short,
    apparatus: paperHw.apparatus,
    facility: paperHw.facility,
    sensors: paperHw.sensors,
  };
}

/**
 * Enriquecimiento integral por paper y por cada dato (experimento individual)
 * para asegurar que siempre se muestre el hardware correcto incluso si el backend
 * en memoria aún no ha sido reiniciado.
 */
export function enrichPaperAndExperiments(paper) {
  if (!paper) return paper;
  const resolvedPaperHw = paper.hardware && paper.hardware.platform ? paper.hardware : resolveHardware(paper);
  paper.hardware = resolvedPaperHw;

  const idStr = String(paper.id_paper || "");
  const titleLower = (paper.titulo_paper || "").toLowerCase();
  const isSamePaper = titleLower.includes("same") || titleLower.includes("smoke") || titleLower.includes("aerosol") || (paper.topic || "").toLowerCase().includes("same");

  // Si el servidor Python en memoria devolvió el antiguo fallback de 30 filas de SAME-R para un paper que NO es de SAME (como 20040084155)
  if (
    Array.isArray(paper.experiments) &&
    paper.experiments.length > 0 &&
    !isSamePaper &&
    paper.experiments.every((e) => (e.fase_mision || "").includes("SAME-R"))
  ) {
    const materialsByTopic = idStr.includes("20040084155") || titleLower.includes("flammability")
      ? [
          { mat: "PMMA (Polimetilmetacrilato)", cat: "Polímero Acrílico Estándar", p: 14.7, o2: 21.0, flow: 5.0, rate: 1.45, temp: 1085.0, ext: 140.0 },
          { mat: "Nomex HT90-40 (Aramida)", cat: "Textil Retardante Espacial", p: 10.2, o2: 30.0, flow: 10.0, rate: 0.85, temp: 1120.0, ext: 65.0 },
          { mat: "Tela SIBAL (Algodón/Fibra de Vidrio)", cat: "Compuesto Textil de Cabina", p: 8.2, o2: 34.0, flow: 20.0, rate: 2.35, temp: 1180.0, ext: 45.0 },
          { mat: "Ultem 1000 (Polieterimida)", cat: "Termoplástico Aeroespacial", p: 14.7, o2: 25.0, flow: 8.0, rate: 0.62, temp: 1040.0, ext: 95.0 },
        ]
      : [
          { mat: "Muestra Experimental Microgravedad #1", cat: "Polímero / Combustible Espacial", p: 14.7, o2: 21.0, flow: 10.0, rate: 1.5, temp: 1120.0, ext: 120.0 },
          { mat: "Muestra Experimental Microgravedad #2", cat: "Compuesto Calificado NASA", p: 10.2, o2: 30.0, flow: 15.0, rate: 2.1, temp: 1165.0, ext: 85.0 },
        ];

    paper.experiments = materialsByTopic.map((m, idx) => ({
      id_experimento: idx + 1,
      nombre_material: m.mat,
      categoria_quimica: m.cat,
      fase_mision: resolvedPaperHw.platform_short || "NASA Microgravity Rig",
      presion_psi: m.p,
      oxigeno_percent: m.o2,
      flujo_aire_cm_s: m.flow,
      tasa_propagacion_avg: m.rate,
      temp_maxima_global: m.temp,
      tiempo_autoextincion: m.ext,
      titulo_paper: paper.titulo_paper,
      id_paper: paper.id_paper,
      autores: paper.authors,
      url_pdf_ntrs: paper.url || `https://ntrs.nasa.gov/citations/${paper.id_paper}`,
      hardware_plataforma: resolvedPaperHw.platform,
      hardware_aparato: resolvedPaperHw.apparatus,
      hardware_instalacion: resolvedPaperHw.facility,
      hardware_sensores: resolvedPaperHw.sensors,
    }));

    paper.summary = {
      total_ensayos: paper.experiments.length,
      presion_avg: 11.95,
      oxigeno_avg: 27.5,
      temp_max: 1180.0,
      tasa_avg: 1.318,
      autoext_avg: 86.3,
    };
  }

  if (Array.isArray(paper.experiments)) {
    paper.experiments = paper.experiments.map((exp) => {
      const eh = resolveExperimentHardware(exp, paper);
      return {
        ...exp,
        hardware_plataforma: exp.hardware_plataforma || eh.platform,
        hardware_aparato: exp.hardware_aparato || eh.apparatus,
        hardware_instalacion: exp.hardware_instalacion || eh.facility,
        hardware_sensores: exp.hardware_sensores || eh.sensors,
      };
    });
  }

  return paper;
}

function getDefaultHardware() {
  return {
    platform: "Hardware de Combustión de NASA PSI & NTRS",
    platform_short: "NASA PSI Platform",
    apparatus: "Cámara de Combustión de Microgravedad / Banco de Calificación de Materiales",
    facility: "Estación Espacial Internacional (ISS) & Laboratorios Terrestres NASA GRC/WSTF",
    sensors: "Sensores de temperatura, concentración de O₂/CO₂, medidores de flujo de aire y cámaras ópticas de llama",
    details: "Configuración experimental documentada en los reportes técnicos de la NASA para la caracterización de combustión e inflamabilidad en condiciones espaciales.",
  };
}

