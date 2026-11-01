"""Shared embedding model + Chroma collection."""
import chromadb
from sentence_transformers import SentenceTransformer
import config

_model = None
_client = None


def embedder() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(config.EMBED_MODEL)
    return _model


def collection():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=config.CHROMA_DIR)
    return _client.get_or_create_collection(config.COLLECTION, metadata={"hnsw:space": "cosine"})
