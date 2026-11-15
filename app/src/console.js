/**
 * Entrada de la app: la consola científica de Liam (research/apps/scientific-console) con dos
 * secciones más en la barra lateral para las vistas del equipo. Esas vistas viven en lab.html y se
 * muestran en un iframe que se crea una sola vez: aislado de los estilos de la consola y sin perder
 * el estado del laboratorio 3D al cambiar de sección.
 */
import { mountScientificConsole } from "@console/main.js";
import "./styles/console-ext.css";

const SECTIONS = [
  {
    // panel principal: va arriba de la barra lateral y es la página de inicio
    label: "MISSION",
    top: true,
    items: [{ key: "overview", label: "Mission Dashboard", icon: "overview" }],
  },
  {
    label: "SIMULATION LAB",
    items: [
      { key: "lab3d", label: "3D Laboratory", icon: "lab3d" },
      { key: "simulator", label: "Flame Simulator", icon: "simulator" },
    ],
  },
  {
    label: "MISSION DATA",
    items: [
      { key: "flex", label: "FLEX Charts", icon: "flex" },
      { key: "records", label: "Test Records", icon: "records" },
    ],
  },
];

let frame = null;

function onExternal(key, params, panel) {
  const hash = key ? `#${key}${params.sub ? `/${encodeURIComponent(params.sub)}` : ""}` : "#idle";
  if (!frame) {
    if (!key) return;
    frame = document.createElement("iframe");
    frame.className = "external-frame";
    frame.title = "Simulation lab and mission data";
    frame.allow = "fullscreen";
    frame.src = `${import.meta.env.BASE_URL}lab.html?lang=en${hash}`;
    panel.appendChild(frame);
    return;
  }
  // mismo origen: cambiar el hash del iframe no lo recarga, solo cambia de vista
  frame.contentWindow.location.hash = hash;
}

mountScientificConsole(document.querySelector("#app"), { sections: SECTIONS, onExternal, home: "overview" });
