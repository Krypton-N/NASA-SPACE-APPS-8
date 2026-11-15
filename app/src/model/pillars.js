/**
 * Los Tres Pilares de la Seguridad contra Incendios en la Exploración Espacial.
 * Alineado con la doctrina oficial de la NASA: Prevención, Detección y Supresión,
 * conectando las 24 investigaciones de PSI, estándares y recomendaciones para Artemis y Marte.
 */

export const PILLARS = [
  {
    id: "prevencion",
    name: "1. Prevención",
    tagline: "Control de Ignición y Selección de Materiales",
    badge: "Primera Línea de Defensa",
    icon: "prevention",
    summary:
      "Evitar que el fuego se inicie mediante el control riguroso de fuentes térmicas y la selección de materiales certificados para atmósferas enriquecidas con oxígeno.",
    challenge_title: "El desafío: La paradoja de 1 g frente a microgravedad",
    challenge_text:
      "En la Tierra, los materiales se certifican quemándolos verticalmente hacia arriba según NASA-STD-6001B (Test 1). Sin embargo, en caída libre no hay flotabilidad natural ascendente. Con ventilación forzada tan baja como 2 a 10 cm/s, materiales que en la Tierra se autoextinguen pueden arder vigorosamente en órbita, mientras que otros (como el silicón) se extinguen por pérdida radiativa.",
    investigations: [
      {
        name: "Saffire-I, II y III",
        code: "PSI-98, 99, 100",
        detail:
          "Ensayos a gran escala en vehículos de carga Cygnus no tripulados. Demostraron que la tela SIBAL propagó llamas por más de 29 cm en microgravedad con flujo forzado, mientras que el silicón se autoextinguió sin boyamiento.",
      },
      {
        name: "BASS & BASS-II",
        code: "PSI-29, 30",
        detail:
          "Más de 80 materiales sólidos (PMMA, Nomex, algodón, velas) probados en la Microgravity Science Glovebox (MSG). Mapearon la velocidad mínima de flujo para sostener la llama.",
      },
      {
        name: "ACME BRE (Burning Rate Emulator)",
        code: "PSI-102",
        detail:
          "Usó quemadores de gas poroso para emular el comportamiento térmico y la inflamabilidad de materiales sólidos en atmósferas en reposo sin necesidad de quemar muestras complejas.",
      },
      {
        name: "NASA-STD-6001B & JSC-29353B",
        code: "Estándares Oficiales",
        detail:
          "Normas que rigen la inflamabilidad, toxicidad y desgasificación de materiales para hábitats tripulados de la NASA.",
      },
    ],
    metric_highlight: {
      num: "29 cm",
      label: "Propagación de llama en tela SIBAL en órbita con flujo forzado (Saffire-II)",
      sub: "En contraste, la silicona se autoextinguió en microgravedad tras arder completamente en 1 g.",
    },
    recommendation:
      "No confiar únicamente en certificaciones verticales en 1 g para hábitats lunares. Evaluar el Índice de Oxígeno Límite (LOI) y el flujo forzado de ventilación de cabina.",
  },
  {
    id: "deteccion",
    name: "2. Detección",
    tagline: "Física del Humo y Falsas Alarmas por Polvo",
    badge: "Alerta Temprana en Cabina",
    icon: "detection",
    summary:
      "Identificar partículas de pirólisis y aerosoles antes de que surja una llama abierta, discriminando entre humo real y polvo abrasivo exterior.",
    challenge_title: "El desafío: El humo no sube y el polvo confunde",
    challenge_text:
      "En microgravedad el aire caliente no flota hacia el techo: los detectores de humo convencionales de techo son completamente inútiles en una nave espacial. Además, en la Luna y Marte los astronautas introducirán polvo fino de regolito en sus trajes. Los detectores deben distinguir entre partículas de humo de cableado recalentado y polvo mineral para evitar falsas alarmas que activen extintores a 130,000 km de la Tierra.",
    investigations: [
      {
        name: "SAME & SAME-R",
        code: "PSI-37, 38",
        detail:
          "Experimento de Medición de Humo y Aerosoles en la ISS. Analizó cómo envejecen y se aglomeran las partículas de humo emitidas por Teflón, Kapton y cables sobrecalentados.",
      },
      {
        name: "DAFT & DAFT-2",
        code: "PSI-51, 52",
        detail:
          "Dust and Aerosol Feasibility Test. Reutilizó el hardware de SAME para medir la dinámica del polvo en microgravedad, demostrando la necesidad de algoritmos que distingan polvo de humo.",
      },
      {
        name: "Sensores de Ductos ECLSS",
        code: "Sistemas de Cabina",
        detail:
          "Ubicación obligatoria de sensores ópticos e ionizantes directamente en las rejillas de retorno y filtros del sistema de soporte vital.",
      },
    ],
    metric_highlight: {
      num: "> 1 µm",
      label: "Tamaño promedio de aglomeración de partículas de humo en caída libre (SAME)",
      sub: "Sin flotabilidad, las partículas colisionan y crecen más que en la Tierra antes de dispersarse.",
    },
    recommendation:
      "Colocar detectores en los ductos de retorno de aire (HVAC) y emplear sensores ópticos multi-longitud de onda para discriminar partículas de regolito lunar (>2.5 µm) de humo de combustión (<1 µm).",
  },
  {
    id: "supresion",
    name: "3. Supresión",
    tagline: "Agentes Extintores y Extinción Radiativa",
    badge: "Extinción Inmediata",
    icon: "suppression",
    summary:
      "Sofocar el fuego de inmediato sin envenenar a los astronautas ni destruir los filtros del sistema de soporte vital de la nave.",
    challenge_title: "El desafío: No se pueden usar polvos químicos en un hábitat sellado",
    challenge_text:
      "Los extintores convencionales de polvo químico seco (ABC) están prohibidos en cabina porque saturarían los regeneradores de aire (CDRA) y envenenarían el ambiente respirable. Asimismo, una descarga violenta de gas a alta presión puede expulsar al astronauta flotante por la tercera ley de Newton y dispersar fragmentos encendidos por todo el volumen.",
    investigations: [
      {
        name: "FLEX & FLEX-2",
        code: "PSI-69, 70",
        detail:
          "273 gotas de combustible encendidas en el MDCA dentro del CIR. Demostró la efectividad de la dilución atmosférica con CO₂ y Helio para inducir extinción radiativa súbita.",
      },
      {
        name: "Descubrimiento de Llamas Frías",
        code: "FLEX (CFI)",
        detail:
          "FLEX descubrió que gotas de heptano continuaban quemándose a baja temperatura (600–800 K) tras apagarse la llama visible, revelando el peligro de rescoldos invisibles a simple vista.",
      },
      {
        name: "Extintores de Niebla Fina (Water Mist)",
        code: "Spin-off ISS",
        detail:
          "Microgotas de agua desionizada que sofocan la llama por enfriamiento térmico y desplazamiento de oxígeno sin toxicidad para la tripulación.",
      },
    ],
    metric_highlight: {
      num: "97%",
      label: "Tasa de extinción en metanol al superar 30% de CO₂ en la atmósfera (FLEX)",
      sub: "El CO₂ es el agente principal en los sistemas fijos de extinción de la Estación Espacial.",
    },
    recommendation:
      "Implementar corte automático de ventilación por zonas compartimentadas, sistemas de inundación con CO₂ en racks de aviónica cerrados y extintores portátiles de niebla fina en cabina abierta.",
  },
];

