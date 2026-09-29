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


TEXT_PROB = 0.6        # вероятность лучшего названия, с которой считаем «узнали по названию»
TEXT_LEAD = 0.2        # и на сколько она должна превосходить вероятность второго названия
TEXT_SUGGEST_PROB = 0.25  # с какой вероятности показывать вариант в «возможно, это…»
SUGGEST_BELOW = 0.08   # варианты по фото: чуть ниже порога «узнали»


def text_probabilities(query: np.ndarray, text_embeddings: np.ndarray, scale: float):
    """Сходство фото с названиями пив (и с «посторонними» подписями вроде «фото комнаты») → вероятности."""
    sims = text_embeddings @ query
    logits = (sims - sims.max()) * scale
    probs = np.exp(logits)
    return sims, probs / probs.sum()


class Gallery:
    def __init__(
        self,
        embeddings: np.ndarray,
        beer_index: np.ndarray,
        beers: list[dict],
        meta: dict,
        text_embeddings: np.ndarray | None = None,
        text_beer_index: np.ndarray | None = None,
    ):
        self.embeddings = embeddings
        self.beer_index = beer_index
        self.beers = beers
        self.meta = meta
        self.threshold = float(meta.get("threshold", DEFAULT_THRESHOLD))
        self.margin = float(meta.get("margin", DEFAULT_MARGIN))
        self.text_embeddings = text_embeddings
        self.text_beer_index = text_beer_index
        self.text_scale = float(meta.get("text_logit_scale", 100.0))
        self.text_min_sim = float(meta.get("text_min_sim", 0.22))

    @classmethod
    def load(cls, base: str | pathlib.Path) -> "Gallery":
        base = pathlib.Path(base)
        data = np.load(base.with_suffix(".npz"))
        meta = json.loads(base.with_suffix(".json").read_text(encoding="utf-8"))
        has_text = "text_embeddings" in data.files
        return cls(
            data["embeddings"],
            data["beer_index"],
            meta["beers"],
            meta,
            data["text_embeddings"] if has_text else None,
            data["text_beer_index"] if has_text else None,
        )

    def by_text(self, embedding: np.ndarray, min_sim: float | None = None, mask: np.ndarray | None = None):
        """Узнаём по названию: (узнали?, [(индекс пива, вероятность)])."""
        if self.text_embeddings is None or len(self.text_embeddings) == 0:
            return False, []
        text, index = self.text_embeddings, self.text_beer_index
        if mask is not None:
            text, index = text[mask], index[mask]
        sims, probs = text_probabilities(embedding, text, self.text_scale)
        order = np.argsort(-probs)
        ranked = [(int(index[i]), float(probs[i]), float(sims[i])) for i in order[:5]]
        suggestions = [(b, p) for b, p, _ in ranked if b >= 0 and p >= TEXT_SUGGEST_PROB][:3]
        best_beer, best_prob, best_sim = ranked[0]
        limit = self.text_min_sim if min_sim is None else min_sim
        runner_up = ranked[1][1] if len(ranked) > 1 else 0.0
        recognized = best_beer >= 0 and best_prob >= TEXT_PROB and best_prob - runner_up >= TEXT_LEAD and best_sim >= limit
        return recognized, suggestions

    def recognize(self, embedding: np.ndarray, threshold: float | None = None, margin: float | None = None):
        """(узнали?, [(пиво, уверенность)]). Сначала сверяем с эталонными фото, затем с названиями."""
        limit = self.threshold if threshold is None else threshold
        found: list[tuple[int, float]] = []
        if len(self.embeddings):
            scores = beer_scores(embedding, self.embeddings, self.beer_index, len(self.beers))
            ok, candidates = decide(scores, limit, self.margin if margin is None else margin)
            if ok:
                return True, [(self.beers[c.index], c.score) for c in candidates]
            found = [(c.index, c.score) for c in candidates if c.score >= limit - SUGGEST_BELOW]

        ok, text_found = self.by_text(embedding)
        if ok:
            return True, [(self.beers[b], p) for b, p in text_found]
        merged = {b: s for b, s in text_found}
        merged.update(dict(found))
        ranked = sorted(merged.items(), key=lambda kv: kv[1], reverse=True)[:3]
        return False, [(self.beers[b], s) for b, s in ranked]


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
