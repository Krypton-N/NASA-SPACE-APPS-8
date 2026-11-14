"""Amazon Bedrock transport for the existing conversational contract.

Same planning, refinement, explanation and organization prompts as Nemotron; only the
transport changes. Every generated statement still goes through the server's citation
location and semantic verification, so a model choice never creates a scientific fact.

Structured output uses a forced tool call whose input schema is the stage schema. Models
whose Bedrock endpoint rejects a forced tool fall back to a JSON-only instruction with the
same schema; the parsed object is checked for the required keys either way.
"""

import json
import re
from time import perf_counter

from nasa_fire_ai.llm.conversation import NemotronConversation, complete_segments_prefix
from nasa_fire_ai.llm.interfaces import ProviderFailure

_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.DOTALL)
_EMPTY = {"array": list, "string": str, "boolean": bool, "integer": int, "object": dict}


def _first_json_object(text):
    """The first complete JSON object in a model's text output."""
    text = _FENCE.sub("", text.strip())
    start = text.find("{")
    if start < 0:
        raise ProviderFailure("No JSON object in provider response")
    try:
        value, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        raise ProviderFailure("Incomplete structured provider response") from None
    return value


class BedrockConversation(NemotronConversation):
    """Conversation provider over the Bedrock Converse API (IAM credentials via boto3)."""

    provider_identity = "Amazon Bedrock"

    def __init__(self, model, *, label=None, region=None, timeout_seconds=120, structured="tool"):
        import boto3
        from botocore.config import Config

        if not 5 <= timeout_seconds <= 300:
            raise ValueError("Conversation timeout must be in 5..300 seconds")
        self.client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=Config(
                read_timeout=timeout_seconds,
                connect_timeout=10,
                retries={"max_attempts": 1, "mode": "standard"},
            ),
        )
        self.model_identity = model
        self.generation_name = label or model
        self.timeout_seconds = timeout_seconds
        self.structured = structured
        self.receipts = []

    def _converse(self, stage, system, payload, max_tokens, schema):
        user = json.dumps(payload, ensure_ascii=False)
        kwargs = {
            "modelId": self.model_identity,
            "messages": [{"role": "user", "content": [{"text": user}]}],
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0},
        }
        if self.structured == "tool":
            name = "submit_" + stage
            kwargs["system"] = [{"text": system}]
            kwargs["toolConfig"] = {
                "tools": [
                    {
                        "toolSpec": {
                            "name": name,
                            "description": "Submit the structured result for this stage.",
                            "inputSchema": {"json": schema},
                        }
                    }
                ],
                "toolChoice": {"tool": {"name": name}},
            }
        else:
            kwargs["system"] = [
                {
                    "text": system
                    + "\n\nRespond with ONLY one JSON object, without prose or code fences, "
                    + "that validates against this JSON Schema:\n"
                    + json.dumps(schema, ensure_ascii=False)
                }
            ]
        return self.client.converse(**kwargs)

    def request(self, stage, system, payload, max_tokens):
        start = perf_counter()
        receipt = {"stage": stage, "model": self.model_identity, "transport": "bedrock"}
        schema = self.response_schema(stage, payload)
        self.receipts = getattr(self, "receipts", [])
        try:
            try:
                response = self._converse(stage, system, payload, max_tokens, schema)
            except Exception as exc:
                code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
                if self.structured == "tool" and code == "ValidationException":
                    receipt["structured_fallback"] = "json_instruction"
                    self.structured = "json"
                    response = self._converse(stage, system, payload, max_tokens, schema)
                else:
                    raise
            receipt["finish_reason"] = response.get("stopReason")
            receipt["usage"] = response.get("usage")
            receipt["served_model"] = self.model_identity
            blocks = response.get("output", {}).get("message", {}).get("content", [])
            result = None
            for block in blocks:
                if "toolUse" in block:
                    result = block["toolUse"].get("input")
                    if isinstance(result, str):
                        result = _first_json_object(result)
                    break
            if result is None:
                text = "".join(b.get("text", "") for b in blocks if "text" in b)
                try:
                    result = _first_json_object(text)
                except ProviderFailure:
                    if stage != "explanation":
                        raise
                    result = complete_segments_prefix(text)
                    receipt["partial_generation"] = True
            if receipt["finish_reason"] == "max_tokens":
                receipt["partial_generation"] = True
            if not isinstance(result, dict):
                raise ProviderFailure("Expected JSON object")
            # Fill absent required keys with empty values of the declared type, as a strict
            # schema would; content is still validated downstream.
            for key in schema.get("required", []):
                if key not in result:
                    kind = schema["properties"][key].get("type", "string")
                    result[key] = _EMPTY.get(kind, str)()
                    receipt.setdefault("filled_keys", []).append(key)
            return {key.lstrip(":"): value for key, value in result.items()}
        except ProviderFailure:
            raise
        except Exception as exc:
            receipt["error_type"] = type(exc).__name__
            code = getattr(exc, "response", {}).get("Error", {}).get("Code")
            if code:
                receipt["provider_error_code"] = code
            raise ProviderFailure("Conversational provider failure") from exc
        finally:
            receipt["latency_ms"] = (perf_counter() - start) * 1000
            self.receipts.append(receipt)
