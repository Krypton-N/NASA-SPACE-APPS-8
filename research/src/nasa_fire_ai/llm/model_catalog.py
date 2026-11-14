"""Curated conversation models and per-request routing.

Retrieval embeddings stay on the NVIDIA model that built the snapshot vectors; only the
model that plans and writes changes. The catalogue lists models tested with the structured
conversation contract. A model whose credentials are absent is reported unavailable.
"""

import os
from functools import lru_cache

# id, label, family, transport, note. Order is the order shown to users.
CATALOG = [
    (
        "nvidia/nemotron-3.5-super-vl-120b-a12b",
        "Nemotron 3.5 Super 120B",
        "NVIDIA",
        "nvidia",
        "Configuration used in the published validation",
    ),
    (
        "nvidia/nemotron-3.5-lightning-30b-a3b",
        "Nemotron 3.5 Lightning 30B",
        "NVIDIA",
        "nvidia",
        "Faster NVIDIA model",
    ),
    (
        "nvidia.nemotron-super-3-120b",
        "Nemotron Super 3 120B",
        "NVIDIA",
        "bedrock",
        "NVIDIA model served by Amazon Bedrock",
    ),
    (
        "nvidia.nemotron-nano-3-30b",
        "Nemotron Nano 3 30B",
        "NVIDIA",
        "bedrock",
        "NVIDIA model served by Amazon Bedrock",
    ),
    # Claude 5.x returns AccessDenied for the team's AWS account (2026-11-14); 4.x is enabled.
    ("us.anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6", "Anthropic", "bedrock", ""),
    (
        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        "Claude Haiku 4.5",
        "Anthropic",
        "bedrock",
        "Fastest",
    ),
    ("us.anthropic.claude-opus-4-6-v1", "Claude Opus 4.6", "Anthropic", "bedrock", "Most capable"),
    ("us.amazon.nova-pro-v1:0", "Amazon Nova Pro", "Amazon", "bedrock", ""),
    ("us.amazon.nova-2-lite-v1:0", "Amazon Nova 2 Lite", "Amazon", "bedrock", ""),
    ("mistral.mistral-large-3-675b-instruct", "Mistral Large 3", "Mistral AI", "bedrock", ""),
    ("openai.gpt-oss-120b-1:0", "gpt-oss 120B", "OpenAI", "bedrock", "Open-weight model"),
    ("qwen.qwen3-next-80b-a3b", "Qwen3 Next 80B", "Qwen", "bedrock", ""),
    ("deepseek.v3.2", "DeepSeek V3.2", "DeepSeek", "bedrock", ""),
]

# Models removed after failing the structured contract can be hidden without code changes.
HIDDEN = {m.strip() for m in os.getenv("NASA_HIDDEN_MODELS", "").split(",") if m.strip()}


@lru_cache(maxsize=1)
def bedrock_available():
    if os.getenv("NASA_BEDROCK_DISABLED") == "1":  # set by serve_scientific_console.py --offline
        return False
    try:
        import boto3

        session = boto3.Session()
        return session.get_credentials() is not None and bool(session.region_name)
    except Exception:  # noqa: BLE001 - no Bedrock without boto3 or credentials
        return False


def available_models(settings):
    nvidia = bool(settings.nvidia_api_key)
    rows = []
    for model_id, label, family, transport, note in CATALOG:
        if model_id in HIDDEN:
            continue
        ok = nvidia if transport == "nvidia" else bedrock_available()
        rows.append(
            {
                "id": model_id,
                "label": label,
                "family": family,
                "provider": "NVIDIA API" if transport == "nvidia" else "Amazon Bedrock",
                "note": note,
                "available": ok,
            }
        )
    return rows


BEDROCK_DEFAULT = "nvidia.nemotron-super-3-120b"


def default_model(settings, rows):
    """NASA_DEFAULT_MODEL if usable; else Nemotron on Bedrock (same family the prompts were
    written for, no free-tier rate limit); else the NVIDIA API model; else the first usable."""
    usable = [r["id"] for r in rows if r["available"]]
    for wanted in (os.getenv("NASA_DEFAULT_MODEL"), BEDROCK_DEFAULT, settings.nvidia_phase3_model):
        if wanted and wanted in usable:
            return wanted
    return usable[0] if usable else None


class ProviderRouter:
    """Looks like one conversation provider; delegates to the model chosen per request.

    The conversation lane runs one question at a time, so `select` before `chat` is safe.
    Provider instances are created on first use and reused.
    """

    def __init__(self, settings, timeout_seconds):
        self._settings = settings
        self._timeout = timeout_seconds
        self._rows = {r["id"]: r for r in available_models(settings)}
        self._default = default_model(settings, list(self._rows.values()))
        self._instances = {}
        self._current = self._default

    @property
    def models(self):
        return list(self._rows.values())

    @property
    def default(self):
        return self._default

    def select(self, model_id):
        row = self._rows.get(model_id or "")
        self._current = model_id if row and row["available"] else self._default
        return self._current

    def _active(self):
        model_id = self._current
        if model_id not in self._instances:
            row = self._rows[model_id]
            if row["provider"] == "NVIDIA API":
                from nasa_fire_ai.llm.conversation import NemotronConversation

                provider = NemotronConversation(
                    self._settings.nvidia_api_key,
                    self._settings.nvidia_base_url,
                    model_id,
                    timeout_seconds=self._timeout,
                )
                provider.generation_name = row["label"]
            else:
                from nasa_fire_ai.llm.bedrock_provider import BedrockConversation

                provider = BedrockConversation(
                    model_id, label=row["label"], timeout_seconds=self._timeout
                )
            self._instances[model_id] = provider
        return self._instances[model_id]

    @property
    def generation_name(self):
        return self._active().generation_name

    # Explicit methods, resolved on every call. operations.install_checkpoints wraps these with
    # setattr at lane start-up; delegating through __getattr__ alone would freeze them to the
    # provider that was active then (the default), whatever model a later request selects.
    def plan(self, *args, **kwargs):
        return self._active().plan(*args, **kwargs)

    def refine(self, *args, **kwargs):
        return self._active().refine(*args, **kwargs)

    def explain(self, *args, **kwargs):
        return self._active().explain(*args, **kwargs)

    def organize(self, *args, **kwargs):
        return self._active().organize(*args, **kwargs)

    def request(self, *args, **kwargs):
        return self._active().request(*args, **kwargs)

    @property
    def receipts(self):
        return self._active().receipts

    @receipts.setter
    def receipts(self, value):
        self._active().receipts = value

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return getattr(self._active(), name)
