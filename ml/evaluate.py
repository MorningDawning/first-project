"""
Честная проверка качества: узнаёт ли галерея фото, которых в ней нет.

    python evaluate.py --data dataset

Для каждого исходного фото: убираем его (и все его искажённые копии) из галереи и просим узнать.
Спрашиваем и оригинал, и «телефонную» версию (с искажениями). Отдельно проверяем «чужие» пива:
убираем пиво из галереи целиком — модель должна ответить «не знаю».
Пиво с одним фото проверить нельзя (нужно минимум два) — оно в отчёте отмечено.
"""

import argparse
import pathlib
import random
from collections import Counter

import numpy as np

from build_gallery import embed_dataset
from common import DEFAULT_MODEL, DEFAULT_PRETRAINED, make_embedder
from retrieval import DEFAULT_MARGIN, beer_scores, calibrate_threshold, decide
from build_gallery import pair_similarities


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="dataset")
    parser.add_argument("--embedder", default="clip", choices=["clip", "stub"])
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--pretrained", default=DEFAULT_PRETRAINED)
    parser.add_argument("--augment-count", type=int, default=4)
    parser.add_argument("--margin", type=float, default=DEFAULT_MARGIN)
    parser.add_argument("--threshold", type=float, default=None, help="Свой порог (по умолчанию подбирается)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    embedder = make_embedder(args.embedder, args.model, args.pretrained)
    emb, beer_idx, photo_id, is_aug, beers = embed_dataset(
        pathlib.Path(args.data), embedder, max(args.augment_count, 1), random.Random(args.seed)
    )
    n = len(beers)
    same, different = pair_similarities(emb, beer_idx, photo_id, is_aug)
    threshold = args.threshold if args.threshold is not None else calibrate_threshold(same, different)[0]
    print(f"\nПорог «узнали»: {threshold:.2f}, отрыв от второго кандидата: {args.margin}")

    photos_per_beer = Counter(beer_idx[~is_aug])
    top1 = top3 = accepted = accepted_right = asked = 0
    per_beer = {i: [0, 0] for i in range(n)}  # [спрашивали, узнали верно с первого места]
    confusions: Counter = Counter()

    for photo in np.unique(photo_id):
        rows = np.where(photo_id == photo)[0]
        beer = int(beer_idx[rows[0]])
        if photos_per_beer[beer] < 2:
            continue
        keep = photo_id != photo
        for q in rows:  # оригинал и все его искажённые копии
            scores = beer_scores(emb[q], emb[keep], beer_idx[keep], n)
            ok, candidates = decide(scores, threshold, args.margin)
            ranked = [c.index for c in candidates]
            asked += 1
            per_beer[beer][0] += 1
            if ranked and ranked[0] == beer:
                top1 += 1
                per_beer[beer][1] += 1
            elif ranked:
                confusions[(beers[beer]["beer"], beers[ranked[0]]["beer"])] += 1
            top3 += beer in ranked
            if ok:
                accepted += 1
                accepted_right += ranked[0] == beer

    if asked == 0:
        raise SystemExit("Нечего проверять: нужно хотя бы одно пиво с двумя и более фото.")

    print("\n=== Знакомое пиво (новое фото уже известной марки) ===")
    print(f"Верное пиво первым:  {top1 / asked:.0%}")
    print(f"Верное в первой тройке: {top3 / asked:.0%}")
    print(f"Приложение уверенно ответило: {accepted / asked:.0%} запросов, из них верно {accepted_right / max(accepted, 1):.0%}")

    # Чужое пиво: убираем его целиком, галерея не должна на него «клюнуть».
    rejected = strangers = 0
    for beer in range(n):
        rows = np.where((beer_idx == beer) & (~is_aug))[0]
        others = beer_idx != beer
        if not others.any():
            continue
        for q in rows:
            scores = beer_scores(emb[q], emb[others], beer_idx[others], n)
            ok, _ = decide(scores, threshold, args.margin)
            strangers += 1
            rejected += not ok
    print("\n=== Незнакомое пиво (такой марки в галерее нет) ===")
    print(f"Приложение честно сказало «не знаю»: {rejected / max(strangers, 1):.0%}")

    print("\n=== По маркам (сколько запросов / верно первым) ===")
    for i, b in enumerate(beers):
        asked_i, right_i = per_beer[i]
        note = f"{right_i}/{asked_i}" if asked_i else "проверить нельзя: одно фото"
        print(f"  {b['beer']:<28} фото: {b['photos']:<3} {note}")
    if confusions:
        print("\nЧаще всего путает:")
        for (want, got), count in confusions.most_common(5):
            print(f"  {want}  →  {got}: {count}")
    if args.embedder == "stub":
        print("\n(Это тест на встроенном упрощённом эмбеддере, цифры не про реальное качество.)")


if __name__ == "__main__":
    main()
