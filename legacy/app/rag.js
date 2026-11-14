import { esc } from "../core/dom.js";
import { tr } from "../core/i18n.js";
import { resolveHardware, enrichPaperAndExperiments } from "../model/hardware.js";

const API_BASE = "http://127.0.0.1:5005/api/rag";
const STORAGE_KEY_CONVS = "flame_rag_conversations_v2";
const STORAGE_KEY_ACTIVE = "flame_rag_active_conv_id_v2";

// Catálogo base de Foundation Models en Amazon Bedrock
const DEFAULT_MODELS = [
  // --- Anthropic ---
  {
    id: "us.anthropic.claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    family: "Claude",
    description: "Modelo insignia para análisis técnico complejo, extracción científica rigurosa y síntesis de literatura aeroespacial.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Científico & Multimodal",
    is_verified: true,
    badge: "Recomendado",
    speed: "Rápido (~1.4s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    family: "Claude",
    description: "Excelente precisión en contrastes cuantitativos de telemetría y formulación de hipótesis en microgravedad.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.5s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    family: "Claude",
    description: "Generación ultrarrápida de respuestas técnicas para exploración interactiva y verificación de parámetros de vuelo.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Ultra-Rápido",
    is_verified: true,
    badge: "Ultra Veloz",
    speed: "Inmediato (~0.7s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },
  {
    id: "us.anthropic.claude-opus-4-6-v1",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    family: "Claude",
    description: "Máxima profundidad analítica para evaluación de riesgos de incendio, cinética química y certificación espacial.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Razonamiento Profundo",
    is_verified: true,
    badge: "Máxima Profundidad",
    speed: "Moderado (~2.8s)",
    default_temp: 0.1,
    default_tokens: 2048,
  },
  {
    id: "us.anthropic.claude-opus-4-5-20251101-v1:0",
    name: "Claude Opus 4.5",
    provider: "Anthropic",
    family: "Claude",
    description: "Capacidad avanzada de razonamiento formal y revisión cruzada de estándares NASA-STD-6001B.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "200K",
    category: "Razonamiento Profundo",
    is_verified: true,
    speed: "Moderado (~3.0s)",
    default_temp: 0.1,
    default_tokens: 2048,
  },

  // --- DeepSeek ---
  {
    id: "us.deepseek.r1-v1:0",
    name: "DeepSeek-R1",
    provider: "DeepSeek",
    family: "DeepSeek",
    description: "Razonamiento por cadena de pensamiento (Chain-of-Thought) paso a paso en fenómenos de convección forzada y llama fría.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Razonamiento Profundo",
    is_verified: true,
    badge: "CoT Reasoning",
    speed: "Analítico (~2.4s)",
    default_temp: 0.3,
    default_tokens: 2048,
  },

  // --- Amazon (Nova & Titan) ---
  {
    id: "us.amazon.nova-pro-v1:0",
    name: "Amazon Nova Pro",
    provider: "Amazon",
    family: "Nova",
    description: "Modelo insignia multimodal de Amazon optimizado para análisis de diagramas y reportes científicos aeroespaciales.",
    modalities: ["TEXT", "IMAGE", "VIDEO"],
    context_window: "300K",
    category: "Científico & Multimodal",
    is_verified: true,
    badge: "Amazon Flagship",
    speed: "Rápido (~1.2s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.amazon.nova-2-lite-v1:0",
    name: "Amazon Nova 2 Lite",
    provider: "Amazon",
    family: "Nova",
    description: "Segunda generación de Nova optimizada para alta velocidad con amplia ventana de 256K tokens.",
    modalities: ["TEXT", "IMAGE", "VIDEO"],
    context_window: "256K",
    category: "Ultra-Rápido",
    is_verified: true,
    badge: "Nueva Generación",
    speed: "Ultra Veloz (~0.8s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "us.amazon.nova-lite-v1:0",
    name: "Amazon Nova Lite",
    provider: "Amazon",
    family: "Nova",
    description: "Inferencia de baja latencia diseñada para respuestas estructuradas e integración fluida en tiempo real.",
    modalities: ["TEXT", "IMAGE", "VIDEO"],
    context_window: "300K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Inmediato (~0.7s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },
  {
    id: "us.amazon.nova-micro-v1:0",
    name: "Amazon Nova Micro",
    provider: "Amazon",
    family: "Nova",
    description: "Modelo ultra-compacto de texto puro con latencia sub-segundo para consultas directas del catálogo.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.5s)",
    default_temp: 0.1,
    default_tokens: 800,
  },

  // --- Meta (Llama) ---
  {
    id: "us.meta.llama4-maverick-17b-instruct-v1:0",
    name: "Llama 4 Maverick 17B",
    provider: "Meta",
    family: "Llama",
    description: "Arquitectura de última generación Llama 4 con razonamiento refinado y capacidades multimodales nativas.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    badge: "Llama 4",
    speed: "Rápido (~1.3s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.meta.llama4-scout-17b-instruct-v1:0",
    name: "Llama 4 Scout 17B",
    provider: "Meta",
    family: "Llama",
    description: "Variante Llama 4 optimizada para exploración de hipótesis y síntesis conceptual en ciencia espacial.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Rápido (~1.4s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.meta.llama3-3-70b-instruct-v1:0",
    name: "Llama 3.3 70B Instruct",
    provider: "Meta",
    family: "Llama",
    description: "El modelo abierto insignia de 70B parámetros de Meta, entrenado para responder con rigor y fidelidad al contexto.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    badge: "Top Open-Weight",
    speed: "Equilibrado (~1.9s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "us.meta.llama3-1-8b-instruct-v1:0",
    name: "Llama 3.1 8B Instruct",
    provider: "Meta",
    family: "Llama",
    description: "Modelo de 8B parámetros con excelente agilidad y apego estricto a las directrices de los datos OLAP.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Rápido (~0.9s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },
  {
    id: "meta.llama3-8b-instruct-v1:0",
    name: "Llama 3 8B Instruct",
    provider: "Meta",
    family: "Llama",
    description: "Versión compacta clásica de Llama 3 para inferencia veloz y confiable.",
    modalities: ["TEXT"],
    context_window: "8K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Rápido (~0.8s)",
    default_temp: 0.2,
    default_tokens: 800,
  },

  // --- Google ---
  {
    id: "google.gemma-3-12b-it",
    name: "Gemma 3 12B IT",
    provider: "Google",
    family: "Gemma",
    description: "Modelo insignia de Google en Bedrock, con comprensión matemática y científica de alto nivel para microgravedad.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    badge: "Default NASA",
    speed: "Rápido (~1.1s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "google.gemma-3-27b-it",
    name: "Gemma 3 27B PT",
    provider: "Google",
    family: "Gemma",
    description: "Versión extendida de 27B parámetros con mayor capacidad de abstracción termodinámica y química.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Equilibrado (~1.8s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "google.gemma-3-4b-it",
    name: "Gemma 3 4B IT",
    provider: "Google",
    family: "Gemma",
    description: "Modelo liviano de 4B para respuestas concisas y de latencia mínima.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.6s)",
    default_temp: 0.2,
    default_tokens: 800,
  },

  // --- Mistral AI ---
  {
    id: "mistral.mistral-large-3-675b-instruct",
    name: "Mistral Large 3",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Modelo MoE de escala masiva (675B) con razonamiento superior y soporte multimodal de vanguardia.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Razonamiento Profundo",
    is_verified: true,
    badge: "MoE 675B",
    speed: "Potente (~2.4s)",
    default_temp: 0.2,
    default_tokens: 2000,
  },
  {
    id: "us.mistral.pixtral-large-2502-v1:0",
    name: "Pixtral Large 25.02",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Especialista en análisis de imágenes e ilustraciones experimentales junto a texto técnico.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.5s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "mistral.ministral-3-14b-instruct",
    name: "Ministral 14B 3.0",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Alta densidad de razonamiento en formato compacto de 14B para inferencia eficiente.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.0s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "mistral.ministral-3-8b-instruct",
    name: "Ministral 3 8B",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Modelo de 8B parámetros optimizado para baja latencia con comprensión de imágenes.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.8s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },
  {
    id: "mistral.mixtral-8x7b-instruct-v0:1",
    name: "Mixtral 8x7B Instruct",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Pionero en Mixture-of-Experts con enrutamiento dinámico de conocimiento técnico.",
    modalities: ["TEXT"],
    context_window: "32K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Rápido (~1.2s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "mistral.mistral-7b-instruct-v0:2",
    name: "Mistral 7B Instruct v0.2",
    provider: "Mistral AI",
    family: "Mistral",
    description: "Modelo de referencia de 7B de alta eficiencia computacional.",
    modalities: ["TEXT"],
    context_window: "32K",
    category: "Modelos Abiertos",
    is_verified: true,
    speed: "Inmediato (~0.7s)",
    default_temp: 0.2,
    default_tokens: 800,
  },

  // --- Qwen ---
  {
    id: "qwen.qwen3-32b-v1:0",
    name: "Qwen3 32B (dense)",
    provider: "Qwen",
    family: "Qwen",
    description: "Modelo denso de 32B con capacidades matemáticas, químicas y de ingeniería aeroespacial excepcionales.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    badge: "Alta Precisión",
    speed: "Equilibrado (~1.5s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "qwen.qwen3-next-80b-a3b",
    name: "Qwen3 Next 80B A3B",
    provider: "Qwen",
    family: "Qwen",
    description: "Arquitectura avanzada de 80B con atención adaptativa para documentos científicos extensos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Razonamiento Profundo",
    is_verified: true,
    speed: "Potente (~2.1s)",
    default_temp: 0.2,
    default_tokens: 1800,
  },
  {
    id: "qwen.qwen3-coder-next",
    name: "Qwen3 Coder Next",
    provider: "Qwen",
    family: "Qwen",
    description: "Especialista en análisis algorítmico, formulación numérica y extracción cuantitativa de datos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.3s)",
    default_temp: 0.1,
    default_tokens: 1500,
  },
  {
    id: "qwen.qwen3-coder-30b-a3b-v1:0",
    name: "Qwen3 Coder 30B",
    provider: "Qwen",
    family: "Qwen",
    description: "Modelo de programación y lógica técnica enfocado en consistencia cuantitativa.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.4s)",
    default_temp: 0.1,
    default_tokens: 1200,
  },

  // --- NVIDIA ---
  {
    id: "nvidia.nemotron-super-3-120b",
    name: "Nemotron 3 Super 120B",
    provider: "NVIDIA",
    family: "Nemotron",
    description: "Supermodelo de 120B optimizado por NVIDIA para inferencia acelerada de dominios científicos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Razonamiento Profundo",
    is_verified: true,
    badge: "NVIDIA Super 120B",
    speed: "Potente (~2.2s)",
    default_temp: 0.2,
    default_tokens: 1800,
  },
  {
    id: "nvidia.nemotron-nano-12b-v2",
    name: "Nemotron Nano 12B v2",
    provider: "NVIDIA",
    family: "Nemotron",
    description: "Modelo compacto de 12B con precisión BF16 optimizada para inferencia científica veloz.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Rápido (~1.0s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "nvidia.nemotron-nano-3-30b",
    name: "Nemotron Nano 3 30B",
    provider: "NVIDIA",
    family: "Nemotron",
    description: "Variante de 30B diseñada para compresión y síntesis de reportes extensos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Equilibrado (~1.5s)",
    default_temp: 0.2,
    default_tokens: 1400,
  },
  {
    id: "nvidia.nemotron-nano-9b-v2",
    name: "Nemotron Nano 9B v2",
    provider: "NVIDIA",
    family: "Nemotron",
    description: "Modelo ligero de 9B con excelente balance entre velocidad y precisión conceptual.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.8s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },

  // --- MiniMax ---
  {
    id: "minimax.minimax-m2.5",
    name: "MiniMax M2.5",
    provider: "MiniMax",
    family: "MiniMax",
    description: "Modelo conversacional avanzado para diálogos técnicos interactivos y exploración guiada de hipótesis.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.2s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "minimax.minimax-m2.1",
    name: "MiniMax M2.1",
    provider: "MiniMax",
    family: "MiniMax",
    description: "Alta solidez analítica para contraste entre normas terrestres y microgravedad.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Científico & Multimodal",
    is_verified: true,
    speed: "Rápido (~1.3s)",
    default_temp: 0.2,
    default_tokens: 1200,
  },
  {
    id: "minimax.minimax-m2",
    name: "MiniMax M2",
    provider: "MiniMax",
    family: "MiniMax",
    description: "Inferencia ágil para procesamiento de consultas del catálogo espacial.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.9s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },

  // --- OpenAI (Mantle / Bedrock) ---
  {
    id: "openai.gpt-oss-120b-1:0",
    name: "GPT OSS 120B",
    provider: "OpenAI",
    family: "GPT OSS",
    description: "Modelo de pesos abiertos de gran escala (120B) con salvaguardas avanzadas y razonamiento formal.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Modelos Abiertos",
    is_verified: true,
    badge: "OpenAI Open-Weight",
    speed: "Equilibrado (~1.7s)",
    default_temp: 0.2,
    default_tokens: 1500,
  },
  {
    id: "openai.gpt-oss-20b-1:0",
    name: "GPT OSS 20B",
    provider: "OpenAI",
    family: "GPT OSS",
    description: "Versión compacta de 20B para razonamiento de alta velocidad con verificación de datos.",
    modalities: ["TEXT"],
    context_window: "128K",
    category: "Ultra-Rápido",
    is_verified: true,
    speed: "Ultra Veloz (~0.7s)",
    default_temp: 0.2,
    default_tokens: 1000,
  },

  // --- Modelos de Frontera ---
  {
    id: "us.anthropic.claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    family: "Claude 5",
    description: "Nueva frontera Claude 5.x para síntesis autónoma de investigación científica.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "500K",
    category: "Frontera",
    is_verified: false,
    badge: "Próxima Gen",
    speed: "Frontera",
    default_temp: 0.2,
    default_tokens: 2048,
  },
  {
    id: "us.openai.gpt-6.1-terra",
    name: "GPT-6.1 Terra",
    provider: "OpenAI",
    family: "GPT-6",
    description: "Modelo frontera OpenAI Mantle en Bedrock para razonamiento visual y científico extremo.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "500K",
    category: "Frontera",
    is_verified: false,
    badge: "OpenAI Mantle",
    speed: "Frontera",
    default_temp: 0.2,
    default_tokens: 2048,
  },
  {
    id: "us.xai.grok-4.7",
    name: "Grok 4.7",
    provider: "xAI",
    family: "Grok",
    description: "Modelo de frontera xAI con gran ventana de contexto y capacidad de análisis cruzado.",
    modalities: ["TEXT", "IMAGE"],
    context_window: "256K",
    category: "Frontera",
    is_verified: false,
    badge: "xAI",
    speed: "Frontera",
    default_temp: 0.2,
    default_tokens: 2048,
  }
];

const SAMPLES = [
  {
    title: "Silicón: Tierra vs Órbita (Saffire-II)",
    prompt: "¿Por qué el silicón se autoextinguió en microgravedad durante Saffire-II mientras ardió completo en las pruebas en la Tierra?",
    followups: [
      "¿Qué espesor tenían las muestras de silicón y a qué flujo de aire se probaron?",
      "¿Cómo afecta esto la validez del estándar NASA-STD-6001B Test 1?",
      "¿Qué pasaría con ese mismo silicón en una atmósfera de exploración con 34% de O₂?",
    ],
  },
  {
    title: "Gotas de Heptano y Llama Fría (FLEX)",
    prompt: "¿Qué observó el experimento FLEX en la ISS sobre la extinción de gotas de heptano y la presencia de llama fría?",
    followups: [
      "¿A qué temperatura aproximada ocurre esa segunda etapa de llama fría?",
      "¿Por qué no se observa este fenómeno de llama fría estacionaria en gravedad terrestre (1g)?",
      "¿Qué riesgo de re-ignición súbita implica la llama fría dentro de una cabina espacial?",
    ],
  },
  {
    title: "Atmósfera de Exploración (34% O₂)",
    prompt: "¿Qué riesgo existe en la atmósfera propuesta para misiones de exploración a 0.57 atm y 34% de oxígeno según los ensayos de NASA?",
    followups: [
      "¿Cómo cambia la tasa de propagación de la llama al subir de 21% a 34% de O₂?",
      "¿Qué materiales probados en Saffire mostraron mayor sensibilidad al porcentaje de oxígeno?",
      "¿Qué concentración de CO₂ se requiere para extinguir llamas en estas condiciones?",
    ],
  },
  {
    title: "Tela SIBAL vs PMMA Acrílico",
    prompt: "¿Cómo se compara la velocidad de propagación de la tela SIBAL frente al PMMA acrílico en flujo forzado de 20 cm/s en órbita?",
    followups: [
      "¿Cuál fue la temperatura máxima alcanzada en el PMMA vs SIBAL según el Cubo OLAP?",
      "¿Qué papel juega el grosor térmico del PMMA frente a una tela delgada como SIBAL?",
      "¿Qué sucede cuando se apaga el ventilador de ventilación en la ISS durante la combustión?",
    ],
  },
  {
    title: "Norma NASA-STD-6001B Test 1",
    prompt: "¿Cuáles son las limitaciones del Test 1 de NASA-STD-6001B al predecir la inflamabilidad de materiales en microgravedad real?",
    followups: [
      "¿En qué condiciones un material aprueba en la Tierra pero resulta peligroso en el espacio?",
      "¿Qué modificaciones proponen los investigadores de NASA Glenn para certificar materiales lunares?",
    ],
  },
];

const QUICK_MODEL_IDS = [
  "us.anthropic.claude-sonnet-4-6",
  "us.deepseek.r1-v1:0",
  "us.amazon.nova-pro-v1:0",
  "us.amazon.nova-2-lite-v1:0",
  "us.meta.llama4-maverick-17b-instruct-v1:0",
  "google.gemma-3-12b-it",
  "mistral.mistral-large-3-675b-instruct",
  "qwen.qwen3-32b-v1:0",
  "nvidia.nemotron-super-3-120b",
  "openai.gpt-oss-120b-1:0",
];

function createNewConversationObj(preferredModelId = "us.anthropic.claude-sonnet-4-6", mode = "standard") {
  const now = Date.now();
  return {
    id: `conv_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: "Nueva Investigación",
    createdAt: now,
    updatedAt: now,
    modelId: preferredModelId,
    mode: mode, // "standard" | "deep_research"
    messages: [],
    sources: [],
    pinnedSourceIds: [],
    notes: [],
    lastIvfStats: null,
  };
}

export function mountRag(root, data, shared) {
  let catalog = DEFAULT_MODELS;
  let inferenceParams = {
    temperature: 0.2,
    max_tokens: 1500,
    top_p: 0.9,
  };

  // Cargar o inicializar conversaciones persistidas
  let conversations = [];
  let activeConvId = null;

  try {
    const rawConvs = localStorage.getItem(STORAGE_KEY_CONVS);
    if (rawConvs) {
      const parsed = JSON.parse(rawConvs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        conversations = parsed;
      }
    }
    activeConvId = localStorage.getItem(STORAGE_KEY_ACTIVE);
  } catch {
    conversations = [];
  }

  if (conversations.length === 0) {
    const initialModel = localStorage.getItem("flame_bedrock_model") || "us.anthropic.claude-sonnet-4-6";
    const firstConv = createNewConversationObj(initialModel, "standard");
    conversations.push(firstConv);
    activeConvId = firstConv.id;
  } else if (!activeConvId || !conversations.some((c) => c.id === activeConvId)) {
    activeConvId = conversations[0].id;
  }

  function saveConversations() {
    try {
      localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(conversations));
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeConvId);
    } catch (e) {
      console.warn("No se pudo guardar en localStorage:", e);
    }
  }

  function getActiveConv() {
    return conversations.find((c) => c.id === activeConvId) || conversations[0];
  }

  // Estado del catálogo modal y pestaña derecha
  let modalState = {
    isOpen: false,
    selectedProvider: "Todos",
    searchQuery: "",
  };

  let rightTab = "olap"; // "olap" | "notebook"
  let dashState = {
    activeIdx: 0,
    filterText: "",
  };

  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">CONVERSATIONAL AI · DEEP RESEARCH · GEMINI NOTEBOOK STUDIO · AWS BEDROCK</div>
      <h2>Asistente Científico RAG & Research Notebook</h2>
      <p class="lede">
        Mantén <b>conversaciones multi-turno con memoria de seguimiento</b> como en Gemini o Claude, elige el <b>Foundation Model de AWS Bedrock</b> al inicio de cada sesión o cámbialo en cualquier momento, activa <b>Deep Research</b> para informes exhaustivos y acumula evidencia en tu <b>Research Notebook</b> conectado al Cubo OLAP de la NASA.
      </p>
    </div>

    <!-- Bedrock Hub Bar -->
    <div class="bedrock-hub-card">
      <div class="bedrock-hub-top">
        <div class="bedrock-active-box">
          <div class="bedrock-live-badge"><span class="dot-live"></span> AWS Bedrock Converse API · Memoria Multi-Turno Activa</div>
          <div class="bedrock-active-meta">
            <span class="bedrock-label">LLM de esta Conversación:</span>
            <span class="bedrock-model-name" id="bedrock-active-name">Cargando...</span>
            <span class="bedrock-pill" id="bedrock-active-provider">Anthropic</span>
            <span class="bedrock-spec-pill" id="bedrock-active-spec">Serverless · 200K</span>
          </div>
        </div>

        <div class="bedrock-hub-actions">
          <button type="button" class="btn primary small" id="btn-new-conv-top" title="Crear una nueva conversación eligiendo tu LLM preferido">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Nueva Conversación</span>
          </button>
          <button type="button" class="btn secondary small" id="btn-open-catalog">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Cambiar LLM (40 FMs)</span>
          </button>
          <button type="button" class="btn ghost small" id="btn-toggle-params" title="Ajustar parámetros de inferencia">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            <span>Parámetros</span>
          </button>
        </div>
      </div>

      <!-- Quick Selector Pills -->
      <div class="bedrock-quick-pills" id="bedrock-quick-pills"></div>

      <!-- In-line Parameter Drawer -->
      <div class="bedrock-params-drawer" id="bedrock-params-drawer" hidden>
        <div class="bedrock-params-grid">
          <div class="bedrock-param-item">
            <div class="param-head">
              <label for="param-temp">Temperatura: <b id="val-temp">0.20</b></label>
              <span class="dim small">Rigor científico vs Exploración creativa</span>
            </div>
            <input type="range" id="param-temp" min="0.0" max="1.0" step="0.05" value="0.2">
          </div>
          <div class="bedrock-param-item">
            <div class="param-head">
              <label for="param-tokens">Tokens Máximos: <b id="val-tokens">1500</b></label>
              <span class="dim small">Longitud máxima de respuesta</span>
            </div>
            <select id="param-tokens" class="bedrock-select">
              <option value="800">800 tokens (~400 palabras concisas)</option>
              <option value="1200">1200 tokens (Estándar técnico)</option>
              <option value="1500" selected>1500 tokens (Análisis profundo con OLAP)</option>
              <option value="2600">2600 tokens (Informe exhaustivo Deep Research)</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Barra de Historial de Conversaciones (Sesiones estilo Claude / Gemini) -->
    <div class="conv-sessions-bar">
      <div class="conv-sessions-left">
        <span class="conv-bar-label">🗂️ Conversaciones:</span>
        <div class="conv-tabs-scroll" id="conv-tabs-list"></div>
      </div>
      <div class="conv-sessions-right">
        <button type="button" class="btn ghost small" id="btn-export-conv" title="Exportar conversación y cuaderno en Markdown">
          📥 Exportar .MD
        </button>
        <button type="button" class="btn ghost small" id="btn-clear-conv" title="Reiniciar mensajes de esta conversación">
          🗑️ Limpiar Hilo
        </button>
      </div>
    </div>

    <!-- Main 2-Column Grid -->
    <div class="rag-layout">
      <!-- Columna Izquierda: Chatbot Multi-Turno & Deep Research -->
      <div class="panel rag-chat-col">
        <!-- Encabezado de la conversación activa -->
        <div class="conv-active-header">
          <div class="conv-title-wrap">
            <span class="conv-status-dot"></span>
            <strong id="conv-current-title">Nueva Investigación</strong>
            <span class="conv-turn-count" id="conv-turn-badge">0 turnos</span>
          </div>
          <div class="conv-mode-switch" role="group" aria-label="Modo de investigación">
            <button type="button" class="mode-pill active" data-mode="standard" id="btn-mode-standard" title="Diálogo conversacional rápido con memoria">
              💬 Chat Conversacional
            </button>
            <button type="button" class="mode-pill" data-mode="deep_research" id="btn-mode-deep" title="Investigación profunda multi-documento estilo Gemini Deep Research">
              🔬 Deep Research
            </button>
          </div>
        </div>

        <div class="rag-chips-label">Preguntas iniciales o temas de investigación:</div>
        <div class="rag-prompt-chips" id="rag-chips"></div>

        <!-- Contenedor de mensajes y pantalla de configuración inicial -->
        <div class="rag-messages" id="rag-messages"></div>

        <!-- Sugerencias dinámicas de seguimiento (Follow-ups) -->
        <div class="rag-followup-bar" id="rag-followup-bar" hidden>
          <span class="followup-label">↪ Seguimiento sugerido:</span>
          <div class="followup-chips" id="rag-followup-chips"></div>
        </div>

        <!-- Barra de entrada estilo Gemini / Claude con selector de modelo in-line -->
        <form class="rag-input-bar-v2" id="rag-form">
          <div class="rag-input-row">
            <input
              type="text"
              id="rag-input"
              placeholder="Escribe una pregunta o da seguimiento a la conversación..."
              autocomplete="off"
            />
            <button type="submit" class="btn primary" id="rag-send-btn">
              <span id="rag-send-label">Enviar</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
          <div class="rag-input-Meta-row">
            <div class="inline-model-picker-wrap">
              <span class="dim small">Responder con:</span>
              <select id="inline-model-select" class="inline-model-select" title="Cambiar el LLM de esta conversación en cualquier momento"></select>
              <button type="button" class="inline-catalog-link" id="btn-inline-catalog" title="Abrir catálogo visual de 40 modelos">Ver catálogo ↗</button>
            </div>
            <div class="inline-context-status" id="inline-context-status">
              Memoria activa · 0 fuentes ancladas
            </div>
          </div>
        </form>
      </div>

      <!-- Columna Derecha: Conmutador entre Dashboard OLAP y Gemini Research Notebook -->
      <div class="panel rag-dashboard-col">
        <div class="right-panel-tabs">
          <button type="button" class="right-tab-btn active" data-rtab="olap" id="rtab-btn-olap">
            <span>📊 Evidencia NTRS & Cubo OLAP</span>
            <span class="rtab-badge" id="rtab-olap-count">0</span>
          </button>
          <button type="button" class="right-tab-btn" data-rtab="notebook" id="rtab-btn-notebook">
            <span>📓 Research Notebook (Studio IA)</span>
            <span class="rtab-badge accent" id="rtab-notebook-count">0</span>
          </button>
        </div>

        <!-- Vista 1: Dashboard de Evidencia y Cubo OLAP -->
        <div id="rag-dashboard" class="right-tab-view"></div>

        <!-- Vista 2: Gemini Research Notebook (NotebookLM style) -->
        <div id="rag-notebook" class="right-tab-view" hidden></div>
      </div>
    </div>

    <!-- Modal: Bedrock Foundation Models Catalog GUI -->
    <div class="bedrock-modal-backdrop" id="bedrock-modal" hidden>
      <div class="bedrock-modal-dialog">
        <div class="bedrock-modal-header">
          <div class="bedrock-modal-title-box">
            <div class="bedrock-modal-eyebrow">AMAZON BEDROCK · MODEL CATALOG</div>
            <h3>Selecciona el Foundation Model para tu Conversación</h3>
            <p class="dim small">Puedes elegir tu modelo preferido al iniciar la conversación o cambiarlo en cualquier turno sin perder el historial.</p>
          </div>
          <button type="button" class="bedrock-modal-close" id="btn-close-modal" aria-label="Cerrar catálogo">✕</button>
        </div>

        <div class="bedrock-modal-toolbar">
          <div class="bedrock-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="bedrock-search-inp" placeholder="Buscar por nombre, proveedor o capacidad (ej: claude, llama, nova, deepseek, reasoning, vision)..." />
          </div>

          <div class="bedrock-filter-row" id="bedrock-provider-filters"></div>
        </div>

        <div class="bedrock-modal-body">
          <div class="bedrock-cards-grid" id="bedrock-cards-grid"></div>
        </div>

        <div class="bedrock-modal-footer">
          <div class="dim small">
            <span>Mostrando <b id="bedrock-visible-count">0</b> Foundation Models en Amazon Bedrock</span>
          </div>
          <button type="button" class="btn ghost small" id="btn-footer-close">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  // Referencias DOM
  const chipsContainer = root.querySelector("#rag-chips");
  const messagesContainer = root.querySelector("#rag-messages");
  const followupBar = root.querySelector("#rag-followup-bar");
  const followupChips = root.querySelector("#rag-followup-chips");
  const form = root.querySelector("#rag-form");
  const input = root.querySelector("#rag-input");
  const sendBtn = root.querySelector("#rag-send-btn");
  const sendLabel = root.querySelector("#rag-send-label");
  const dashContainer = root.querySelector("#rag-dashboard");
  const notebookContainer = root.querySelector("#rag-notebook");
  const quickPillsContainer = root.querySelector("#bedrock-quick-pills");

  const convTabsList = root.querySelector("#conv-tabs-list");
  const convCurrentTitle = root.querySelector("#conv-current-title");
  const convTurnBadge = root.querySelector("#conv-turn-badge");
  const btnModeStandard = root.querySelector("#btn-mode-standard");
  const btnModeDeep = root.querySelector("#btn-mode-deep");
  const inlineModelSelect = root.querySelector("#inline-model-select");
  const btnInlineCatalog = root.querySelector("#btn-inline-catalog");
  const inlineContextStatus = root.querySelector("#inline-context-status");

  const btnNewConvTop = root.querySelector("#btn-new-conv-top");
  const btnExportConv = root.querySelector("#btn-export-conv");
  const btnClearConv = root.querySelector("#btn-clear-conv");
  const btnOpenCatalog = root.querySelector("#btn-open-catalog");
  const btnToggleParams = root.querySelector("#btn-toggle-params");
  const paramsDrawer = root.querySelector("#bedrock-params-drawer");
  const paramTemp = root.querySelector("#param-temp");
  const valTemp = root.querySelector("#val-temp");
  const paramTokens = root.querySelector("#param-tokens");
  const valTokens = root.querySelector("#val-tokens");

  const rtabBtnOlap = root.querySelector("#rtab-btn-olap");
  const rtabBtnNotebook = root.querySelector("#rtab-btn-notebook");
  const rtabOlapCount = root.querySelector("#rtab-olap-count");
  const rtabNotebookCount = root.querySelector("#rtab-notebook-count");

  const modalBackdrop = root.querySelector("#bedrock-modal");
  const btnCloseModal = root.querySelector("#btn-close-modal");
  const btnFooterClose = root.querySelector("#btn-footer-close");
  const searchInput = root.querySelector("#bedrock-search-inp");
  const providerFiltersContainer = root.querySelector("#bedrock-provider-filters");
  const cardsGrid = root.querySelector("#bedrock-cards-grid");
  const visibleCountLabel = root.querySelector("#bedrock-visible-count");

  const activeNameLabel = root.querySelector("#bedrock-active-name");
  const activeProviderLabel = root.querySelector("#bedrock-active-provider");
  const activeSpecLabel = root.querySelector("#bedrock-active-spec");

  // Utilidades de modelo
  function getModelById(modelId) {
    return catalog.find((m) => m.id === modelId) || catalog[0];
  }

  function getActiveModel() {
    const conv = getActiveConv();
    return getModelById(conv.modelId);
  }

  function setConversationModel(modelId, announceInChat = true) {
    const found = catalog.find((m) => m.id === modelId);
    if (!found) return;
    const conv = getActiveConv();
    const prevModelId = conv.modelId;
    conv.modelId = modelId;
    conv.updatedAt = Date.now();
    localStorage.setItem("flame_bedrock_model", modelId);
    saveConversations();

    // Si la conversación ya tiene mensajes y el usuario cambió de modelo, registramos el evento en el hilo
    if (announceInChat && prevModelId !== modelId && conv.messages.length > 0) {
      conv.messages.push({
        id: `sys_${Date.now()}`,
        role: "system",
        text: `Modelo de la conversación cambiado a **${found.name}** (${found.provider}). Los siguientes turnos usarán este Foundation Model conservando todo el contexto de la sesión.`,
        timestamp: Date.now(),
      });
      saveConversations();
    }

    refreshAllUI();
    if (modalState.isOpen) {
      renderCatalogCards();
    }
  }

  function setConversationMode(newMode) {
    const conv = getActiveConv();
    conv.mode = newMode === "deep_research" ? "deep_research" : "standard";
    conv.updatedAt = Date.now();
    saveConversations();
    updateModeUI();
    if (conv.messages.length === 0) {
      renderMessagesList();
    }
  }

  function updateModeUI() {
    const conv = getActiveConv();
    const isDeep = conv.mode === "deep_research";
    btnModeStandard.classList.toggle("active", !isDeep);
    btnModeDeep.classList.toggle("active", isDeep);
    sendLabel.textContent = isDeep ? "Investigar a Fondo" : "Enviar";
    input.placeholder = isDeep
      ? "Escribe un tema o pregunta de seguimiento para Investigación Profunda (Deep Research)..."
      : "Escribe una pregunta o da seguimiento a la conversación (como en Gemini o Claude)...";
  }

  function createNewConversation() {
    const currentModel = getActiveModel();
    const newConv = createNewConversationObj(currentModel.id, "standard");
    conversations.unshift(newConv);
    activeConvId = newConv.id;
    dashState.activeIdx = 0;
    dashState.filterText = "";
    followupBar.hidden = true;
    saveConversations();
    refreshAllUI();
    input.focus();
  }

  function switchConversation(convId) {
    if (!conversations.some((c) => c.id === convId)) return;
    activeConvId = convId;
    dashState.activeIdx = 0;
    dashState.filterText = "";
    followupBar.hidden = true;
    saveConversations();
    refreshAllUI();
  }

  function deleteConversation(convId, e) {
    if (e) e.stopPropagation();
    conversations = conversations.filter((c) => c.id !== convId);
    if (conversations.length === 0) {
      const fallbackConv = createNewConversationObj("us.anthropic.claude-sonnet-4-6", "standard");
      conversations.push(fallbackConv);
      activeConvId = fallbackConv.id;
    } else if (activeConvId === convId) {
      activeConvId = conversations[0].id;
    }
    saveConversations();
    refreshAllUI();
  }

  function clearActiveConversation() {
    const conv = getActiveConv();
    conv.messages = [];
    conv.title = "Nueva Investigación";
    conv.updatedAt = Date.now();
    followupBar.hidden = true;
    saveConversations();
    refreshAllUI();
  }

  // Cargar catálogo desde la API
  async function loadModelsFromApi() {
    try {
      const res = await fetch(`${API_BASE}/models`);
      if (res.ok) {
        const apiData = await res.json();
        if (apiData.models && apiData.models.length > 0) {
          catalog = apiData.models;
        }
      }
    } catch {
      // Fallback a catálogo local
    }
    refreshAllUI();
  }

  function updateActiveModelUI() {
    const m = getActiveModel();
    if (!m) return;
    activeNameLabel.textContent = m.name;
    activeProviderLabel.textContent = m.provider;
    activeSpecLabel.textContent = `Serverless · ${m.context_window} · ${m.category}`;

    // Poblar el selector in-line de modelos agrupado por proveedor
    const providers = [...new Set(catalog.map((item) => item.provider))];
    inlineModelSelect.innerHTML = providers
      .map((prov) => {
        const provModels = catalog.filter((item) => item.provider === prov);
        return `
          <optgroup label="${esc(prov)}">
            ${provModels
              .map(
                (item) => `
              <option value="${esc(item.id)}" ${item.id === m.id ? "selected" : ""}>
                ${esc(item.name)} (${esc(item.provider)})
              </option>
            `
              )
              .join("")}
          </optgroup>
        `;
      })
      .join("");
  }

  function renderQuickPills() {
    const active = getActiveModel();
    const quickModels = catalog.filter((m) => QUICK_MODEL_IDS.includes(m.id));

    quickPillsContainer.innerHTML = `
      <span class="quick-pill-label">Cambiar LLM al vuelo:</span>
      ${quickModels
        .map(
          (m) => `
        <button type="button" class="bedrock-quick-pill ${m.id === active.id ? "active" : ""}" data-model-id="${m.id}">
          <span class="dot-fm"></span>
          <span>${esc(m.name)}</span>
          <span class="pill-provider">${esc(m.provider)}</span>
        </button>
      `
        )
        .join("")}
    `;

    quickPillsContainer.querySelectorAll(".bedrock-quick-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        setConversationModel(btn.dataset.modelId, true);
      });
    });
  }

  function renderConversationTabs() {
    convTabsList.innerHTML = conversations
      .map((c) => {
        const isActive = c.id === activeConvId;
        const m = getModelById(c.modelId);
        const turnCount = c.messages.filter((msg) => msg.role === "user").length;
        return `
          <div class="conv-session-tab ${isActive ? "active" : ""}" data-conv-id="${c.id}">
            <div class="conv-tab-main">
              <span class="conv-tab-icon">${c.mode === "deep_research" ? "🔬" : "💬"}</span>
              <span class="conv-tab-title">${esc(c.title)}</span>
              <span class="conv-tab-fm">${esc(m ? m.name.split(" ").slice(0, 2).join(" ") : "FM")}</span>
              <span class="conv-tab-count">${turnCount}</span>
            </div>
            <button type="button" class="conv-tab-del" data-del-id="${c.id}" title="Eliminar conversación">✕</button>
          </div>
        `;
      })
      .join("");

    convTabsList.querySelectorAll(".conv-session-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        switchConversation(tab.dataset.convId);
      });
    });

    convTabsList.querySelectorAll(".conv-tab-del").forEach((delBtn) => {
      delBtn.addEventListener("click", (e) => {
        deleteConversation(delBtn.dataset.delId, e);
      });
    });

    const conv = getActiveConv();
    const userTurns = conv.messages.filter((msg) => msg.role === "user").length;
    convCurrentTitle.textContent = conv.title;
    convTurnBadge.textContent = `${userTurns} ${userTurns === 1 ? "turno" : "turnos"}`;
    inlineContextStatus.textContent = `Memoria: ${userTurns} turnos · ${conv.pinnedSourceIds.length} fuentes ancladas en Notebook`;
    rtabOlapCount.textContent = conv.sources.length;
    rtabNotebookCount.textContent = conv.notes.length + conv.sources.length;
  }

  // Renderizar lista de mensajes o pantalla de configuración inicial
  function renderMessagesList() {
    const conv = getActiveConv();
    const activeModel = getActiveModel();

    if (conv.messages.length === 0) {
      const starterModels = catalog.filter((m) => QUICK_MODEL_IDS.slice(0, 6).includes(m.id));
      messagesContainer.innerHTML = `
        <div class="conv-onboarding-card">
          <div class="onboarding-head">
            <span class="onboarding-badge">✨ NUEVA SESIÓN CONVERSACIONAL & DEEP RESEARCH</span>
            <h3>1. Elige tu Foundation Model de preferencia para iniciar</h3>
            <p class="dim small">
              Selecciona con qué modelo de Amazon Bedrock deseas arrancar esta conversación. Podrás hacer preguntas de seguimiento con memoria continua y cambiar de LLM en cualquier momento.
            </p>
          </div>

          <div class="onboarding-models-grid">
            ${starterModels
              .map((m) => {
                const isSel = m.id === activeModel.id;
                return `
                  <button type="button" class="onboarding-fm-card ${isSel ? "selected" : ""}" data-start-fm="${m.id}">
                    <div class="ofm-top">
                      <span class="ofm-prov">${esc(m.provider)}</span>
                      ${isSel ? `<span class="ofm-check">✓ Activo</span>` : `<span class="ofm-speed">${esc(m.speed)}</span>`}
                    </div>
                    <div class="ofm-name">${esc(m.name)}</div>
                    <div class="ofm-cat">${esc(m.category)} · ${esc(m.context_window)}</div>
                  </button>
                `;
              })
              .join("")}
          </div>

          <div class="onboarding-actions-row">
            <div class="onboarding-mode-info">
              <span>Modo actual: <b>${conv.mode === "deep_research" ? "🔬 Deep Research (Investigación Profunda)" : "💬 Chat Conversacional con Memoria"}</b></span>
            </div>
            <button type="button" class="btn ghost small" id="btn-onboarding-catalog">
              Explorar los 40 modelos de Bedrock →
            </button>
          </div>
        </div>
      `;

      messagesContainer.querySelectorAll(".onboarding-fm-card").forEach((card) => {
        card.addEventListener("click", () => {
          setConversationModel(card.dataset.startFm, false);
        });
      });

      const btnOnboardCat = messagesContainer.querySelector("#btn-onboarding-catalog");
      if (btnOnboardCat) {
        btnOnboardCat.addEventListener("click", openCatalogModal);
      }
      return;
    }

    messagesContainer.innerHTML = conv.messages
      .map((msg, idx) => {
        if (msg.role === "system") {
          return `
            <div class="rag-msg-system">
              <span>🔄 ${formatBotTextInline(msg.text)}</span>
            </div>
          `;
        }

        const isUser = msg.role === "user";
        const modelInfo = msg.modelInfo || null;
        let headerHtml = "";
        let stepsHtml = "";
        let footerHtml = "";

        if (isUser) {
          headerHtml = `
            <div class="rag-user-meta">
              <span>Investigador</span>
              ${msg.mode === "deep_research" ? `<span class="deep-tag-mini">🔬 Deep Research</span>` : ""}
            </div>
          `;
        } else if (modelInfo) {
          headerHtml = `
            <div class="rag-msg-fm-header">
              <span class="rag-fm-tag">⚡ ${esc(modelInfo.provider || "Bedrock")}</span>
              <span class="rag-fm-model">${esc(modelInfo.name || "Foundation Model")}</span>
              ${msg.mode === "deep_research" ? `<span class="deep-tag-mini">🔬 Deep Research Report</span>` : ""}
              <span class="rag-fm-latency">${modelInfo.latency_ms ? (modelInfo.latency_ms / 1000).toFixed(2) + "s" : ""}</span>
              ${modelInfo.output_tokens ? `<span class="rag-fm-tokens">${modelInfo.output_tokens} tok</span>` : ""}
            </div>
          `;

          if (modelInfo.was_fallback && modelInfo.fallback_msg) {
            headerHtml += `
              <div class="rag-fallback-banner">
                ⚠️ ${esc(modelInfo.fallback_msg)}
              </div>
            `;
          }

          if (msg.researchSteps && msg.researchSteps.length > 0) {
            stepsHtml = `
              <details class="research-steps-box" ${msg.mode === "deep_research" ? "open" : ""}>
                <summary>🧭 Traza de Investigación (${msg.researchSteps.length} pasos · ${msg.papersCount || 3} fuentes NTRS + Cubo OLAP)</summary>
                <div class="research-steps-list">
                  ${msg.researchSteps
                    .map(
                      (st) => `
                    <div class="r-step-item">
                      <span class="r-step-num">${st.step}</span>
                      <div>
                        <b>${esc(st.title)}:</b> <span>${esc(st.detail)}</span>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </details>
            `;
          }

          footerHtml = `
            <div class="rag-msg-footer">
              <button type="button" class="rag-save-note-btn" data-msg-idx="${idx}" title="Guardar este hallazgo en el Research Notebook">
                📌 Guardar en Notebook
              </button>
              <button type="button" class="rag-rerun-btn" data-msg-idx="${idx}" title="Cambiar de LLM y comparar respuesta">
                🔄 Cambiar LLM / Comparar
              </button>
            </div>
          `;
        }

        return `
          <div class="rag-msg ${isUser ? "user" : "bot"}">
            <div class="rag-avatar">${isUser ? "👨‍🚀" : msg.mode === "deep_research" ? "🔬" : "🚀"}</div>
            <div class="rag-bubble ${msg.mode === "deep_research" && !isUser ? "deep-bubble" : ""}">
              ${headerHtml}
              ${stepsHtml}
              ${isUser ? `<p>${esc(msg.text)}</p>` : formatBotText(msg.text)}
              ${footerHtml}
            </div>
          </div>
        `;
      })
      .join("");

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Eventos para guardar respuesta en el Notebook
    messagesContainer.querySelectorAll(".rag-save-note-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mIdx = parseInt(btn.dataset.msgIdx, 10);
        const targetMsg = conv.messages[mIdx];
        if (!targetMsg) return;
        saveMessageToNotebook(targetMsg);
        btn.textContent = "✓ Guardado en Notebook";
        btn.disabled = true;
      });
    });

    // Eventos para comparar con otro FM
    messagesContainer.querySelectorAll(".rag-rerun-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        openCatalogModal();
      });
    });
  }

  function saveMessageToNotebook(msg) {
    const conv = getActiveConv();
    const noteTitle = msg.promptQuestion
      ? `Hallazgo: ${msg.promptQuestion.slice(0, 58)}...`
      : `Nota de ${msg.modelInfo?.name || "Bedrock FM"}`;
    conv.notes.unshift({
      id: `note_${Date.now()}`,
      title: noteTitle,
      content: msg.text,
      type: msg.mode === "deep_research" ? "Deep Research Report" : "Respuesta Conversacional",
      modelName: msg.modelInfo?.name || getActiveModel().name,
      createdAt: Date.now(),
    });
    saveConversations();
    renderConversationTabs();
    renderNotebookView();
    switchRightTab("notebook");
  }

  function formatBotTextInline(raw) {
    return esc(raw).replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  }

  function formatBotText(raw) {
    let html = esc(raw);
    // Encabezados markdown ### y ##
    html = html.replace(/^###\s+(.*?)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^##\s+(.*?)$/gm, '<h3 class="md-h3">$1</h3>');
    // Negritas
    html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    // Viñetas
    html = html.replace(/\n\s*•\s*(.*?)(?=\n|$)/g, "<li>$1</li>");
    html = html.replace(/\n\s*-\s*(.*?)(?=\n|$)/g, "<li>$1</li>");
    html = html.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");
    html = html
      .split("\n\n")
      .map((p) => {
        if (p.startsWith("<h3") || p.startsWith("<h4") || p.startsWith("<ul")) return p;
        return `<p>${p.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
    return html;
  }

  // Renderizar sugerencias de seguimiento (Follow-ups)
  function renderFollowupSuggestions(lastQuestionText) {
    const qLower = (lastQuestionText || "").toLowerCase();
    let matchedFollowups = [];

    for (const s of SAMPLES) {
      if (
        qLower.includes("silic") ||
        qLower.includes("saffire") && s.title.includes("Silicón")
      ) {
        matchedFollowups = s.followups;
        break;
      }
      if (qLower.includes("heptano") || qLower.includes("fría") || qLower.includes("flex")) {
        matchedFollowups = SAMPLES[1].followups;
        break;
      }
      if (qLower.includes("0.57") || qLower.includes("34%") || qLower.includes("exploración")) {
        matchedFollowups = SAMPLES[2].followups;
        break;
      }
      if (qLower.includes("sibal") || qLower.includes("pmma")) {
        matchedFollowups = SAMPLES[3].followups;
        break;
      }
    }

    if (!matchedFollowups || matchedFollowups.length === 0) {
      matchedFollowups = [
        "¿Qué implicaciones tiene esto para el estándar NASA-STD-6001B?",
        "¿Cómo cambiaría este resultado en una atmósfera de exploración a 0.57 atm y 34% O₂?",
        "Haz una tabla comparativa con las mediciones exactas del Cubo OLAP.",
      ];
    }

    followupBar.hidden = false;
    followupChips.innerHTML = matchedFollowups
      .map(
        (f) => `
        <button type="button" class="followup-chip" data-fup="${esc(f)}">
          <span>${esc(f)}</span>
        </button>
      `
      )
      .join("");

    followupChips.querySelectorAll(".followup-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fText = btn.dataset.fup;
        input.value = fText;
        submitQuery(fText);
      });
    });
  }

  // Render Prompt Chips iniciales
  chipsContainer.innerHTML = SAMPLES.map(
    (s, idx) => `
    <button type="button" class="rag-chip" data-idx="${idx}">
      <span>${esc(s.title)}</span>
    </button>
  `
  ).join("");

  chipsContainer.querySelectorAll(".rag-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = SAMPLES[parseInt(btn.dataset.idx, 10)];
      if (s) {
        const prompt = tr(s.prompt); // la pregunta sugerida va en el idioma activo
        input.value = prompt;
        submitQuery(prompt);
      }
    });
  });

  // Conmutador de pestañas derechas (OLAP vs Gemini Research Notebook)
  function switchRightTab(tabName) {
    rightTab = tabName === "notebook" ? "notebook" : "olap";
    rtabBtnOlap.classList.toggle("active", rightTab === "olap");
    rtabBtnNotebook.classList.toggle("active", rightTab === "notebook");
    dashContainer.hidden = rightTab !== "olap";
    notebookContainer.hidden = rightTab !== "notebook";
    if (rightTab === "olap") {
      renderDashboard();
    } else {
      renderNotebookView();
    }
  }

  rtabBtnOlap.addEventListener("click", () => switchRightTab("olap"));
  rtabBtnNotebook.addEventListener("click", () => switchRightTab("notebook"));

  // Vista 1 Derecha: Dashboard de Evidencia y Cubo OLAP
  function renderDashboard() {
    const conv = getActiveConv();
    const papers = conv.sources || [];

    if (papers.length === 0) {
      dashContainer.innerHTML = `
        <div class="rag-dash-empty">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📊</div>
          <h3>Dashboard de Experimentos y Evidencia</h3>
          <p class="dim small">
            Envía una pregunta en el chat para que el índice IVF recupere los documentos de NTRS correspondientes y despliegue aquí el <b>chunk textual de evidencia</b> y la <b>tabla de experimentos del Cubo OLAP</b>.
          </p>
          <div style="margin-top: 14px;">
            <button type="button" class="btn secondary small" id="btn-go-notebook-empty">
              📓 Abrir Research Notebook Studio
            </button>
          </div>
        </div>
      `;
      const btnGoNb = dashContainer.querySelector("#btn-go-notebook-empty");
      if (btnGoNb) btnGoNb.addEventListener("click", () => switchRightTab("notebook"));
      return;
    }

    if (dashState.activeIdx >= papers.length) {
      dashState.activeIdx = 0;
    }
    const rawPaper = papers[dashState.activeIdx] || papers[0];
    const paper = enrichPaperAndExperiments(rawPaper);
    const summary = paper.summary || {};
    const experiments = paper.experiments || [];
    const isPinned = conv.pinnedSourceIds.includes(String(paper.id_paper));
    const hw = paper.hardware || resolveHardware(paper);

    const q = (dashState.filterText || "").toLowerCase().trim();
    const filteredExps = experiments.filter((e) => {
      if (!q) return true;
      return (
        (e.nombre_material && e.nombre_material.toLowerCase().includes(q)) ||
        (e.categoria_quimica && e.categoria_quimica.toLowerCase().includes(q)) ||
        (e.fase_mision && e.fase_mision.toLowerCase().includes(q)) ||
        (e.hardware_plataforma && e.hardware_plataforma.toLowerCase().includes(q)) ||
        (e.hardware_aparato && e.hardware_aparato.toLowerCase().includes(q)) ||
        (e.hardware_sensores && e.hardware_sensores.toLowerCase().includes(q)) ||
        (e.titulo_paper && e.titulo_paper.toLowerCase().includes(q)) ||
        String(e.id_experimento).includes(q)
      );
    });

    dashContainer.innerHTML = `
      <div class="rag-dash-content">
        ${
          papers.length > 1
            ? `
          <div class="rag-doc-nav">
            ${papers
              .map(
                (p, idx) => `
              <button type="button" class="rag-doc-tab ${idx === dashState.activeIdx ? "active" : ""}" data-doc-idx="${idx}">
                <span>📄 Doc #${idx + 1}: ${esc(p.titulo_paper ? p.titulo_paper.substring(0, 24) + "..." : "Paper")}</span>
                <span class="tab-score">${((p.score || 0.85) * 100).toFixed(0)}%</span>
              </button>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }

        <div class="rag-dash-header">
          <span class="rag-topic-tag">${esc(paper.topic || "Spacecraft Fire Safety")}</span>
          <span class="dim small">NTRS ID: <b>${esc(paper.id_paper)}</b> · ${paper.year || 2024}</span>
        </div>

        <h3 class="rag-dash-title">${esc(paper.titulo_paper)}</h3>
        <div class="rag-dash-authors">${esc(paper.authors || "NASA Research Team")}</div>

        <div style="margin: 10px 0 14px 0; display:flex; gap:8px; flex-wrap:wrap;">
          <a href="${esc(paper.url || `https://ntrs.nasa.gov/citations/${paper.id_paper}`)}" target="_blank" rel="noopener" class="btn small" style="display:inline-flex; align-items:center; gap:6px;">
            <span>Ver PDF Original en NTRS</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
          <button type="button" class="btn small ${isPinned ? "primary" : "secondary"}" id="btn-pin-current-paper">
            ${isPinned ? "📌 Fuente Anclada en Notebook" : "📌 Anclar Fuente al Notebook"}
          </button>
        </div>

        <!-- Evidencia Textual Recuperada -->
        <div class="rag-chunk-card">
          <div class="rag-chunk-header">
            <div style="font-weight:600; color:#fff; font-size:0.83rem; display:flex; align-items:center; gap:6px;">
              <span>📜 Evidencia Textual Recuperada (Chunk del Embedding Titan):</span>
            </div>
            <div style="display:flex; gap:6px;">
              <span class="rag-chunk-badge">⚡ Similitud: ${((paper.score || 0.85) * 100).toFixed(1)}%</span>
              <span class="rag-chunk-badge" style="color:var(--flame-b); background:rgba(255,107,53,0.15);">Voronoi #${paper.cluster_id ?? 0}</span>
            </div>
          </div>
          <div class="rag-chunk-body">
            "${esc(paper.chunk_text || "Resumen y fragmento técnico indexado en la base vectorial IVF.")}"
          </div>
        </div>

        <!-- Hardware Experimental & Plataforma de Ensayo -->
        <div class="rag-hardware-card">
          <div class="rag-hardware-header">
            <div style="font-weight:600; color:#fff; font-size:0.83rem; display:flex; align-items:center; gap:8px;">
              <span>🛠️ Hardware Experimental & Plataforma:</span>
            </div>
            <span class="rag-hardware-badge">${esc(hw.platform_short)}</span>
          </div>

          <div class="rag-hardware-grid">
            <div class="rag-hw-item">
              <span class="rag-hw-label">Plataforma / Banco:</span>
              <span class="rag-hw-val">${esc(hw.platform)}</span>
            </div>
            <div class="rag-hw-item">
              <span class="rag-hw-label">Aparato / Inserto:</span>
              <span class="rag-hw-val">${esc(hw.apparatus)}</span>
            </div>
            <div class="rag-hw-item">
              <span class="rag-hw-label">Instalación / Entorno:</span>
              <span class="rag-hw-val">${esc(hw.facility)}</span>
            </div>
            <div class="rag-hw-item">
              <span class="rag-hw-label">Diagnósticos & Sensores:</span>
              <span class="rag-hw-val">${esc(hw.sensors)}</span>
            </div>
          </div>

          ${hw.details ? `
            <div class="rag-hw-note">
              <b>Configuración técnica:</b> ${esc(hw.details)}
            </div>
          ` : ""}
        </div>

        <!-- Métricas Consolidadas del Cubo OLAP -->
        <div style="margin-bottom: 14px;">
          <div style="font-size:0.82rem; font-weight:600; color:var(--ink); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">
            📊 Métricas Consolidadas del Paper (Cubo OLAP):
          </div>
          <div class="rag-kpi-grid">
            <div class="rag-kpi-box">
              <b>${summary.total_ensayos || experiments.length}</b>
              <span>Total Ensayos</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.presion_avg !== undefined ? summary.presion_avg + " PSI" : "14.7 PSI"}</b>
              <span>Presión Cabina</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.oxigeno_avg !== undefined ? summary.oxigeno_avg + "%" : "21.0%"}</b>
              <span>Oxígeno O₂</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.temp_max !== undefined && summary.temp_max !== null ? summary.temp_max + " °C" : "1150 °C"}</b>
              <span>Temp Pico Máx</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.tasa_avg !== null && summary.tasa_avg !== undefined ? summary.tasa_avg + " mm/s" : "-"}</b>
              <span>Tasa Medida</span>
            </div>
            <div class="rag-kpi-box">
              <b>${summary.autoext_avg !== null && summary.autoext_avg !== undefined ? summary.autoext_avg + " s" : "Autoext."}</b>
              <span>Autoextinción</span>
            </div>
          </div>
        </div>

        <!-- Tabla de Ensayos del Cubo OLAP -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:8px;">
            <div style="font-size:0.82rem; font-weight:600; color:var(--ink); text-transform:uppercase; letter-spacing:0.05em;">
              🔬 Ensayos en Microgravedad de este Paper (Cubo OLAP)
            </div>
            <span style="font-size:11px; color:var(--muted);">
              Mostrando ${filteredExps.length} de ${experiments.length} ensayos
            </span>
          </div>

          <div class="rag-exp-filter">
            <input type="text" id="rag-exp-filter-inp" placeholder="Filtrar por material, misión, hardware o ID en estos ensayos..." value="${esc(dashState.filterText)}" />
          </div>

          <div class="rag-table-wrap">
            <table class="rag-table">
              <thead>
                <tr>
                  <th style="width: 45px;">ID</th>
                  <th>Material / Combustible</th>
                  <th style="min-width: 245px;">Misión / Hardware (Por Dato)</th>
                  <th>P (PSI)</th>
                  <th>O₂ %</th>
                  <th>Flujo</th>
                  <th>Tasa Medida</th>
                  <th>Temp Pico</th>
                  <th>Autoext.</th>
                  <th style="min-width: 220px;">Documento NTRS</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredExps.length > 0
                    ? filteredExps
                        .map(
                          (exp) => `
                  <tr>
                    <td class="exp-id">#${exp.id_experimento}</td>
                    <td>
                      <span class="exp-mat-name">${esc(exp.nombre_material)}</span>
                      <span class="exp-mat-cat">${esc(exp.categoria_quimica || "")}</span>
                    </td>
                    <td>
                      <span class="exp-mission-badge">${esc(exp.fase_mision || "ISS")}</span>
                      <div style="margin-top:5px; font-size:0.75rem; color:#38bdf8; font-weight:600; line-height:1.3;">
                        🛠️ ${esc(exp.hardware_plataforma || hw.platform)}
                      </div>
                      <div style="font-size:0.72rem; color:#e2e8f0; line-height:1.3; margin-top:2px;">
                        ⚙️ ${esc(exp.hardware_aparato || hw.apparatus)}
                      </div>
                      <div style="font-size:0.68rem; color:var(--muted); line-height:1.25; margin-top:2px;">
                        📡 ${esc(exp.hardware_sensores || hw.sensors)}
                      </div>
                    </td>
                    <td>${exp.presion_psi !== null && exp.presion_psi !== undefined ? Number(exp.presion_psi).toFixed(1) : "-"}</td>
                    <td><b>${exp.oxigeno_percent !== null && exp.oxigeno_percent !== undefined ? Number(exp.oxigeno_percent).toFixed(1) + "%" : "-"}</b></td>
                    <td>${exp.flujo_aire_cm_s !== null && exp.flujo_aire_cm_s !== undefined ? exp.flujo_aire_cm_s : "-"}</td>
                    <td>${exp.tasa_propagacion_avg !== null && exp.tasa_propagacion_avg !== undefined ? exp.tasa_propagacion_avg : "-"}</td>
                    <td>${exp.temp_maxima_global ? exp.temp_maxima_global + " °C" : "-"}</td>
                    <td>${exp.tiempo_autoextincion ? exp.tiempo_autoextincion + " s" : "-"}</td>
                    <td>
                      <span class="exp-paper-title">${esc(exp.titulo_paper || paper.titulo_paper)}</span>
                      <span class="exp-paper-meta">
                        <a href="${esc(exp.url_pdf_ntrs || paper.url || `https://ntrs.nasa.gov/citations/${exp.id_paper || paper.id_paper}`)}" target="_blank" class="exp-paper-link">
                          📄 NTRS ID: ${esc(exp.id_paper || paper.id_paper)}
                        </a>
                      </span>
                    </td>
                  </tr>
                `
                        )
                        .join("")
                    : `
                  <tr>
                    <td colspan="10" style="text-align:center; padding:18px; color:var(--muted);">
                      No se encontraron ensayos que coincidan con el filtro ingresado.
                    </td>
                  </tr>
                `
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    dashContainer.querySelectorAll(".rag-doc-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.docIdx, 10);
        if (idx !== dashState.activeIdx) {
          dashState.activeIdx = idx;
          dashState.filterText = "";
          renderDashboard();
        }
      });
    });

    const btnPinPaper = dashContainer.querySelector("#btn-pin-current-paper");
    if (btnPinPaper) {
      btnPinPaper.addEventListener("click", () => {
        togglePinSource(String(paper.id_paper));
        renderDashboard();
      });
    }

    const filterInput = dashContainer.querySelector("#rag-exp-filter-inp");
    if (filterInput) {
      filterInput.addEventListener("input", (e) => {
        dashState.filterText = e.target.value;
        renderDashboard();
        const reInput = dashContainer.querySelector("#rag-exp-filter-inp");
        if (reInput) {
          reInput.focus();
          reInput.selectionStart = reInput.selectionEnd = reInput.value.length;
        }
      });
    }
  }

  function togglePinSource(paperId) {
    const conv = getActiveConv();
    const pid = String(paperId);
    const idx = conv.pinnedSourceIds.indexOf(pid);
    if (idx >= 0) {
      conv.pinnedSourceIds.splice(idx, 1);
    } else {
      conv.pinnedSourceIds.push(pid);
    }
    saveConversations();
    renderConversationTabs();
  }

  // Vista 2 Derecha: Gemini Research Notebook (Estilo Google NotebookLM)
  function renderNotebookView() {
    const conv = getActiveConv();
    const activeModel = getActiveModel();
    const sources = conv.sources || [];
    const notes = conv.notes || [];

    notebookContainer.innerHTML = `
      <div class="notebook-studio-wrap">
        <!-- Encabezado del Cuaderno -->
        <div class="notebook-head-banner">
          <div>
            <div class="notebook-eyebrow">GEMINI NOTEBOOKLM STYLE · RESEARCH WORKSPACE</div>
            <h4>Cuaderno de Investigación: ${esc(conv.title)}</h4>
            <p class="dim small">
              Sintetiza las fuentes documentales de NTRS y los experimentos del Cubo OLAP acumulados en esta conversación usando <b>${esc(activeModel.name)}</b>.
            </p>
          </div>
        </div>

        <!-- 1. Fuentes Ancladas del Cuaderno -->
        <div class="notebook-section">
          <div class="notebook-sec-title">
            <span>📚 Fuentes del Cuaderno (${sources.length} documentos NTRS + OLAP)</span>
            <span class="dim small">${conv.pinnedSourceIds.length} ancladas al contexto</span>
          </div>
          ${
            sources.length > 0
              ? `
            <div class="notebook-sources-list">
              ${sources
                .map((src) => {
                  const pid = String(src.id_paper);
                  const checked = conv.pinnedSourceIds.includes(pid);
                  return `
                    <label class="notebook-source-item ${checked ? "pinned" : ""}">
                      <input type="checkbox" class="nb-src-check" data-src-id="${esc(pid)}" ${checked ? "checked" : ""} />
                      <div class="nb-src-info">
                        <div class="nb-src-title">${esc(src.titulo_paper)}</div>
                        <div class="nb-src-meta">
                          <span>NTRS #${esc(pid)}</span> ·
                          <span>${esc(src.authors || "NASA")} (${src.year || 2024})</span> ·
                          <span>${(src.experiments || []).length} ensayos OLAP</span>
                        </div>
                      </div>
                    </label>
                  `;
                })
                .join("")}
            </div>
          `
              : `
            <div class="notebook-empty-sources">
              Aún no hay fuentes cargadas en esta conversación. Haz una pregunta en el chat o ejecuta una acción del <b>Notebook Studio</b> abajo (usará automáticamente las fuentes principales de NTRS).
            </div>
          `
          }
        </div>

        <!-- 2. Notebook Studio: Generadores de Síntesis Profunda en 1-Clic -->
        <div class="notebook-section">
          <div class="notebook-sec-title">
            <span>✨ Notebook Studio — Síntesis Profunda con ${esc(activeModel.name)}</span>
          </div>
          <div class="notebook-studio-grid">
            <button type="button" class="nb-action-card" data-nb-action="study_guide">
              <span class="nb-act-icon">📋</span>
              <div>
                <b>Guía de Estudio y Síntesis</b>
                <span>Resumen ejecutivo, glosario físico y métricas clave del Cubo OLAP.</span>
              </div>
            </button>
            <button type="button" class="nb-action-card" data-nb-action="comparison_matrix">
              <span class="nb-act-icon">⚖️</span>
              <div>
                <b>Matriz Tierra (1g) vs Órbita (0g)</b>
                <span>Contraste experimental por material y evaluación NASA-STD-6001B.</span>
              </div>
            </button>
            <button type="button" class="nb-action-card" data-nb-action="research_gaps">
              <span class="nb-act-icon">🔬</span>
              <div>
                <b>Auditoría de Brechas e Hipótesis</b>
                <span>Huecos hacia 0.57 atm / 34% O₂ y propuestas de nuevos experimentos.</span>
              </div>
            </button>
            <button type="button" class="nb-action-card" data-nb-action="faq_briefing">
              <span class="nb-act-icon">❓</span>
              <div>
                <b>Briefing FAQ Científico</b>
                <span>Las 5 preguntas y respuestas críticas con datos cuantitativos.</span>
              </div>
            </button>
          </div>

          <!-- Nota manual o síntesis personalizada -->
          <div class="nb-custom-bar">
            <input type="text" id="nb-custom-inp" placeholder="Pide un análisis personalizado al Notebook o escribe una nota para guardarla..." />
            <button type="button" class="btn primary small" id="btn-nb-generate">Generar con IA</button>
            <button type="button" class="btn secondary small" id="btn-nb-add-note">+ Guardar Nota</button>
          </div>
          <div id="nb-studio-loading" class="nb-loading-box" hidden>
            <span class="spinner"></span>
            <span id="nb-loading-text">Sintetizando fuentes del cuaderno con ${esc(activeModel.name)}...</span>
          </div>
        </div>

        <!-- 3. Notas e Informes Guardados en el Cuaderno -->
        <div class="notebook-section">
          <div class="notebook-sec-title">
            <span>📌 Notas e Informes del Cuaderno (${notes.length})</span>
            ${
              notes.length > 0
                ? `<button type="button" class="btn ghost small" id="btn-nb-export-inner">📥 Exportar Todo (.MD)</button>`
                : ""
            }
          </div>
          ${
            notes.length > 0
              ? `
            <div class="notebook-notes-list">
              ${notes
                .map(
                  (n, idx) => `
                <div class="notebook-note-card">
                  <div class="nb-note-head">
                    <div>
                      <span class="nb-note-badge">${esc(n.type || "Nota")}</span>
                      <span class="nb-note-fm">⚡ ${esc(n.modelName || "Bedrock")}</span>
                      <h5 class="nb-note-title">${esc(n.title)}</h5>
                    </div>
                    <button type="button" class="nb-note-del" data-note-idx="${idx}" title="Eliminar nota">✕</button>
                  </div>
                  <div class="nb-note-body">
                    ${formatBotText(n.content)}
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          `
              : `
            <div class="notebook-empty-sources">
              Todavía no tienes notas guardadas. Pulsa cualquiera de los botones de <b>Notebook Studio</b> arriba o haz clic en <b>"📌 Guardar en Notebook"</b> en cualquier respuesta del chat.
            </div>
          `
          }
        </div>
      </div>
    `;

    // Checkboxes de fuentes ancladas
    notebookContainer.querySelectorAll(".nb-src-check").forEach((chk) => {
      chk.addEventListener("change", () => {
        togglePinSource(chk.dataset.srcId);
        renderNotebookView();
      });
    });

    // Botones de acción de Notebook Studio
    notebookContainer.querySelectorAll(".nb-action-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        triggerNotebookAction(btn.dataset.nbAction, null);
      });
    });

    const customInp = notebookContainer.querySelector("#nb-custom-inp");
    const btnNbGen = notebookContainer.querySelector("#btn-nb-generate");
    const btnNbAddNote = notebookContainer.querySelector("#btn-nb-add-note");

    if (btnNbGen && customInp) {
      btnNbGen.addEventListener("click", () => {
        const val = customInp.value.trim();
        if (!val) return;
        customInp.value = "";
        triggerNotebookAction("custom", val);
      });
    }

    if (btnNbAddNote && customInp) {
      btnNbAddNote.addEventListener("click", () => {
        const val = customInp.value.trim();
        if (!val) return;
        conv.notes.unshift({
          id: `note_${Date.now()}`,
          title: `Nota del Investigador (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
          content: val,
          type: "Nota Manual",
          modelName: "Investigador",
          createdAt: Date.now(),
        });
        customInp.value = "";
        saveConversations();
        renderConversationTabs();
        renderNotebookView();
      });
    }

    notebookContainer.querySelectorAll(".nb-note-del").forEach((delBtn) => {
      delBtn.addEventListener("click", () => {
        const idx = parseInt(delBtn.dataset.noteIdx, 10);
        conv.notes.splice(idx, 1);
        saveConversations();
        renderConversationTabs();
        renderNotebookView();
      });
    });

    const btnNbExportInner = notebookContainer.querySelector("#btn-nb-export-inner");
    if (btnNbExportInner) {
      btnNbExportInner.addEventListener("click", exportConversationMarkdown);
    }
  }

  async function triggerNotebookAction(actionType, customPrompt = null) {
    const conv = getActiveConv();
    const activeModel = getActiveModel();
    const loadBox = notebookContainer.querySelector("#nb-studio-loading");
    const loadTxt = notebookContainer.querySelector("#nb-loading-text");
    if (loadBox) {
      loadBox.hidden = false;
      if (loadTxt) {
        loadTxt.textContent = `Ejecutando Notebook Studio con ${activeModel.name} (${activeModel.provider})...`;
      }
    }

    // Priorizar las fuentes ancladas o usar todas las de la sesión
    const activeSources =
      conv.pinnedSourceIds.length > 0
        ? conv.sources.filter((s) => conv.pinnedSourceIds.includes(String(s.id_paper)))
        : conv.sources;

    const historyPayload = conv.messages
      .filter((m) => m.role === "user" || m.role === "bot")
      .map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.text,
      }));

    try {
      const resp = await fetch(`${API_BASE}/notebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: actionType,
          sources: activeSources,
          history: historyPayload,
          custom_prompt: customPrompt,
          model_id: conv.modelId,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Error ${resp.status}: ${await resp.text()}`);
      }

      const result = await resp.json();
      conv.notes.unshift({
        id: `nb_${Date.now()}`,
        title: customPrompt ? `Síntesis: ${customPrompt.slice(0, 48)}...` : result.title,
        content: result.content,
        type: "Notebook Studio IA",
        modelName: result.model_used?.name || activeModel.name,
        createdAt: Date.now(),
      });
      conv.updatedAt = Date.now();
      saveConversations();
      renderConversationTabs();
      renderNotebookView();
    } catch (err) {
      alert(`Error al generar en el Notebook Studio: ${err.message}`);
      if (loadBox) loadBox.hidden = true;
    }
  }

  // Exportar Conversación y Cuaderno a Markdown (.md)
  function exportConversationMarkdown() {
    const conv = getActiveConv();
    const m = getActiveModel();
    let md = `# Cuaderno de Investigación — Flame in Freefall (NASA Space Apps 2026)\n\n`;
    md += `- **Título de la Sesión:** ${conv.title}\n`;
    md += `- **Foundation Model Principal (AWS Bedrock):** ${m.name} (${m.provider})\n`;
    md += `- **Fecha:** ${new Date(conv.updatedAt).toLocaleString()}\n\n`;

    if (conv.sources.length > 0) {
      md += `## 1. Fuentes Documentales NTRS & Cubo OLAP (${conv.sources.length})\n\n`;
      conv.sources.forEach((s, i) => {
        md += `### ${i + 1}. ${s.titulo_paper} (NTRS ID: ${s.id_paper})\n`;
        md += `- **Autores:** ${s.authors} (${s.year})\n`;
        if (s.summary) {
          md += `- **Métricas Cubo OLAP:** ${s.summary.total_ensayos} ensayos | P=${s.summary.presion_avg} PSI | O₂=${s.summary.oxigeno_avg}% | Temp Máx=${s.summary.temp_max} °C\n`;
        }
        md += `- **Chunk de Evidencia:** "${s.chunk_text}"\n\n`;
      });
    }

    if (conv.notes.length > 0) {
      md += `## 2. Notas e Informes del Research Notebook (${conv.notes.length})\n\n`;
      conv.notes.forEach((n, i) => {
        md += `### ${i + 1}. ${n.title} (${n.type} — ${n.modelName})\n\n${n.content}\n\n---\n\n`;
      });
    }

    if (conv.messages.length > 0) {
      md += `## 3. Historial Completo de la Conversación\n\n`;
      conv.messages.forEach((msg) => {
        if (msg.role === "user") {
          md += `### 👨‍🚀 Investigador:\n${msg.text}\n\n`;
        } else if (msg.role === "bot") {
          md += `### 🚀 ${msg.modelInfo?.name || "Asistente Bedrock"} (${msg.modelInfo?.provider || "AWS"}):\n${msg.text}\n\n`;
        }
      });
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conv.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_notebook.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Modal Catalog rendering
  function openCatalogModal() {
    modalState.isOpen = true;
    modalBackdrop.hidden = false;
    renderProviderFilterTabs();
    renderCatalogCards();
    searchInput.focus();
  }

  function closeCatalogModal() {
    modalState.isOpen = false;
    modalBackdrop.hidden = true;
  }

  btnOpenCatalog.addEventListener("click", openCatalogModal);
  btnInlineCatalog.addEventListener("click", openCatalogModal);
  btnCloseModal.addEventListener("click", closeCatalogModal);
  btnFooterClose.addEventListener("click", closeCatalogModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeCatalogModal();
  });

  btnNewConvTop.addEventListener("click", createNewConversation);
  btnExportConv.addEventListener("click", exportConversationMarkdown);
  btnClearConv.addEventListener("click", clearActiveConversation);

  btnModeStandard.addEventListener("click", () => setConversationMode("standard"));
  btnModeDeep.addEventListener("click", () => setConversationMode("deep_research"));

  inlineModelSelect.addEventListener("change", (e) => {
    setConversationModel(e.target.value, true);
  });

  // Drawer de Parámetros
  btnToggleParams.addEventListener("click", () => {
    paramsDrawer.hidden = !paramsDrawer.hidden;
    btnToggleParams.classList.toggle("active", !paramsDrawer.hidden);
  });

  paramTemp.addEventListener("input", (e) => {
    inferenceParams.temperature = parseFloat(e.target.value);
    valTemp.textContent = inferenceParams.temperature.toFixed(2);
  });

  paramTokens.addEventListener("change", (e) => {
    inferenceParams.max_tokens = parseInt(e.target.value, 10);
    valTokens.textContent = inferenceParams.max_tokens;
  });

  function renderProviderFilterTabs() {
    const providers = ["Todos", ...new Set(catalog.map((m) => m.provider))];
    providerFiltersContainer.innerHTML = providers
      .map(
        (p) => `
      <button type="button" class="bedrock-tab-pill ${p === modalState.selectedProvider ? "active" : ""}" data-provider="${p}">
        ${p}
      </button>
    `
      )
      .join("");

    providerFiltersContainer.querySelectorAll(".bedrock-tab-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        modalState.selectedProvider = btn.dataset.provider;
        renderProviderFilterTabs();
        renderCatalogCards();
      });
    });
  }

  function renderCatalogCards() {
    const q = (modalState.searchQuery || "").toLowerCase().trim();
    const pFilter = modalState.selectedProvider;
    const activeModel = getActiveModel();

    const filtered = catalog.filter((m) => {
      if (pFilter !== "Todos" && m.provider.toLowerCase() !== pFilter.toLowerCase()) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        (m.badge && m.badge.toLowerCase().includes(q))
      );
    });

    visibleCountLabel.textContent = filtered.length;

    if (filtered.length === 0) {
      cardsGrid.innerHTML = `
        <div class="bedrock-catalog-empty">
          <div style="font-size:2rem; margin-bottom:8px;">🔍</div>
          <h4>No se encontraron Foundation Models</h4>
          <p class="dim small">Intenta buscar con otros términos como 'claude', 'llama', 'nova' o selecciona otro proveedor.</p>
        </div>
      `;
      return;
    }

    cardsGrid.innerHTML = filtered
      .map((m) => {
        const isSelected = m.id === activeModel.id;
        return `
        <div class="bedrock-card ${isSelected ? "selected" : ""}" data-card-id="${m.id}">
          <div class="bedrock-card-header">
            <div class="bedrock-card-provider-pill">${esc(m.provider)}</div>
            ${m.badge ? `<div class="bedrock-card-badge">${esc(m.badge)}</div>` : ""}
          </div>

          <h4 class="bedrock-card-title">${esc(m.name)}</h4>
          <div class="bedrock-card-sub">${esc(m.family)} · ${m.modalities.join(", ")}</div>

          <p class="bedrock-card-desc">${esc(m.description)}</p>

          <div class="bedrock-card-tags">
            <span class="bedrock-tag"><span class="dot-green"></span> Serverless</span>
            <span class="bedrock-tag">Contexto: ${esc(m.context_window)}</span>
            <span class="bedrock-tag">${esc(m.speed)}</span>
          </div>

          <div class="bedrock-card-action">
            <button type="button" class="btn small ${isSelected ? "primary" : "secondary"} bedrock-select-btn" data-model-id="${m.id}">
              ${isSelected ? "✓ LLM Activo en esta Conversación" : "Usar este LLM"}
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    cardsGrid.querySelectorAll(".bedrock-select-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setConversationModel(btn.dataset.modelId, true);
        closeCatalogModal();
      });
    });

    cardsGrid.querySelectorAll(".bedrock-card").forEach((card) => {
      card.addEventListener("click", () => {
        setConversationModel(card.dataset.cardId, true);
        closeCatalogModal();
      });
    });
  }

  searchInput.addEventListener("input", (e) => {
    modalState.searchQuery = e.target.value;
    renderCatalogCards();
  });

  // Envío de consulta conversacional o Deep Research
  async function submitQuery(q) {
    if (!q || !q.trim()) return;
    const queryText = q.trim();
    const conv = getActiveConv();
    const currentModel = getActiveModel();
    const isDeep = conv.mode === "deep_research";

    // Construir historial previo antes de agregar el nuevo turno del usuario
    const priorHistory = conv.messages
      .filter((m) => m.role === "user" || m.role === "bot")
      .map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.text,
      }));

    // Si es el primer mensaje de la conversación, actualizar el título automáticamente
    if (conv.messages.filter((m) => m.role === "user").length === 0) {
      conv.title = queryText.length > 38 ? queryText.slice(0, 38) + "..." : queryText;
    }

    conv.messages.push({
      id: `u_${Date.now()}`,
      role: "user",
      text: queryText,
      mode: conv.mode,
      timestamp: Date.now(),
    });
    conv.updatedAt = Date.now();
    saveConversations();

    input.value = "";
    sendBtn.disabled = true;
    followupBar.hidden = true;
    renderConversationTabs();
    renderMessagesList();

    // Burbuja de carga
    const loadDiv = document.createElement("div");
    loadDiv.className = "rag-msg bot";
    loadDiv.id = "rag-loading-bubble";
    loadDiv.innerHTML = `
      <div class="rag-avatar">${isDeep ? "🔬" : "🚀"}</div>
      <div class="rag-bubble dim" style="display:flex; align-items:center; gap:10px;">
        <span class="spinner"></span>
        <span>
          ${
            isDeep
              ? `Ejecutando <b>Deep Research</b> multi-documento con <b>${esc(currentModel.name)}</b> (Sondeando 8 celdas Voronoi + Cubo OLAP)...`
              : `Conversando con <b>${esc(currentModel.name)}</b> (${priorHistory.length / 2} turnos en memoria) + IVF & Cubo OLAP...`
          }
        </span>
      </div>
    `;
    messagesContainer.appendChild(loadDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const resp = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: queryText,
          model_id: conv.modelId,
          n_probe: isDeep ? 8 : 3,
          top_k: isDeep ? 6 : 3,
          temperature: inferenceParams.temperature,
          max_tokens: isDeep ? Math.max(inferenceParams.max_tokens, 2600) : inferenceParams.max_tokens,
          history: priorHistory,
          mode: conv.mode,
          pinned_paper_ids: conv.pinnedSourceIds,
        }),
      });

      const loadBubble = document.getElementById("rag-loading-bubble");
      if (loadBubble) loadBubble.remove();

      if (!resp.ok) {
        throw new Error(`Error en servidor RAG (${resp.status}): ${await resp.text()}`);
      }

      const result = await resp.json();
      const retrievedDocs =
        result.all_retrieved_papers && result.all_retrieved_papers.length > 0
          ? result.all_retrieved_papers
          : result.primary_paper
          ? [result.primary_paper]
          : [];

      // Acumular fuentes únicas en la conversación (para el Dashboard y el Research Notebook)
      const existingMap = new Map(conv.sources.map((s) => [String(s.id_paper), s]));
      retrievedDocs.forEach((doc) => {
        existingMap.set(String(doc.id_paper), doc);
      });
      conv.sources = Array.from(existingMap.values());

      // Si aún no había fuentes ancladas, anclar automáticamente el documento principal
      if (conv.pinnedSourceIds.length === 0 && retrievedDocs.length > 0) {
        conv.pinnedSourceIds.push(String(retrievedDocs[0].id_paper));
      }

      conv.lastIvfStats = result.ivf_stats || null;

      conv.messages.push({
        id: `b_${Date.now()}`,
        role: "bot",
        text: result.answer,
        promptQuestion: queryText,
        mode: conv.mode,
        modelInfo: result.model_used || currentModel,
        researchSteps: result.research_steps || [],
        papersCount: retrievedDocs.length,
        timestamp: Date.now(),
      });
      conv.updatedAt = Date.now();
      saveConversations();

      refreshAllUI();
      renderFollowupSuggestions(queryText);
    } catch (err) {
      const loadBubble = document.getElementById("rag-loading-bubble");
      if (loadBubble) loadBubble.remove();

      conv.messages.push({
        id: `err_${Date.now()}`,
        role: "bot",
        text: `**[Conexión con AWS Bedrock RAG]**\n\nNo se pudo conectar con el endpoint local en \`http://127.0.0.1:5005\`. Asegúrate de que el servidor FastAPI esté activo ejecutando:\n\`python scripts/rag_api_server.py\`\n\n*Detalle técnico:* ${err.message}`,
        modelInfo: currentModel,
        timestamp: Date.now(),
      });
      saveConversations();
      renderMessagesList();
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function refreshAllUI() {
    updateActiveModelUI();
    updateModeUI();
    renderQuickPills();
    renderConversationTabs();
    renderMessagesList();
    if (rightTab === "olap") {
      renderDashboard();
    } else {
      renderNotebookView();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuery(input.value);
  });

  // Inicializar
  refreshAllUI();
  loadModelsFromApi();

  return {};
}
