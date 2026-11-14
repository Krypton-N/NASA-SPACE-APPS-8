// Diccionario español → inglés (técnico, para personal de NASA). La clave es el texto fuente tal como
// aparece en pantalla; los números dentro de una clave valen como comodines y {a}, {b} como comodines de
// texto (ver core/i18n.js). Se carga solo cuando el idioma activo es inglés.
import ui from "./en.ui.js";
import lab from "./en.lab.js";
import experiments from "./en.experiments.js";
import rag from "./en.rag.js";

export default { ...ui, ...lab, ...experiments, ...rag };
