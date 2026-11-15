# Uso de IA en el proyecto

La competencia pide declarar qué partes se generaron con IA. Este archivo lista lo que se hizo con
**Claude Code (Anthropic)** en el rediseño de la interfaz de noviembre de 2026 (PR #1 y el PR que
agregó esta declaración). Cada archivo lleva además una línea `AI disclosure:` al inicio.

El equipo puede ampliar esta lista con cualquier otro uso de IA en el proyecto.

## Qué hizo la IA

- **Rediseño de la interfaz**:
  - barra lateral colapsable;
  - encabezados compactos;
  - chat del asistente;
  - biblioteca de investigaciones en árbol;
  - Compare, Discover y Evidence;
  - laboratorio 3D a pantalla completa;
  - simulador;
  - Mission Data;
  - Mission Dashboard;
  - carga de ensayos reales de FLEX en el laboratorio 3D;
  - iconos SVG.
- **Traducciones al inglés** de textos que solo estaban en español: hábitats, pilares y hardware de los ensayos.
- **No se modificó con IA**:
  - el motor de evidencia (`research/src`, `research/scripts`);
  - los datos (`research/data`, `data/`);
  - el modelo de predicción (`app/src/model/knn.js`, `app/src/model/flame.js`);
  - el render 3D (`app/src/render/**`).

## Archivos generados con IA

- `app/src/i18n/en.mission.js`
- `app/src/styles/overview.css`
- `app/src/ui/icons.js`
- `research/apps/scientific-console/src/library.js`
- `research/apps/scientific-console/src/workspace-views.css`
- `research/apps/scientific-console/src/workspace.css`

## Archivos reescritos en su mayor parte con IA

- `research/apps/scientific-console/src/views/investigations.js`
- `research/apps/scientific-console/src/views/discover.js`
- `app/src/views/panorama.js`
- `app/src/styles/console-ext.css`
- `app/src/styles/embed.css`

## Archivos modificados en partes con IA

- `app/src/charts/coverage.js`
- `app/src/console.js`
- `app/src/embed.js`
- `app/src/i18n/en.js`
- `app/src/i18n/en.lab.js`
- `app/src/i18n/en.ui.js`
- `app/src/model/habitats.js`
- `app/src/model/pillars.js`
- `app/src/styles/lab3d.css`
- `app/src/styles/views.css`
- `app/src/views/experiments.js`
- `app/src/views/explorer.js`
- `app/src/views/flame3dView.js`
- `app/src/views/simulator.js`
- `research/apps/scientific-console/src/main.js`
- `research/apps/scientific-console/src/ui.js`
- `research/apps/scientific-console/src/views/assistant.js`
- `research/apps/scientific-console/src/views/compare.js`
- `research/apps/scientific-console/src/views/evidence.js`

Los commits hechos con IA llevan la línea `Co-Authored-By: Claude`.
