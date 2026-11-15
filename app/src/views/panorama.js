import "../styles/overview.css";
import { nf, t, tr } from "../core/i18n.js";
import { esc, fmt, FUEL, END } from "../core/dom.js";
import { drawCoverage } from "../charts/coverage.js";
import { statusLine } from "./simulator.js";
import { micon } from "../ui/icons.js";
import { flexFindings } from "../model/findings.js";
import { simulate } from "../model/flame.js";
import { createFlame2D } from "../render/flame2d.js";
import { HABITATS } from "../model/habitats.js";
import { PILLARS } from "../model/pillars.js";


export function mountPanorama(root, data, { go, conditions, gravity }) {
  const inv = data.inventory;
  const flex = data.flex;
  const rows = inv.reduce((s, r) => s + r.rows, 0);
  const tb = inv.reduce((s, r) => s + r.gb, 0) / 1000;
  const got = inv.reduce((s, r) => s + r.mb, 0) / 1000;
  const tables = inv.filter((r) => r.rows > 0).length;
  const videoShare = 1 - got / (tb * 1000);
  const lowP = flex.filter((r) => r.P < 0.65).length;
  const minP = Math.min(...flex.map((r) => r.P));
  const hiO2lowP = flex.filter((r) => r.o2 >= 0.3 && r.P < 0.9).length;

  let activeHabitatId = "iss";

  function renderHabitatDetail(h) {
    return `
      <div class="habitat-detail-panel">
        <div class="habitat-header">
          <div class="habitat-title-group">
            <span class="habitat-big-icon icon-tile ${h.riskClass}" aria-hidden="true">${micon(h.icon)}</span>
            <div>
              <h3 class="habitat-heading">${esc(h.name)}</h3>
              <div class="habitat-subtitle">${esc(h.tag)}</div>
            </div>
          </div>
          <span class="habitat-risk-pill ${h.riskClass}">Riesgo: ${esc(h.risk)}</span>
        </div>

        <div class="habitat-metrics-grid">
          <div class="habitat-metric">
            <span class="habitat-metric-label">Presión</span>
            <span class="habitat-metric-val">${h.pressure_atm} <small>atm</small></span>
            <span class="habitat-metric-sub">${h.pressure_psi} psi</span>
          </div>
          <div class="habitat-metric">
            <span class="habitat-metric-label">Oxígeno (O₂)</span>
            <span class="habitat-metric-val">${h.o2_pct}%</span>
            <span class="habitat-metric-sub">${h.o2_pct > 21 ? `+${h.o2_pct - 21}% sobre Tierra` : "Nominal LEO"}</span>
          </div>
          <div class="habitat-metric">
            <span class="habitat-metric-label">Gravedad</span>
            <span class="habitat-metric-val">${h.gravity_g} g</span>
            <span class="habitat-metric-sub">${esc(h.gravity_label)}</span>
          </div>
          <div class="habitat-metric">
            <span class="habitat-metric-label">Convección / Flujo</span>
            <span class="habitat-metric-val small-val">${h.gravity_g === 0 ? "Solo difusión" : "Boyante débil"}</span>
            <span class="habitat-metric-sub">${esc(h.flow_note)}</span>
          </div>
        </div>

        <div class="habitat-coverage-info">
          <span class="habitat-risk-pill ${h.coverageClass}">${esc(h.coverage)}</span>
          <span class="dim small">${esc(h.coverage_desc)}</span>
        </div>

        <div class="habitat-inv-section">
          <div class="habitat-inv-label">Investigaciones relevantes</div>
          <div class="habitat-inv-chips">
            ${h.investigations.map((i) => `
              <button type="button" class="habitat-inv-card" data-acc="${esc(i.acc)}" title="Ver ensayos en la sección Datos">
                <b>${esc(i.name)}</b><span class="dim">${esc(i.desc)}</span>
              </button>`).join("")}
          </div>
        </div>

        <details class="more">
          <summary>Por qué importa</summary>
          <p class="habitat-summary">${esc(h.summary)}</p>
          <div class="habitat-danger-box">
            <h4>${esc(h.danger_title)}</h4>
            <p>${esc(h.danger_text)}</p>
          </div>
        </details>

        <div class="habitat-footer-actions">
          <button type="button" class="btn" id="btn-explore-habitat">Explorar ensayos</button>
        </div>
      </div>`;
  }

  // Problemas que encontramos; cada uno lleva a la vista que lo muestra.
  const PROBLEMS = [
    {
      tag: "Datos fragmentados",
      h: "Cada experimento habla su propio idioma",
      p: `${tables} tablas experimentales, cada una con columnas, unidades y formatos distintos. Hay valores como «~ 21.5» o «20 cm/s» escritos como texto.`,
      ev: `Al descargar: ~2 600 archivos rotos en el propio servidor de PSI; recuperamos 978 desde los zips.`,
      at: "Base unificada donde cada dato conserva su fuente.",
      go: ["datos", "ensayos"], link: "Ver los ensayos",
    },
    {
      tag: "Conocimiento encerrado",
      h: "Los resultados viven en PDFs y video",
      p: `El ${(videoShare * 100).toFixed(2)} % del volumen de PSI es video e imagen cruda. Las conclusiones están en ${data.totals.ntrs} reportes, no en tablas.`,
      ev: `${tb.toFixed(1)} TB publicados contra ${got.toFixed(1)} GB de datos tabulares y documentos.`,
      at: "Extracción con IA y verificación con cita textual.",
      go: ["asistente"], link: "Preguntar al asistente",
    },
    {
      tag: "Huecos de cobertura",
      h: "No hay ensayos donde más importa",
      p: `Las misiones de exploración proponen 0.57 atm con 34 % de O₂. En FLEX hay ${lowP} ensayos por debajo de 0.65 atm; la presión mínima medida es ${fmt(minP)} atm.`,
      ev: `Ensayos con ≥30 % O₂ y menos de 0.9 atm: ${hiO2lowP}.`,
      at: "Mapa de cobertura y predicción que avisa cuando extrapola.",
      go: ["datos"], link: "Ver el mapa de cobertura",
    },
    {
      tag: "Tierra contra órbita",
      h: "Se certifica con gravedad, se vuela sin ella",
      p: "La prueba estándar de materiales (NASA-STD-6001, Test 1) quema una muestra hacia arriba en la Tierra. En microgravedad la llama se comporta distinto, y no siempre en la misma dirección.",
      ev: "Saffire-II: el silicón ardió completo en 1 g y casi nada en órbita; la tela SIBAL propagó 29 cm en órbita.",
      at: "Comparar 1 g contra microgravedad por material y condición.",
      go: ["datos", "ensayos"], link: "Ver los ensayos",
    },
  ];

  root.innerHTML = `
    <div class="dash-head">
      <div>
        <h1 class="ov-title">Panel de misión</h1>
        <p class="lede">Elige un entorno de misión: su riesgo de incendio, si los ensayos en órbita cubren su atmósfera y qué predice el modelo.</p>
      </div>
      <div class="hero-cta">
        <button type="button" class="btn" data-go="datos">Explorar los ensayos</button>
        <button type="button" class="btn" data-go="simulador">Probar el simulador</button>
      </div>
    </div>

    <div class="mission-tabs" id="habitats-nav" role="tablist" aria-label="Entornos de misión">
      ${HABITATS.map((h) => `
        <button type="button" role="tab" class="habitat-btn ${h.id === activeHabitatId ? "active" : ""}" data-hid="${h.id}" aria-selected="${h.id === activeHabitatId}">
          <span class="habitat-btn-icon" aria-hidden="true">${micon(h.icon)}</span>
          <span class="habitat-btn-text"><span class="habitat-btn-name">${esc(h.name)}</span><span class="habitat-btn-tag">${esc(h.tag)}</span></span>
          <span class="habitat-dot ${h.riskClass}" title="${esc(h.risk)}"></span>
        </button>`).join("")}
    </div>

    <div class="dash-grid">
      <div class="dash-main">
        <div id="habitat-detail-slot"></div>
        <section class="panel dash-map">
          <h3>¿Hay ensayos para esta atmósfera?</h3>
          <svg class="chart" id="dash-map" viewBox="0 0 560 330" role="img" aria-label="Mapa de cobertura de ensayos FLEX con la atmósfera de la misión"></svg>
          <p class="dim small">Celdas punteadas: combinaciones de O₂ y presión sin ningún ensayo de FLEX.</p>
        </section>
      </div>
      <aside class="dash-side">
        <section class="panel dash-pred">
          <div class="dash-pred-head"><h3>Predicción del modelo</h3><span class="dim small mono" id="dash-q"></span></div>
          <div class="dash-pred-body">
            <div class="porthole" id="porthole"><canvas id="hero-flame" aria-label="Gota de combustible ardiendo en esta atmósfera"></canvas></div>
            <div class="dash-out" id="dash-out"></div>
          </div>
          <div class="statusline" id="dash-cov"></div>
          <div class="dash-actions">
            <button type="button" class="btn primary" id="dash-3d">Abrir en el laboratorio 3D</button>
            <button type="button" class="btn" id="dash-2d">Ver en el simulador</button>
          </div>
          <p class="dim small" id="dash-nb"></p>
        </section>
      </aside>
    </div>

    <form class="panel dash-ask" id="dash-ask">
      <label for="dash-ask-input">Pregunta al asistente sobre esta misión</label>
      <div class="dash-ask-row">
        <input id="dash-ask-input" type="text" maxlength="600" autocomplete="off">
        <button type="submit" class="btn primary">Preguntar</button>
      </div>
      <p class="dim small">El asistente responde con evidencia de NASA y verifica cada afirmación contra su fuente.</p>
    </form>

    <div class="kpis">
      ${[
        [inv.length, "investigaciones de combustión en el repositorio PSI"],
        [nf(rows, 0, { group: true }), "ensayos tabulados con sus condiciones"],
        [data.totals.ntrs, "reportes y papers de NTRS con texto completo"],
        [data.totals.taskbook, "proyectos financiados en NASA Task Book"],
        [`${tb.toFixed(1)} TB`, `publicados en PSI; ${got.toFixed(1)} GB son datos útiles`],
      ].map(([b, s]) => `<div class="panel kpi"><b>${b}</b><span>${s}</span></div>`).join("")}
    </div>

    <section class="ov-sec">
      <div class="section-head">
        <h2>Hallazgos en 273 gotas encendidas en órbita</h2>
        <p class="lede">Calculados en vivo desde la tabla de FLEX. Son correlaciones entre ensayos, no reglas de diseño: el siguiente paso es validarlas con el modelo y con la literatura.</p>
      </div>
      <div class="findings">
        ${flexFindings(flex).map((f) => `<article class="panel finding"><div class="big">${f.big}</div><p>${f.text}</p><div class="src">${f.src}</div></article>`).join("")}
      </div>
    </section>

    <section class="ov-sec">
      <div class="section-head">
        <h2>Dónde se atoran hoy los científicos</h2>
        <p class="lede">Lo que encontramos al descargar y cruzar los datos. Cada problema viene con la evidencia que lo sostiene y el punto donde la visualización puede atacarlo.</p>
      </div>
      <div class="problems">
        ${PROBLEMS.map((x, i) => `
          <article class="panel problem">
            <span class="tag">${x.tag}</span>
            <h3>${x.h}</h3>
            <div class="attack">${x.at}</div>
            <details class="more"><summary>Evidencia</summary><p>${x.p}</p><div class="evidence">${x.ev}</div></details>
            <button type="button" class="ov-link" data-problem="${i}">${x.link}</button>
          </article>`).join("")}
      </div>
    </section>

    <section class="ov-sec">
      <div class="section-head">
        <h2>Los Tres Pilares de Seguridad contra Incendios en el Espacio</h2>
        <p class="lede">Prevención, detección y supresión: qué aportan las investigaciones de PSI y NTRS a cada una.</p>
      </div>
      <div class="pillars-list">
        ${PILLARS.map((p) => `
          <details class="pillar-card">
            <summary class="pillar-card-head">
              <span class="pillar-icon icon-tile pillar-${p.id}" aria-hidden="true">${micon(p.icon)}</span>
              <span class="pillar-head-text"><span class="pillar-title">${esc(p.name)}</span><span class="pillar-tagline">${esc(p.tagline)}</span></span>
              <span class="pillar-metric-num">${p.metric_highlight.num}</span>
            </summary>
            <div class="pillar-body">
              <p class="pillar-summary">${esc(p.summary)}</p>
              <div class="pillar-metric-box">
                <div class="pillar-metric-text"><b>${esc(p.metric_highlight.label)}</b><br><span class="dim">${esc(p.metric_highlight.sub)}</span></div>
              </div>
              <div class="pillar-challenge">
                <h4>${esc(p.challenge_title)}</h4>
                <p>${esc(p.challenge_text)}</p>
              </div>
              <div class="pillar-inv-list">
                <span class="habitat-inv-label">Investigaciones clave en PSI / NTRS</span>
                ${p.investigations.map((inv) => `
                  <div class="pillar-inv-item"><b>${esc(inv.name)}</b> <span class="pillar-inv-code">${esc(inv.code)}</span><span>${esc(inv.detail)}</span></div>`).join("")}
              </div>
              <div class="pillar-recom"><b>Recomendación de diseño (Artemis / Marte)</b><span>${esc(p.recommendation)}</span></div>
            </div>
          </details>`).join("")}
      </div>
    </section>

    <details class="panel ov-inventory">
      <summary><span class="ov-inv-title">Las 24 investigaciones</span><span class="dim small">Inventario de PSI: ensayos, hardware y tamaño de cada investigación</span></summary>
      <p class="dim small">Ensayos = filas de la tabla experimental de cada investigación. Tamaño total en PSI = todo lo publicado, casi todo video; descargado = tablas, documentos y datos reducidos.</p>
      <div class="tablewrap"><table class="inv" id="inv"></table></div>
    </details>`;

  // ---- misión elegida: ficha, predicción, mapa de cobertura y pregunta sugerida ----
  const detailSlot = root.querySelector("#habitat-detail-slot");
  const navContainer = root.querySelector("#habitats-nav");
  const askInput = root.querySelector("#dash-ask-input");
  let askEdited = false;
  askInput.addEventListener("input", () => { askEdited = true; });
  let currentSim = null;
  let current = HABITATS[0];

  function paintPrediction(h) {
    const sim = simulate(flex, h.preset);
    currentSim = sim;
    const { pr, tBurn, ext, dEnd } = sim;
    root.querySelector("#dash-q").textContent = `${FUEL[h.preset.fuel]?.es || h.preset.fuel} · ${Math.round(h.preset.o2 * 100)} % O₂ · ${fmt(h.preset.P)} atm · ${fmt(h.preset.d0, 1)} mm`;
    root.querySelector("#dash-out").innerHTML = [
      ["Tasa de quemado", fmt(pr.K), `± ${fmt(pr.sd)} mm²/s`],
      ["Tiempo de llama", fmt(tBurn, 1), "segundos · ley d²"],
      ["Prob. de extinción", `${Math.round(pr.pExt * 100)} %`, ext ? `se apaga a ~${fmt(dEnd, 1)} mm` : "arde hasta consumirse"],
    ].map(([l, b, s]) => `<div class="out"><span class="lbl">${l}</span><b>${b}</b><small>${s}</small></div>`).join("");
    root.querySelector("#dash-cov").innerHTML = statusLine(sim);
    const nb = pr.nb[0]?.r;
    root.querySelector("#dash-nb").innerHTML = nb
      ? `Ensayo real más cercano: <b>FLEX #${nb.n}</b> · <span class="mono">${esc(nb.id)}</span> · <span>${esc(END[nb.end] || nb.end)}</span> <button type="button" class="ov-link" id="dash-nb-3d">Cargarlo en el laboratorio 3D</button>`
      : "";
    root.querySelector("#dash-nb-3d")?.addEventListener("click", () => go("lab3d", `test/PSI-69:${nb.id}`));
    drawCoverage(root.querySelector("#dash-map"), flex, [{ o2: h.o2_pct / 100, P: h.pressure_atm, label: h.name }]);
    if (!askEdited) askInput.value = t("¿Qué evidencia de NASA hay sobre el riesgo de incendio en {nm}, con {ox} % de O₂ y {pr} atm?", { nm: tr(h.name), ox: h.o2_pct, pr: fmt(h.pressure_atm) });
  }

  function useMission(h, view) {
    if (conditions && h.preset) conditions.set({ ...h.preset });
    if (gravity && typeof h.gravity_mode === "number") gravity.set({ g: h.gravity_mode });
    go("simulador", view);
  }

  function updateHabitatView(id) {
    activeHabitatId = id;
    const h = HABITATS.find((x) => x.id === id) || HABITATS[0];
    current = h;
    detailSlot.innerHTML = renderHabitatDetail(h);
    navContainer.querySelectorAll(".habitat-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.hid === id);
      b.setAttribute("aria-selected", b.dataset.hid === id);
    });
    detailSlot.querySelector("#btn-explore-habitat")?.addEventListener("click", () => go("datos", "ensayos"));
    detailSlot.querySelectorAll(".habitat-inv-card").forEach((card) => card.addEventListener("click", () => go("datos", "ensayos")));
    paintPrediction(h);
  }

  updateHabitatView(activeHabitatId);
  navContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".habitat-btn");
    if (btn) updateHabitatView(btn.dataset.hid);
  });
  root.querySelector("#dash-3d").addEventListener("click", () => useMission(current));
  root.querySelector("#dash-2d").addEventListener("click", () => useMission(current, "2d"));
  root.querySelector("#dash-ask").addEventListener("submit", (e) => {
    e.preventDefault();
    const question = askInput.value.trim();
    if (question) go("asistente", question);
  });

  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  root.querySelectorAll("[data-problem]").forEach((b) => b.addEventListener("click", () => go(...PROBLEMS[+b.dataset.problem].go)));

  // Tornillos de la ventanilla
  const port = root.querySelector("#porthole");
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bolt = document.createElement("span");
    bolt.className = "bolt";
    bolt.style.left = `calc(50% + ${Math.cos(a) * 46.2}% - 4.5px)`;
    bolt.style.top = `calc(50% + ${Math.sin(a) * 46.2}% - 4.5px)`;
    port.appendChild(bolt);
  }

  const maxGb = Math.max(...inv.map((r) => r.gb));
  root.querySelector("#inv").innerHTML =
    `<thead><tr><th>Investigación</th><th>Hardware (rack / aparato)</th><th>Área</th><th>Periodo</th><th class="num">Ensayos</th><th class="num">Tamaño total en PSI</th><th class="num">Descargado</th><th>DOI</th></tr></thead><tbody>` +
    [...inv].sort((a, b) => b.rows - a.rows).map((r) => `
      <tr>
        <td><div class="acr">${esc(r.acr || r.acc)}</div><div class="dim small">${esc(r.title)}</div></td>
        <td class="small"><div class="inv-rack">${esc(r.hardware_rack || "ISS · CIR / MSG")}</div><div class="dim small">${esc(r.hardware_apparatus || "")}</div></td>
        <td class="small">${esc(r.area)}</td>
        <td class="dim small" style="white-space:nowrap">${esc((r.start || "").slice(-4))}–${esc((r.end || "").slice(-4))}</td>
        <td class="num">${r.rows || "—"}</td>
        <td class="num">${r.gb >= 1 ? `${r.gb.toFixed(0)} GB` : `${(r.gb * 1000).toFixed(0)} MB`}<div class="sizebar"><i style="width:${Math.max(2, Math.sqrt(r.gb / maxGb) * 100)}%"></i></div></td>
        <td class="num">${r.mb >= 1000 ? `${(r.mb / 1000).toFixed(1)} GB` : `${r.mb.toFixed(0)} MB`}</td>
        <td style="white-space:nowrap">${r.doi ? `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">${esc(r.acc)}</a>` : esc(r.acc)}</td>
      </tr>`).join("") + "</tbody>";

  // Llama de la ventanilla
  const flame = createFlame2D(root.querySelector("#hero-flame"), { getSim: () => currentSim, scale: 1.2, bg: "#020309", frac: 0.45 });
  let active = false;
  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (active && visible) flame.start();
    else flame.stop();
  });
  io.observe(port);

  return {
    enter() { active = true; if (visible) flame.start(); },
    leave() { active = false; flame.stop(); },
  };
}
