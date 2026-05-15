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
