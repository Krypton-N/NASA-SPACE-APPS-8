"""Serving caches return the same values as the uncached code and never share mutable rows."""

import snowballstemmer

from nasa_fire_ai.perf import install_caches, memoize_resolve


def test_stemming_cache_returns_the_same_stems():
    words = ["burning", "propagation", "flames", "spreading", "combustion", "burning"]
    before = [snowballstemmer.stemmer("english").stemWord(w) for w in words]
    assert install_caches()
    after = [snowballstemmer.stemmer("english").stemWord(w) for w in words]
    again = [snowballstemmer.stemmer("english").stemWord(w) for w in words]
    assert before == after == again


class FakeRegistry:
    def __init__(self):
        self.calls = 0

    def raw_resolve(self, evidence_id):
        self.calls += 1
        return None if evidence_id == "missing" else {"id": evidence_id, "location": {"row": 7}}


def test_resolve_is_computed_once_per_instance_and_returns_copies():
    resolve = memoize_resolve(FakeRegistry.raw_resolve)
    registry = FakeRegistry()
    first = resolve(registry, "E-1")
    first["location"]["row"] = 999  # a caller mutating its copy
    second = resolve(registry, "E-1")
    assert registry.calls == 1
    assert second == {"id": "E-1", "location": {"row": 7}}
    assert resolve(registry, "missing") is None and resolve(registry, "missing") is None
    other = FakeRegistry()
    resolve(other, "E-1")
    assert other.calls == 1  # caches are not shared between registries


def test_resolve_cache_is_bounded():
    resolve = memoize_resolve(FakeRegistry.raw_resolve, limit=2)
    registry = FakeRegistry()
    for evidence_id in ["A", "B", "C", "A"]:
        resolve(registry, evidence_id)
    assert registry.calls == 4  # "A" was evicted by "C" and computed again
