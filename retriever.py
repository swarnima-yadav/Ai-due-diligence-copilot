"""Hybrid retrieval: vector search + BM25, fused with Reciprocal Rank Fusion."""
import re
from rank_bm25 import BM25Okapi
import config
import store

_cache: dict = {}


def clear_cache():
    _cache.clear()


def _tok(s: str) -> list[str]:
    return re.findall(r"\w+", s.lower())


def _company_index(company: str):
    if company not in _cache:
        data = store.collection().get(where={"company": company}, include=["documents", "metadatas"])
        _cache[company] = {
            "ids": data["ids"], "docs": data["documents"], "metas": data["metadatas"],
            "bm25": BM25Okapi([_tok(d) for d in data["documents"]]) if data["ids"] else None,
        }
    return _cache[company]


def hybrid_search(company: str, query: str, k: int = config.TOP_K, pool: int = 20) -> list[dict]:
    idx = _company_index(company)
    if not idx["ids"]:
        return []
    ranks: dict[str, float] = {}
    q_emb = store.embedder().encode([config.QUERY_PREFIX + query], normalize_embeddings=True).tolist()
    vec = store.collection().query(query_embeddings=q_emb, n_results=min(pool, len(idx["ids"])), where={"company": company})
    for r, cid in enumerate(vec["ids"][0]):
        ranks[cid] = ranks.get(cid, 0) + 1 / (60 + r)
    scores = idx["bm25"].get_scores(_tok(query))
    for r, i in enumerate(sorted(range(len(scores)), key=lambda x: -scores[x])[:pool]):
        if scores[i] > 0:
            ranks[idx["ids"][i]] = ranks.get(idx["ids"][i], 0) + 1 / (60 + r)
    lookup = {cid: i for i, cid in enumerate(idx["ids"])}
    top = sorted(ranks, key=ranks.get, reverse=True)[:k]
    return [{"id": cid, "text": idx["docs"][lookup[cid]], "meta": idx["metas"][lookup[cid]]} for cid in top]
