from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class MiniLMEmbeddings:
    def __init__(self) -> None:
        self.model = SentenceTransformer(MODEL_NAME, device="cpu")

    def embed_query(self, text: str) -> list[float]:
        embedding = self.model.encode(
            text,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return embedding.tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return embeddings.tolist()


_embedder: MiniLMEmbeddings | None = None


def get_embedder() -> MiniLMEmbeddings:
    global _embedder
    if _embedder is None:
        _embedder = MiniLMEmbeddings()
    return _embedder


# ── KeyBERT singleton ─────────────────────────────────────────────────────────
# Instantiated once at first use so memory is allocated once, not per-request.
_kw_model = None
_kw_model_loaded = False


def get_kw_model():
    """Return a cached KeyBERT instance (or None if keybert is unavailable)."""
    global _kw_model, _kw_model_loaded
    if not _kw_model_loaded:
        _kw_model_loaded = True
        try:
            from keybert import KeyBERT
            _kw_model = KeyBERT(model=get_embedder().model)
            print("KeyBERT model loaded.")
        except Exception as e:
            print(f"KeyBERT unavailable, skipping keyword extraction: {e}")
            _kw_model = None
    return _kw_model
