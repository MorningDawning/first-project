"""Поиск пива по эмбеддингу: сравниваем с «галереей» эталонных фото и решаем, узнали ли.

Вместо классификатора на фиксированный набор марок (который надо переобучать при каждой новой марке
и который всегда выбирает «одну из известных») галерея честно отвечает «не знаю», если ни одно
эталонное фото не похоже. Новая марка = новые фото + пересборка галереи, обучения нет.
"""

from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass

import numpy as np

DEFAULT_THRESHOLD = 0.80
DEFAULT_MARGIN = 0.02
TOP_K = 3


def beer_scores(query: np.ndarray, gallery: np.ndarray, beer_index: np.ndarray, n_beers: int) -> np.ndarray:
    """Для каждого пива — сходство с самым похожим эталонным фото этого пива (-1, если фото нет)."""
    similarity = gallery @ query
    scores = np.full(n_beers, -1.0, dtype=np.float32)
    np.maximum.at(scores, beer_index, similarity)
    return scores


@dataclass
class Candidate:
    index: int
    score: float


def decide(scores: np.ndarray, threshold: float, margin: float) -> tuple[bool, list[Candidate]]:
    """Узнали, если лучший кандидат достаточно похож и заметно отрывается от второго."""
    order = np.argsort(-scores)[:TOP_K]
    candidates = [Candidate(int(i), float(scores[i])) for i in order if scores[i] > -1]
    if not candidates:
        return False, []
    best = candidates[0].score
    runner_up = candidates[1].score if len(candidates) > 1 else -1.0
    return best >= threshold and (best - runner_up) >= margin, candidates


class Gallery:
    def __init__(self, embeddings: np.ndarray, beer_index: np.ndarray, beers: list[dict], meta: dict):
        self.embeddings = embeddings
        self.beer_index = beer_index
        self.beers = beers
        self.meta = meta
        self.threshold = float(meta.get("threshold", DEFAULT_THRESHOLD))
        self.margin = float(meta.get("margin", DEFAULT_MARGIN))

    @classmethod
    def load(cls, base: str | pathlib.Path) -> "Gallery":
        base = pathlib.Path(base)
        data = np.load(base.with_suffix(".npz"))
        meta = json.loads(base.with_suffix(".json").read_text(encoding="utf-8"))
        return cls(data["embeddings"], data["beer_index"], meta["beers"], meta)

    def recognize(self, embedding: np.ndarray, threshold: float | None = None, margin: float | None = None):
        scores = beer_scores(embedding, self.embeddings, self.beer_index, len(self.beers))
        recognized, candidates = decide(
            scores, self.threshold if threshold is None else threshold, self.margin if margin is None else margin
        )
        return recognized, [(self.beers[c.index], c.score) for c in candidates]


def calibrate_threshold(same: np.ndarray, different: np.ndarray) -> tuple[float, str]:
    """Порог «узнали»: между типичным сходством фото одного пива и самым высоким сходством разных пив."""
    if len(same) < 5 or len(different) < 5:
        return DEFAULT_THRESHOLD, "мало данных для подбора порога, взят стандартный"
    low_same = float(np.percentile(same, 10))
    high_diff = float(np.percentile(different, 95))
    if low_same > high_diff:
        threshold, note = (low_same + high_diff) / 2, "фото одного пива хорошо отделяются от разных"
    else:
        threshold, note = high_diff + 0.01, "фото разных пив местами похожи друг на друга — порог строгий, нужно больше и разнообразнее фото"
    return float(np.clip(threshold, 0.6, 0.97)), note
