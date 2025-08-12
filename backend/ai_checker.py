# ai_checker.py - Semantic similarity scoring using sentence-transformers
from functools import lru_cache
from typing import Tuple

from sentence_transformers import SentenceTransformer, util

# Load model lazily to reduce startup time
@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    # This will download the model on first run and cache locally
    return SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')


def get_score(user_answer: str, expected_answer: str) -> Tuple[float, float]:
    """
    Compute semantic similarity between user answer and expected answer.
    Returns (raw_similarity, normalized_score_0_to_1)
    """
    model = get_model()
    emb1 = model.encode(user_answer or "", convert_to_tensor=True, normalize_embeddings=True)
    emb2 = model.encode(expected_answer or "", convert_to_tensor=True, normalize_embeddings=True)
    sim = float(util.cos_sim(emb1, emb2).item())  # -1..1 typically 0..1 here
    # Normalize to [0,1]
    norm = (sim + 1) / 2.0
    return sim, norm


def rubric_score(user_answer: str, expected_answer: str, marks: float) -> float:
    """Apply thresholds to convert similarity into marks."""
    _, s = get_score(user_answer, expected_answer)
    if s >= 0.85:
        return marks
    elif s >= 0.65:
        return round(marks * 0.6, 2)
    else:
        return 0.0
