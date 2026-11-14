"""Serving-time caches that change no scientific result.

Profiling one conversation turn showed tens of thousands of repeated, pure lookups:
- `EvidenceRegistry.resolve(evidence_id)`: two SQLite queries plus a filesystem path check
  per call, ~65 000 calls per question for a few thousand distinct passages;
- Snowball stemming: ~2.5 million calls per question for a bounded vocabulary.

Both are deterministic for the immutable snapshot served by this process, so their results are
memoized here. `evidence/registry.py` is part of the snapshot's checksummed inputs and must not
change on disk, so the cache wraps the method at runtime instead of editing the file. Cached
registry rows are deep-copied on return, so callers can keep mutating their copy as before.
"""

import copy
import os
from collections import OrderedDict
from threading import Lock

_installed = False
_lock = Lock()


def _bounded_get(cache, key, compute, limit):
    if key in cache:
        cache.move_to_end(key)
        return cache[key]
    value = compute()
    cache[key] = value
    if len(cache) > limit:
        cache.popitem(last=False)
    return value


def install_caches():
    """Install the caches once per process. NASA_SERVING_CACHES=0 disables them."""
    global _installed
    if os.getenv("NASA_SERVING_CACHES", "1") != "1":
        return False
    with _lock:
        if _installed:
            return True
        from snowballstemmer import basestemmer

        from nasa_fire_ai.evidence.registry import EvidenceRegistry

        stem = basestemmer.BaseStemmer.stemWord
        stems = {}

        def cached_stem(self, word):
            key = (type(self), word)
            value = stems.get(key)
            if value is None:
                value = stem(self, word)
                if len(stems) < 500_000:
                    stems[key] = value
            return value

        basestemmer.BaseStemmer.stemWord = cached_stem

        EvidenceRegistry.resolve = memoize_resolve(EvidenceRegistry.resolve)
        _installed = True
        return True


def memoize_resolve(resolve, limit=50_000):
    """Per-instance memo of `resolve(self, evidence_id)`; every call returns a deep copy."""

    def cached_resolve(self, evidence_id):
        # One cache per registry instance: each serving lane owns its own registry.
        cache = self.__dict__.get("_resolve_cache")
        if cache is None:
            cache = self.__dict__["_resolve_cache"] = OrderedDict()
        row = _bounded_get(cache, evidence_id, lambda: resolve(self, evidence_id), limit)
        return copy.deepcopy(row)

    return cached_resolve
