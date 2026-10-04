"""
Сборка «галереи» эталонных эмбеддингов из фото в dataset/.

    python build_gallery.py --data dataset --out gallery

Создаёт gallery.npz (векторы) и gallery.json (какие пива, порог «узнали»). Занимает секунды-минуты,
переобучения нет: добавили фото или новую марку в labels.json — запустили ещё раз.

Каждое исходное фото дополнительно размножается случайными искажениями (свет, поворот, размытие),
чтобы студийные снимки из интернета лучше узнавали реальные фото с телефона.
Порог «узнали» подбирается автоматически по самим фото (см. retrieval.calibrate_threshold).
"""

import argparse
import json
import pathlib
import random

import numpy as np

from common import DEFAULT_MODEL, DEFAULT_PRETRAINED, augment_image, list_photos, load_labels, make_embedder, open_image
from retrieval import DEFAULT_MARGIN, calibrate_threshold

# Как описываем пиво словами: CLIP хорошо понимает «фото банки такой-то марки» и читает крупные надписи.
TEXT_TEMPLATES = [
    "a photo of a can of {name} beer",
    "a photo of a bottle of {name} beer",
    "the label of {name} beer",
]
# «Посторонние» подписи: фото, которое ближе к ним, чем к любому пиву, не считаем пивом из каталога.
GENERIC_PROMPTS = [
    "a photo of a person", "a photo of a room", "a photo of a street", "a photo of a table",
    "a photo of food", "a photo of a glass of beer", "a photo of a bottle of water",
    "a photo of a can of soda", "a photo of wine", "a blurry photo", "a screenshot", "a photo of a wall",
]


def beer_prompts(beer: dict) -> list[str]:
    name = f"{beer['brewery']} {beer['beer']}".strip()
    return [t.format(name=name) for t in TEXT_TEMPLATES]


def text_vectors(embedder, beers: list[dict]):
    """По одному вектору на пиво (среднее по шаблонам) + «посторонние» подписи. Возвращает (векторы, индекс пива или -1)."""
    prompts = [p for b in beers for p in beer_prompts(b)]
    raw = embedder.embed_text(prompts).reshape(len(beers), len(TEXT_TEMPLATES), -1) if beers else None
    vectors, index = [], []
    if raw is not None:
        mean = raw.mean(axis=1)
        vectors.append(mean / (np.linalg.norm(mean, axis=1, keepdims=True) + 1e-9))
        index += list(range(len(beers)))
    vectors.append(embedder.embed_text(GENERIC_PROMPTS))
    index += [-1] * len(GENERIC_PROMPTS)
    return np.concatenate(vectors).astype(np.float32), np.array(index, dtype=np.int32)


def embed_dataset(data_dir: pathlib.Path, embedder, augment_count: int, rng: random.Random):
    """Возвращает эмбеддинги (оригиналы и искажённые копии), индекс пива, номер исходного фото, флаг «копия» и список пив."""
    labels = load_labels(data_dir)
    vectors, beer_index, photo_id, is_aug, beers = [], [], [], [], []
    next_photo = 0
    for slug, label in labels.items():
        photos = [(p, open_image(p)) for p in list_photos(data_dir / slug)]
        photos = [(p, im) for p, im in photos if im is not None]
        index = len(beers)
        beers.append({"key": slug, "beer": label["beer"], "brewery": label["brewery"], "photos": len(photos)})
        if not photos:  # такое пиво узнаём только по названию (см. text_vectors)
            print(f"  {slug}: фото нет, будет узнаваться по названию")
            continue
        print(f"  {slug}: {len(photos)} фото × {1 + augment_count}")

        images, flags, ids = [], [], []
        for _, original in photos:
            images.append(original)
            flags.append(False)
            ids.append(next_photo)
            for _ in range(augment_count):
                images.append(augment_image(original, rng))
                flags.append(True)
                ids.append(next_photo)
            next_photo += 1
        vectors.append(embedder.embed(images))
        beer_index += [index] * len(images)
        photo_id += ids
        is_aug += flags

    if not beers:
        raise SystemExit("В dataset/labels.json нет ни одного пива.")
    if not vectors:
        vectors = [np.zeros((0, embedder.embed_text(["x"]).shape[1]), dtype=np.float32)]
    return (
        np.concatenate(vectors),
        np.array(beer_index, dtype=np.int32),
        np.array(photo_id, dtype=np.int32),
        np.array(is_aug, dtype=bool),
        beers,
    )


def pair_similarities(embeddings, beer_index, photo_id, is_aug):
    """Сходство пар исходных фото: одного пива (разные фото) и разных пив."""
    keep = np.where(~is_aug)[0]
    sims = embeddings[keep] @ embeddings[keep].T
    same_beer = beer_index[keep][:, None] == beer_index[keep][None, :]
    different_photo = photo_id[keep][:, None] != photo_id[keep][None, :]
    upper = np.triu(np.ones_like(sims, dtype=bool), k=1)
    return sims[same_beer & different_photo & upper], sims[~same_beer & upper]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="dataset")
    parser.add_argument("--out", default="gallery", help="Имя без расширения: создаст gallery.npz и gallery.json")
    parser.add_argument("--embedder", default="clip", choices=["clip", "stub"])
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--pretrained", default=DEFAULT_PRETRAINED)
    parser.add_argument("--augment-count", type=int, default=4, help="Искажённых копий на каждое фото (0 — выключить)")
    parser.add_argument("--margin", type=float, default=DEFAULT_MARGIN, help="Насколько лучший кандидат должен оторваться от второго")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    embedder = make_embedder(args.embedder, args.model, args.pretrained)
    print("Считаем эмбеддинги фото...")
    embeddings, beer_index, photo_id, is_aug, beers = embed_dataset(
        pathlib.Path(args.data), embedder, args.augment_count, random.Random(args.seed)
    )

    same, different = pair_similarities(embeddings, beer_index, photo_id, is_aug)
    threshold, note = calibrate_threshold(same, different)
    with_photos = sum(1 for b in beers if b["photos"] > 0)
    print(f"\nПив в каталоге: {len(beers)}, из них с фото: {with_photos}, векторов фото: {len(embeddings)}")
    if len(same):
        print(f"Сходство фото одного пива: обычно {np.percentile(same, 10):.2f}–{np.percentile(same, 90):.2f}")
    if len(different):
        print(f"Сходство фото разных пив: обычно {np.percentile(different, 10):.2f}–{np.percentile(different, 95):.2f}")
    print(f"Порог «узнали по фото»: {threshold:.2f} ({note})")

    print("Считаем векторы названий (для пив без фото и как запасной путь)...")
    text_emb, text_index = text_vectors(embedder, beers)
    # Порог «фото подходит к названию» подбираем по своим фото, если они есть.
    text_min_sim = embedder.text_min_sim
    originals = np.where(~is_aug)[0]
    if len(originals):
        own = np.array([embeddings[i] @ text_emb[beer_index[i]] for i in originals])
        if len(own) >= 5:
            low, high = embedder.text_sim_bounds
            text_min_sim = float(np.clip(np.percentile(own, 10) - 0.01, low, high))
            print(f"Порог «фото подходит к названию»: {text_min_sim:.2f} (по {len(own)} фото)")

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        out.with_suffix(".npz"),
        embeddings=embeddings,
        beer_index=beer_index,
        text_embeddings=text_emb,
        text_beer_index=text_index,
    )
    out.with_suffix(".json").write_text(
        json.dumps(
            {
                "embedder": embedder.name,
                "threshold": threshold,
                "margin": args.margin,
                "text_logit_scale": embedder.text_logit_scale,
                "text_min_sim": text_min_sim,
                "beers": beers,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Готово: {out.with_suffix('.npz')} и {out.with_suffix('.json')}")
    print("Запустите сервис: uvicorn serve:app --port 8001 (см. README.md)")


if __name__ == "__main__":
    main()
