// Interfaz general: encabezado, Panorama, gráficas de FLEX, simulador 2D, biblioteca y «Cómo funciona».
// Los números de una clave valen como comodines; {a}, {b} son comodines de texto.
export default {
  // ---- <head>, encabezado y pie ----
  "Combustión en microgravedad: datos de NASA PSI, NTRS y Task Book, simulador de gota con evidencia y visualización 3D. NASA Space Apps 2026, reto #08.":
    "Microgravity combustion: NASA PSI, NTRS and Task Book data, an evidence-based droplet simulator and 3D visualization. NASA Space Apps 2026, challenge #08.",
  "Flame in Freefall, inicio": "Flame in Freefall, home",
  "Secciones": "Sections",
  "Panorama": "Overview",
  "Datos": "Data",
  "Simulador": "Simulator",
  "Asistente": "Assistant",
  "Cómo funciona": "How it works",
  "Hackathon en": "Hackathon in",
  "6 días": "6 days",
  "1 día": "1 day",
  "en curso": "in progress",
  "Cargando datos de NASA…": "Loading NASA data…",
  "Error al iniciar: {a}. ¿Corriste \"npm run dev\" dentro de la carpeta app?": "Startup error: {a}. Did you run \"npm run dev\" inside the app folder?",
  "No se pudieron cargar los datos (404)": "Could not load the data (404)",
  "Datos: NASA Physical Sciences Informatics (CC0), NASA Technical Reports Server y NASA Task Book.":
    "Data: NASA Physical Sciences Informatics (CC0), NASA Technical Reports Server and NASA Task Book.",
  "Prototipo del equipo · NASA International Space Apps Challenge 2026": "Team prototype · NASA International Space Apps Challenge 2026",

  // ---- sub-vistas ----
  "Vista de los datos": "Data view",
  "Gráficas de FLEX": "FLEX charts",
  "Ensayo por ensayo": "Test by test",
  "Vista del simulador": "Simulator view",
  "Laboratorio 3D": "3D lab",
  "Gráficas 2D": "2D charts",
  "Este navegador no tiene WebGL 2 (o está desactivado): se muestran las gráficas 2D del mismo modelo.":
    "This browser does not support WebGL 2 (or it is disabled): showing the 2D charts of the same model instead.",

  // ---- Panorama ----
  "NASA Space Apps 2026 · Reto #08": "NASA Space Apps 2026 · Challenge #08",
  "Cómo arde el fuego": "How fire burns",
  "sin gravedad": "without gravity",
  "Tres décadas de experimentos de combustión en la Estación Espacial, reunidos, medidos y explicados. Cada cifra sale de una tabla o un documento de NASA y enlaza a su fuente, para decidir con evidencia cómo proteger a una tripulación de un incendio.":
    "Three decades of combustion experiments on the Space Station, gathered, measured and explained. Every figure comes from a NASA table or document and links to its source, so crew fire-safety decisions rest on evidence.",
  "Explorar los ensayos": "Explore the tests",
  "Probar el simulador": "Try the simulator",
  "investigaciones": "investigations",
  "ensayos tabulados": "tabulated tests",
  "reportes técnicos": "technical reports",
  "Gota de heptano ardiendo en microgravedad": "Heptane droplet burning in microgravity",
  "Gota de": "A",
  "heptano": "heptane",
  "metanol": "methanol",
  "de 3 mm · 21 % O₂ · 1 atm": "droplet, 3 mm · 21% O₂ · 1 atm",
  "predicción a partir de los ensayos de FLEX": "predicted from the FLEX tests",
  "investigaciones de combustión en el repositorio PSI": "combustion investigations in the PSI repository",
  "ensayos tabulados con sus condiciones": "tabulated tests with their conditions",
  "reportes y papers de NTRS con texto completo": "NTRS reports and papers with full text",
  "proyectos financiados en NASA Task Book": "funded projects in NASA Task Book",
  "publicados en PSI; 4.7 GB son datos útiles": "published in PSI; 4.7 GB are usable data",
  "El problema real": "The real problem",
  "Dónde se atoran hoy los científicos": "Where scientists get stuck today",
  "Lo que encontramos al descargar y cruzar los datos. Cada problema viene con la evidencia que lo sostiene y el punto donde la visualización puede atacarlo.":
    "What we found while downloading and cross-referencing the data. Each problem comes with the evidence behind it and the point where visualization can address it.",
  "Datos fragmentados": "Fragmented data",
  "Cada experimento habla su propio idioma": "Every experiment speaks its own language",
  "20 tablas experimentales, cada una con columnas, unidades y formatos distintos. Hay valores como «~ 21.5» o «20 cm/s» escritos como texto.":
    "20 experimental tables, each with different columns, units and formats. Values such as “~ 21.5” or “20 cm/s” are stored as text.",
  "Al descargar: ~2 600 archivos rotos en el propio servidor de PSI; recuperamos 978 desde los zips.":
    "While downloading: ~2,600 broken files on the PSI server itself; we recovered 978 from the zip archives.",
  "Base unificada donde cada dato conserva su fuente.": "A unified database where every value keeps its source.",
  "Conocimiento encerrado": "Locked-up knowledge",
  "Los resultados viven en PDFs y video": "The results live in PDFs and video",
  "El 99.97 % del volumen de PSI es video e imagen cruda. Las conclusiones están en 277 reportes, no en tablas.":
    "99.97% of the PSI volume is raw video and imagery. The conclusions are in 277 reports, not in tables.",
  "13.5 TB publicados contra 4.7 GB de datos tabulares y documentos.": "13.5 TB published versus 4.7 GB of tabular data and documents.",
  "Extracción con IA y verificación con cita textual.": "AI extraction, verified against verbatim quotes.",
  "Huecos de cobertura": "Coverage gaps",
  "No hay ensayos donde más importa": "No tests where it matters most",
  "Las misiones de exploración proponen 0.57 atm con 34 % de O₂. En FLEX hay 0 ensayos por debajo de 0.65 atm; la presión mínima medida es 0.69 atm.":
    "Exploration missions propose 0.57 atm with 34% O₂. FLEX has 0 tests below 0.65 atm; the lowest measured pressure is 0.69 atm.",
  "Ensayos con ≥30 % O₂ y menos de 0.9 atm: 17.": "Tests with ≥30% O₂ and below 0.9 atm: 17.",
  "Mapa de cobertura y predicción que avisa cuando extrapola.": "Coverage map and a prediction that warns when it extrapolates.",
  "Tierra contra órbita": "Earth versus orbit",
  "Se certifica con gravedad, se vuela sin ella": "Certified with gravity, flown without it",
  "La prueba estándar de materiales (NASA-STD-6001, Test 1) quema una muestra hacia arriba en la Tierra. En microgravedad la llama se comporta distinto, y no siempre en la misma dirección.":
    "The standard materials test (NASA-STD-6001, Test 1) burns a sample upward on Earth. In microgravity the flame behaves differently, and not always in the same direction.",
  "Saffire-II: el silicón ardió completo en 1 g y casi nada en órbita; la tela SIBAL propagó 29 cm en órbita.":
    "Saffire-II: silicone burned completely at 1 g and barely at all in orbit; the SIBAL fabric spread 29 cm in orbit.",
  "Comparar 1 g contra microgravedad por material y condición.": "Compare 1 g versus microgravity by material and condition.",
  "Lo que ya dicen los datos": "What the data already show",
  "Hallazgos en 273 gotas encendidas en órbita": "Findings from 273 droplets ignited in orbit",
  "Calculados en vivo desde la tabla de FLEX. Son correlaciones entre ensayos, no reglas de diseño: el siguiente paso es validarlas con el modelo y con la literatura.":
    "Computed live from the FLEX table. These are correlations across tests, not design rules: the next step is to validate them against the model and the literature.",
  "Inventario": "Inventory",
  "Las 24 investigaciones": "The 24 investigations",
  "Ensayos = filas de la tabla experimental de cada investigación. Tamaño total en PSI = todo lo publicado, casi todo video; descargado = tablas, documentos y datos reducidos.":
    "Tests = rows in each investigation’s experimental table. Total size in PSI = everything published, mostly video; downloaded = tables, documents and reduced data.",
  "Investigación": "Investigation",
  "Área": "Area",
  "Periodo": "Period",
  "Ensayos": "Tests",
  "Tamaño total en PSI": "Total size in PSI",
  "Descargado": "Downloaded",

  // ---- hallazgos (model/findings.js) ----
  "100 % vs 73 %": "100% vs 73%",
  "Con 15 % de O₂ o menos, el metanol se apagó en 37 de 37 ensayos; el heptano, en 8 de 11.":
    "At 15% O₂ or less, methanol extinguished in 37 of 37 tests; heptane in 8 of 11.",
  "El heptano siguió ardiendo hasta 14 % de O₂; el metanol necesitó al menos 18 %.":
    "Heptane kept burning down to 14% O₂; methanol needed at least 18%.",
  "de las gotas de metanol se apagaron con más de 30 % de CO₂ en el ambiente, contra 79 % sin CO₂.":
    "of methanol droplets extinguished with more than 30% CO₂ in the ambient, versus 79% without CO₂.",
  "Heptano: 88 % contra 48 %. El CO₂ es el agente de los extintores de la ISS.":
    "Heptane: 88% versus 48%. CO₂ is the agent in the ISS fire extinguishers.",
  "más rápido se consume el heptano con más de 20 % de helio (0.73 contra 0.52 mm²/s).":
    "faster heptane burning with more than 20% helium (0.73 versus 0.52 mm²/s).",
  "El helio conduce mucho mejor el calor: no es un gas de relleno neutro para un hábitat.":
    "Helium conducts heat much better: it is not a neutral fill gas for a habitat.",
  "diámetro mediano al que se apagó la llama visible del heptano: las gotas grandes pierden demasiado calor por radiación.":
    "median diameter at which the visible heptane flame went out: large droplets lose too much heat by radiation.",
  "Tras esa extinción, FLEX observó llamas frías invisibles que siguieron consumiendo la gota (Nayagam et al., 2012).":
    "After that extinction, FLEX observed invisible cool flames that kept consuming the droplet (Nayagam et al., 2012).",

  // ---- combustibles y finales ----
  "Heptano": "Heptane",
  "Metanol": "Methanol",
  "Extinción": "Extinction",
  "Completa": "Completion",
  "Disrupción": "Disruption",
  "Extinción a 0.89 mm": "Extinction at 0.89 mm",
  "Completa a 0.89 mm": "Completion at 0.89 mm",
  "Disrupción a 0.89 mm": "Disruption at 0.89 mm",
  "extinción": "extinction",

  // ---- controles ----
  "Combustible": "Fuel",
  "Heptano · produce hollín": "Heptane · sooting",
  "Metanol · sin hollín": "Methanol · non-sooting",
  "Oxígeno (fracción molar)": "Oxygen (mole fraction)",
  "Presión (atm)": "Pressure (atm)",
  "CO₂ (fracción molar)": "CO₂ (mole fraction)",
  "Helio (fracción molar)": "Helium (mole fraction)",
  "Diámetro inicial de la gota (mm)": "Initial droplet diameter (mm)",
  "Escenarios": "Scenarios",
  "Gravedad": "Gravity",
  "Microgravedad": "Microgravity",
  "Gravedad terrestre": "Earth gravity",

  // ---- escenarios (model/flame.js) ----
  "Cabina ISS": "ISS cabin",
  "Atmósfera de exploración": "Exploration atmosphere",
  "Descarga de extintor CO₂": "CO₂ extinguisher discharge",
  "Oxígeno bajo": "Low oxygen",
  "Llama visible": "Visible flame",
  "Llama fría · invisible a simple vista": "Cool flame · invisible to the naked eye",
  "Llama apagada": "Flame out",
  "Gota consumida": "Droplet consumed",
  "Con gravedad, el aire caliente sube: la llama se alarga hacia arriba y recibe más oxígeno.":
    "With gravity, hot gas rises: the flame stretches upward and draws in more oxygen.",
  "FLEX observó que el heptano sigue quemándose con llama fría tras apagarse la llama visible.":
    "FLEX observed that heptane keeps burning with a cool flame after the visible flame goes out.",
  "Sin gravedad no hay corriente ascendente: la llama es una esfera y el oxígeno llega solo por difusión.":
    "Without gravity there is no buoyant updraft: the flame is a sphere and oxygen arrives by diffusion alone.",

  // ---- cobertura del modelo (model/knn.js) ----
  "Mezcla imposible": "Impossible mixture",
  "O₂ + CO₂ + He suman más de 1. Baja alguno de los tres.": "O₂ + CO₂ + He add up to more than 1. Lower one of the three.",
  "Extrapolando": "Extrapolating",
  "Fuera de lo que midió FLEX ({a}). La predicción copia los ensayos más cercanos y no sabe qué cambia más allá.":
    "Outside the FLEX measured range ({a}). The prediction copies the nearest tests and cannot tell what changes beyond them.",
  "presión 0.50 atm: el mínimo medido es 0.69": "pressure 0.50 atm: the lowest measured is 0.69",
  "presión 0.50 atm: el máximo medido es 0.69": "pressure 0.50 atm: the highest measured is 0.69",
  "O₂ 0.10: el mínimo medido es 0.12": "O₂ 0.10: the lowest measured is 0.12",
  "O₂ 0.10: el máximo medido es 0.12": "O₂ 0.10: the highest measured is 0.12",
  "CO₂ 0.10: el mínimo medido es 0.12": "CO₂ 0.10: the lowest measured is 0.12",
  "CO₂ 0.10: el máximo medido es 0.12": "CO₂ 0.10: the highest measured is 0.12",
  "helio 0.10: el mínimo medido es 0.12": "helium 0.10: the lowest measured is 0.12",
  "helio 0.10: el máximo medido es 0.12": "helium 0.10: the highest measured is 0.12",
  "diámetro 1.5 mm: el mínimo medido es 1.6": "diameter 1.5 mm: the smallest measured is 1.6",
  "diámetro 1.5 mm: el máximo medido es 1.6": "diameter 1.5 mm: the largest measured is 1.6",
  "Dentro de los datos": "Within the data",
  "El ensayo más parecido está a 0.04 unidades. Error típico en este rango: ±0.05 mm²/s.":
    "The closest test is 0.04 units away. Typical error in this range: ±0.05 mm²/s.",
  "Cobertura parcial": "Partial coverage",
  "El ensayo más parecido está a 0.81 unidades. Úsese como orientación, no como dato.":
    "The closest test is 0.81 units away. Use as guidance, not as data.",
  "Fuera de lo medido": "Outside measured range",
  "Nadie ha probado algo parecido en FLEX (distancia 2.07). La predicción no es confiable.":
    "Nothing similar has been tested in FLEX (distance 2.07). The prediction is not reliable.",

  // ---- Gráficas de FLEX (views/explorer.js y charts) ----
  "FLEX · Flame Extinguishment Experiment · ISS 2009–2011": "FLEX · Flame Extinguishment Experiment · ISS 2009–2011",
  "Tasa de quemado contra oxígeno": "Burning rate versus oxygen",
  "Cada punto es una gota de combustible encendida en la Estación Espacial. La tasa de quemado K mide qué tan rápido se consume la gota (ley d²: d² = d₀² − K·t). El relleno indica cómo terminó el ensayo y un clic abre su ficha completa.":
    "Each point is a fuel droplet ignited on the Space Station. The burning rate K measures how fast the droplet is consumed (d² law: d² = d₀² − K·t). The fill shows how the test ended, and a click opens its full record.",
  "Dispersión de tasa de quemado contra fracción molar de oxígeno": "Scatter plot of burning rate versus oxygen mole fraction",
  "0 ensayos mostrados de 273. Pasa el cursor sobre un punto para ver sus condiciones; haz clic para abrir su ficha.":
    "0 of 273 tests shown. Hover over a point to see its conditions; click to open its record.",
  "¿Dónde hay datos y dónde no?": "Where is there data, and where not?",
  "ensayos por celda": "tests per cell",
  "Mapa de cobertura de ensayos por oxígeno y presión": "Test coverage map by oxygen and pressure",
  "Celdas punteadas = combinación sin ningún ensayo. La atmósfera propuesta para exploración cae fuera de lo medido: ahí la predicción tiene que apoyarse en física y avisar.":
    "Dotted cells = combinations with no tests. The proposed exploration atmosphere falls outside the measured range: there the prediction must rely on physics and say so.",
  "Probabilidad de extinción por nivel de O₂": "Extinction probability by O₂ level",
  "Porcentaje de ensayos que terminaron en extinción por rango de oxígeno": "Percentage of tests ending in extinction by oxygen range",
  "Encima de cada barra: número de ensayos en ese rango. Respeta los filtros de arriba.":
    "Above each bar: number of tests in that range. Follows the filters above.",
  "Cómo leer esto": "How to read this",
  "casi no produce hollín y arde con llama azul tenue.": "produces almost no soot and burns with a faint blue flame.",
  "se parece a los combustibles líquidos comunes y sí produce hollín.": "resembles common liquid fuels and does produce soot.",
  "En microgravedad la llama es una esfera alrededor de la gota: sin flotabilidad, el oxígeno llega solo por difusión.":
    "In microgravity the flame is a sphere around the droplet: without buoyancy, oxygen arrives by diffusion alone.",
  ": la llama se apagó antes de consumir la gota.": ": the flame went out before consuming the droplet.",
  ": ardió hasta el final.": ": burned to the end.",
  ": la gota se fragmentó o se desplazó.": ": the droplet broke up or drifted.",
  "FLEX añadió CO₂ y helio a la atmósfera para medir su efecto como supresores. Los extintores de la ISS son de CO₂.":
    "FLEX added CO₂ and helium to the atmosphere to measure their effect as suppressants. The ISS extinguishers use CO₂.",
  "Fuente: PSI-69 FLEX, tabla experimental (licencia CC0).": "Source: PSI-69 FLEX, experimental table (CC0 license).",
  "Todos": "All",
  "Todas": "All",
  "Sin CO₂": "No CO₂",
  "Con CO₂": "With CO₂",
  "Helio": "Helium",
  "Sin He": "No He",
  "Con He": "With He",
  "Fracción molar de O₂ en el ambiente": "Ambient O₂ mole fraction",
  "Tasa de quemado K (mm²/s)": "Burning rate K (mm²/s)",
  "aire · 20.9 %": "air · 20.9%",
  "clic para ver el ensayo": "click to view the test",
  "Exploración (8.2 psia)": "Exploration (8.2 psia)",
  "3 ensayos FLEX": "3 FLEX tests",
  "Sin ensayos: hueco en los datos": "No tests: gap in the data",
  "O₂ 10–15 %": "O₂ 10–15%",
  "Oxígeno en el ambiente": "Ambient oxygen",
  "40 % extinción": "40% extinction",
  "4 de 10 ensayos": "4 of 10 tests",
  "medido": "measured",
  "Tiempo desde la ignición (s)": "Time since ignition (s)",
  "d² (mm²)": "d² (mm²)",

  // ---- Simulador 2D ----
  "Predicción con evidencia": "Evidence-based prediction",
  "¿Qué hace una gota de combustible en estas condiciones?": "What does a fuel droplet do under these conditions?",
  "El modelo busca los ensayos reales de FLEX más parecidos a las condiciones elegidas y promedia sus resultados. Cada predicción dice en qué ensayos se basa y avisa cuando las condiciones salen de lo que se ha medido.":
    "The model finds the real FLEX tests closest to the chosen conditions and averages their results. Every prediction states which tests it relies on and warns when the conditions fall outside what has been measured.",
  "Cámara de combustión": "Combustion chamber",
  "Animación de la gota y su llama": "Animation of the droplet and its flame",
  "Ley d²: curvas medidas contra predicción": "d² law: measured curves versus prediction",
  "Cuadrado del diámetro contra el tiempo para los ensayos vecinos y la predicción": "Diameter squared versus time for the neighboring tests and the prediction",
  "Líneas delgadas: diámetro medido cuadro a cuadro en el video de cada ensayo vecino (archivos DropletData de PSI).":
    "Thin lines: diameter measured frame by frame in the video of each neighboring test (PSI DropletData files).",
  "Ensayos en los que se basa": "Tests the prediction is based on",
  "Modelo: 7 vecinos más cercanos del mismo combustible, ponderados por distancia. Validación dejando uno fuera sobre 257 ensayos: R² = 0.68 y error medio de 0.051 mm²/s en K; acierta la extinción en 83 % de los casos (69 % si siempre se predice la clase más común).":
    "Model: 7 nearest neighbors of the same fuel, distance-weighted. Leave-one-out validation over 257 tests: R² = 0.68 and mean absolute error of 0.051 mm²/s in K; extinction is predicted correctly in 83% of cases (69% if the most common class were always predicted).",
  "Tasa de quemado": "Burning rate",
  "Tiempo de llama": "Flame time",
  "segundos · ley d²": "seconds · d² law",
  "Prob. de extinción": "Extinction prob.",
  "se apaga a ~0.9 mm": "extinguishes at ~0.9 mm",
  "arde hasta consumirse": "burns to completion",
  "la gota se fragmenta o se mueve": "the droplet breaks up or drifts",
  "Ensayo": "Test",
  "Final": "End",
  "Predicción": "Prediction",
  "5 ensayos vecinos medidos": "5 measured neighboring tests",

  // ---- Biblioteca de evidencia ----
  "Corpus para extracción y RAG": "Corpus for extraction and RAG",
  "Biblioteca de evidencia": "Evidence library",
  "Todos los documentos descargados, buscables por título y tema. Los 277 reportes de NTRS son los que consulta el asistente de arriba para responder.":
    "All downloaded documents, searchable by title and topic. The 277 NTRS reports are the ones the assistant above consults to answer.",
  "Buscar: cool flame, Saffire, smoke, flame spread, PMMA…": "Search: cool flame, Saffire, smoke, flame spread, PMMA…",
  "Buscar en la biblioteca": "Search the library",
  "Fuente": "Source",
  "PSI · datos": "PSI · data",
  "NTRS · reportes": "NTRS · reports",
  "Task Book · proyectos": "Task Book · projects",
  "439 de 439 documentos": "439 of 439 documents",
  "Mostrando 150. Afina la búsqueda para ver el resto.": "Showing 150. Refine the search to see the rest.",
  "Sin resultados. Prueba con otra palabra o activa más fuentes.": "No results. Try another word or enable more sources.",
  "ponencia": "conference paper",
  "presentación": "presentation",
  "memo técnico": "technical memorandum",
  "póster": "poster",
  "otro": "other",
  "memorias": "proceedings",
  "artículo": "article",
  "reporte": "report",
  "publicación técnica": "technical publication",
  "proyecto": "project",

  // ---- Cómo funciona (views/pipeline.js) ----
  "Arquitectura propuesta": "Proposed architecture",
  "De 30 años de PDFs a recomendaciones con cita": "From 30 years of PDFs to cited recommendations",
  "Cada paso usa la herramienta que mejor encaja. Jev, de TypeSafe AI, devuelve decisiones tipadas (elegir una opción, sí o no, puntuar) con probabilidad calibrada: encaja en clasificar y verificar, no en predecir el fuego ni en extraer números.":
    "Each step uses the tool that fits best. Jev, by TypeSafe AI, returns typed decisions (pick an option, yes or no, score) with calibrated probability: it fits classification and verification, not predicting fire or extracting numbers.",
  "Fuentes": "Sources",
  "PSI, NTRS y Task Book: tablas, PDFs y fichas de proyecto.": "PSI, NTRS and Task Book: tables, PDFs and project records.",
  "Triage": "Triage",
  "¿El fragmento habla de un experimento y reporta una medición?": "Does the passage describe an experiment and report a measurement?",
  "Extracción": "Extraction",
  "Un LLM llena un esquema fijo con valor, unidades y cita textual.": "An LLM fills a fixed schema with value, units and a verbatim quote.",
  "Verificación": "Verification",
  "¿La cita respalda el valor? La confianza decide si se acepta o se revisa.": "Does the quote support the value? Confidence decides whether it is accepted or reviewed.",
  "Modelo": "Model",
  "Vecinos más cercanos hoy; proceso gaussiano con datos de Cantera después.": "Nearest neighbors today; a Gaussian process with Cantera data next.",
  "ML + física": "ML + physics",
  "Dashboard": "Dashboard",
  "Un router tipado decide si la pregunta va a SQL, a RAG o al simulador.": "A typed router decides whether the question goes to SQL, RAG or the simulator.",
  "Preguntas atómicas para el triage": "Atomic questions for triage",
  "Cada fragmento de los 277 documentos pasa por estas decisiones. Solo los relevantes llegan al extractor, que es el paso caro.":
    "Every passage of the 277 documents goes through these decisions. Only the relevant ones reach the extractor, which is the expensive step.",
  "estado": "state",
  "fragmento de texto + título del documento": "text passage + document title",
  "experimento = FLEX | FLEX-2 | BASS | Saffire | SoFIE | ACME | SAME | otro | ninguno":
    "experiment = FLEX | FLEX-2 | BASS | Saffire | SoFIE |\n                       ACME | SAME | other | none",
  "reporta_medicion_cuantitativa": "reports_quantitative_measurement",
  "magnitud = velocidad_propagacion | limite_extincion | tasa_quemado | tiempo_ignicion | tamano_particula_humo | otra":
    "quantity = spread_rate | extinction_limit |\n                    burning_rate | ignition_time |\n                    smoke_particle_size | other",
  "Verificación dirigida por confianza": "Confidence-driven verification",
  "Pregunta sí o no: «¿la cita textual respalda el valor extraído con esas unidades?». En lugar de revisar una muestra al azar, las personas revisan solo lo dudoso.":
    "Yes-or-no question: “does the verbatim quote support the extracted value with those units?”. Instead of reviewing a random sample, people review only the uncertain cases.",
  "Aceptar": "Accept",
  "entra a la tabla": "goes into the table",
  "Revisar": "Review",
  "cola humana": "human review queue",
  "Descartar": "Discard",
  "se registra el motivo": "the reason is logged",
  "Umbrales iniciales; se ajustan con ~100 fragmentos etiquetados a mano.": "Initial thresholds; tuned with ~100 hand-labeled passages.",
  "Qué no le pediríamos a Jev": "What we would not ask Jev to do",
  "Predecir si un material arde: eso lo decide el modelo entrenado con ensayos, con física detrás.":
    "Predict whether a material burns: that is decided by the model trained on tests, backed by physics.",
  "Extraer números o redactar respuestas: no genera texto.": "Extract numbers or write answers: it does not generate text.",
  "Recomendaciones sin cita: todo sale de la tabla verificada.": "Uncited recommendations: everything comes from the verified table.",
  "Antes de adoptarlo": "Before adopting it",
  "Está en acceso anticipado: hay que pedir acceso en console.typesafe.ai con tiempo.": "It is in early access: request access at console.typesafe.ai well in advance.",
  "Las cifras de velocidad y costo son del fabricante: medirlas con nuestro conjunto etiquetado y compararlas contra un LLM pequeño.":
    "Speed and cost figures come from the vendor: measure them on our labeled set and compare against a small LLM.",
  "Si no llega a tiempo, el mismo pipeline funciona con un LLM en modo clasificación.": "If it does not arrive in time, the same pipeline works with an LLM in classification mode.",

  // ---- depuración (?debug) ----
  "peor 16 ms": "worst 16 ms",
};
