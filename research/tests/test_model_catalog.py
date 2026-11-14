"""Per-request model routing and the Bedrock transport, without network calls."""

from types import SimpleNamespace

import pytest

from nasa_fire_ai.llm import bedrock_provider, model_catalog
from nasa_fire_ai.llm.bedrock_provider import BedrockConversation
from nasa_fire_ai.llm.interfaces import ProviderFailure
from nasa_fire_ai.services.conversation import ChatRequest


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def provider_with(responses):
    provider = BedrockConversation.__new__(BedrockConversation)
    provider.client = FakeClient(responses)
    provider.model_identity = "test.model"
    provider.generation_name = "Test model"
    provider.timeout_seconds = 30
    provider.structured = "tool"
    provider.receipts = []
    return provider


def message(*blocks, stop="tool_use"):
    return {"output": {"message": {"content": list(blocks)}}, "stopReason": stop, "usage": {}}


def test_forced_tool_result_is_returned_and_missing_keys_are_typed():
    provider = provider_with([message({"toolUse": {"input": {"queries": ["alpha"]}}})])
    plan = provider.plan("Question about an invented material", [], 2)
    assert plan["queries"] == ["alpha"]
    assert plan["information_needs"] == [] and plan["use_previous_sources"] is False
    call = provider.client.calls[0]
    assert call["toolConfig"]["toolChoice"] == {"tool": {"name": "submit_planning"}}
    assert provider.receipts[-1]["filled_keys"]


def test_rejected_forced_tool_falls_back_to_json_instruction():
    rejected = Exception("tool choice unsupported")
    rejected.response = {"Error": {"Code": "ValidationException"}}
    text = '```json\n{"retained_indices": [1, 0]}\n```'
    provider = provider_with([rejected, message({"text": text}, stop="end_turn")])
    assert provider.organize("q", [], ["a", "b"]) == {"retained_indices": [1, 0]}
    assert provider.structured == "json"
    assert "toolConfig" not in provider.client.calls[1]


def test_provider_errors_become_provider_failures():
    denied = Exception("denied")
    denied.response = {"Error": {"Code": "AccessDeniedException"}}
    provider = provider_with([denied])
    with pytest.raises(ProviderFailure):
        provider.plan("q", [], 1)
    assert provider.receipts[-1]["provider_error_code"] == "AccessDeniedException"


def test_router_falls_back_to_default_for_unknown_or_unavailable_models(monkeypatch):
    monkeypatch.setattr(model_catalog, "bedrock_available", lambda: False)
    settings = SimpleNamespace(
        nvidia_api_key="key",
        nvidia_base_url="https://example.invalid/v1",
        nvidia_phase3_model="nvidia/nemotron-3.5-super-vl-120b-a12b",
    )
    router = model_catalog.ProviderRouter(settings, 60)
    assert router.default == "nvidia/nemotron-3.5-super-vl-120b-a12b"
    assert router.select("nvidia/nemotron-3.5-lightning-30b-a3b").endswith("lightning-30b-a3b")
    assert router.select("nvidia.nemotron-super-3-120b") == router.default  # Bedrock unavailable
    assert router.select("not-a-model") == router.default
    assert router.select(None) == router.default


def test_chat_request_accepts_a_model_and_still_forbids_unknown_fields():
    assert ChatRequest(message="fire", model="us.amazon.nova-pro-v1:0").model
    with pytest.raises(ValueError):
        ChatRequest(message="fire", provider_key="secret")


def test_json_extraction_ignores_prose_around_the_object():
    assert bedrock_provider._first_json_object('Here: {"a": [1]} done') == {"a": [1]}
    with pytest.raises(ProviderFailure):
        bedrock_provider._first_json_object("no object")


def test_selected_model_reaches_plan_after_checkpoints_are_installed(monkeypatch):
    """Regression: install_checkpoints must not freeze the router to the default provider."""
    from nasa_fire_ai.services.operations import install_checkpoints

    monkeypatch.setattr(model_catalog, "bedrock_available", lambda: True)
    settings = SimpleNamespace(
        nvidia_api_key="key",
        nvidia_base_url="https://example.invalid/v1",
        nvidia_phase3_model="nvidia/nemotron-3.5-super-vl-120b-a12b",
    )
    router = model_catalog.ProviderRouter(settings, 60)

    class Recorder:
        def __init__(self, name):
            self.generation_name = name
            self.receipts = []

        def plan(self, *args):
            return {"by": self.generation_name}

    router._instances = {m["id"]: Recorder(m["id"]) for m in router.models}
    install_checkpoints(SimpleNamespace(search=SimpleNamespace(), provider=router))
    assert router.plan("q", [], 1) == {"by": router.default}
    router.select("us.amazon.nova-pro-v1:0")
    assert router.plan("q", [], 1) == {"by": "us.amazon.nova-pro-v1:0"}
    assert router.generation_name == "us.amazon.nova-pro-v1:0"


def test_default_prefers_nemotron_on_bedrock(monkeypatch):
    monkeypatch.setattr(model_catalog, "bedrock_available", lambda: True)
    monkeypatch.delenv("NASA_DEFAULT_MODEL", raising=False)
    settings = SimpleNamespace(
        nvidia_api_key="key", nvidia_base_url=None, nvidia_phase3_model="nvidia/x"
    )
    rows = model_catalog.available_models(settings)
    assert model_catalog.default_model(settings, rows) == "nvidia.nemotron-super-3-120b"
