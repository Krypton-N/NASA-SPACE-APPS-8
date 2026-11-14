"""Conversational layer over an already verified answer.

The scientific pipeline returns only statements located in, and verified against, NASA
sources. That is precise but reads like a list of excerpts and cannot rank, compare or
answer in the user's language. This layer asks the same conversation model to talk ABOUT
those verified statements: synthesize, compare, point out what is notable, explain plainly
and answer in the question's language.

It never replaces the verified answer, which stays in the response unchanged. Its output is
labelled as the assistant's interpretation, not a NASA finding, and a deterministic guard
drops any sentence that introduces a number or identifier absent from the verified facts
and the cited source passages. A sentence-level guard cannot prove that an interpretation is
right; it only prevents new values and new experiment names from entering through it.
"""

import logging
import os
import re
import unicodedata

logger = logging.getLogger(__name__)

SYSTEM = """You are the conversational voice of Flame in Freefall, a research assistant for NASA microgravity combustion and spacecraft fire-safety evidence.
You receive the user's question, recent conversation and VERIFIED FACTS: statements that the server already located in, and checked against, original NASA sources, with citation markers like [3], plus the titles of the cited sources.
Write the reply a knowledgeable colleague would give, in the SAME LANGUAGE as the user's question (Spanish question -> Spanish answer).
You may: synthesize, compare, group, rank, say which experiments or results look unusual, notable or most relevant and why, explain concepts in plain words using the facts, say what the verified facts do not cover, and suggest one or two follow-up questions.
You must not: introduce any number, unit, value, date, material, experiment, mission, instrument or finding that does not appear in the verified facts or source titles; use outside knowledge to fill gaps; present your own judgement as a NASA finding; give safety recommendations; translate experiment names, acronyms or units.
When you make a judgement (for example "the most unusual"), say it is your reading of the verified sources. Keep numbers exactly as written in the facts. Put the citation marker of each fact you rely on right after it, e.g. "... used Sibal fabric [5]". Use only markers that appear in the facts.
If the question is about this tool, explain that it searches NASA PSI experiment tables and NTRS reports, checks every generated statement against the original source, and lets users compare investigations, explore connections and open the 3D laboratory and flame simulator.
If the verified facts are empty or unrelated, say briefly that the library did not return verified evidence for this and suggest how to rephrase.
Be concise: two to five short paragraphs or a short list. No headings. No preamble about being an AI.
Return {"answer": string, "language": ISO 639-1 code of the answer}."""

SCHEMA = {
    "type": "object",
    "properties": {"answer": {"type": "string"}, "language": {"type": "string"}},
    "required": ["answer", "language"],
    "additionalProperties": False,
}

_NUMBER = re.compile(r"(?<![\w.])[-+]?\d+(?:[.,]\d+)*")
# Identifiers: acronyms and code-like names (SAFFIRE-II, PSI-98, FLEX-2, CO2, E-FIELD, Cygnus OA-6).
_IDENT = re.compile(r"\b(?=[A-Za-z0-9-]*[A-Z]{2})[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*\b")
_MARKER = re.compile(r"\[(\d+)\]")
_SENTENCE = re.compile(r"(?<=[.!?…])\s+(?=[^\s])|\n+")
# Common words that look like identifiers in either language and carry no scientific value.
_ALLOWED_IDENTS = {"NASA", "ISS", "AI", "OK", "PDF", "FAQ", "USA", "EEUU", "EE", "UU", "UV"}


def _fold(text):
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c)).lower()


def _numbers(text):
    out = set()
    for match in _NUMBER.findall(text):
        value = match.lstrip("+")
        # 0,37 (Spanish decimal) and 1,000 (thousands) both normalize to digits and one dot.
        parts = re.split(r"[.,]", value)
        out.add(value.replace(",", "."))
        out.add("".join(parts))
        if len(parts) == 2:
            out.add(parts[0] + "." + parts[1])
    return out


def _value_tokens(text):
    return {n for n in _numbers(text) if n.strip("-") not in {"0", "1", "2", "3", "4", "5"}}


def fact_base(response):
    """Everything the interpretation may rely on: verified prose, cited passages, titles."""
    parts = [response.get("answer") or ""]
    for c in response.get("citations") or []:
        parts.append(str(c.get("text") or ""))
        parts.append(str((c.get("source") or {}).get("title") or ""))
        for s in c.get("supports") or []:
            parts.append(str(s.get("claim_text") or ""))
            parts.append(str(s.get("passage") or ""))
    return "\n".join(parts)


def guard(text, base, citation_numbers):
    """Drop sentences that bring values or identifiers absent from the fact base."""
    folded_base = _fold(base)
    base_numbers = _numbers(base)
    kept, dropped = [], []
    for paragraph in re.split(r"\n\s*\n", text.strip()):
        kept_sentences = []
        for sentence in [s for s in _SENTENCE.split(paragraph) if s.strip()]:
            body = _MARKER.sub("", sentence)
            reasons = []
            for number in _value_tokens(body):
                if number not in base_numbers:
                    reasons.append("value " + number)
            for ident in set(_IDENT.findall(body)):
                if ident.upper() in _ALLOWED_IDENTS:
                    continue
                if _fold(ident) not in folded_base:
                    reasons.append("name " + ident)
            if reasons:
                dropped.append({"sentence": sentence.strip(), "reasons": reasons[:4]})
                continue
            # Keep only markers that point at a real citation.
            kept_sentences.append(
                _MARKER.sub(
                    lambda m: m.group(0) if int(m.group(1)) in citation_numbers else "",
                    sentence.strip(),
                )
            )
        if kept_sentences:
            kept.append(" ".join(kept_sentences))
    return "\n\n".join(kept), dropped


def interpret(provider, request, response, history=None):
    """Return the interpretation dict for a ChatResponse-like dict, or None if not possible."""
    if provider is None or os.getenv("NASA_INTERPRETATION_ENABLED", "1") != "1":
        return None
    citations = response.get("citations") or []
    numbers = {c.get("number") for c in citations if isinstance(c.get("number"), int)}
    facts = {
        "user_question": request.message,
        "recent_conversation": [
            {"role": m.get("role"), "text": str(m.get("content") or "")[:600]}
            for m in (history or [])[-4:]
            if isinstance(m, dict)
        ],
        "verified_answer": response.get("answer") or "",
        "answer_is_source_excerpts": (response.get("generation_status") or {}).get(
            "explanation_status"
        )
        == "EXTRACTIVE_FALLBACK",
        "cited_sources": [
            {
                "marker": c.get("number"),
                "title": (c.get("source") or {}).get("title"),
                "passage": str(c.get("text") or "")[:900],
            }
            for c in citations[:16]
        ],
    }
    try:
        result = provider.request("interpretation", SYSTEM, facts, 1600)
    except Exception as exc:  # noqa: BLE001 - the verified answer is returned regardless
        logger.warning("Interpretation unavailable: %s", type(exc).__name__)
        return {"status": "UNAVAILABLE", "text": "", "dropped": []}
    raw = str(result.get("answer") or "").strip()
    if not raw:
        return {"status": "EMPTY", "text": "", "dropped": []}
    text, dropped = guard(raw, fact_base(response), numbers)
    return {
        "status": "ACCEPTED" if text and not dropped else "PARTIAL" if text else "REJECTED",
        "text": text,
        "language": str(result.get("language") or "")[:8],
        "dropped": dropped,
        "generated_by": getattr(provider, "generation_name", None),
        "label": "Assistant interpretation of the verified sources; not a NASA finding.",
    }
