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


def embed_dataset(data_dir: pathlib.Path, embedder, augment_count: int, rng: random.Random):
    """Возвращает эмбеддинги (оригиналы и искажённые копии), индекс пива, номер исходного фото, флаг «копия» и список пив."""
    labels = load_labels(data_dir)
    vectors, beer_index, photo_id, is_aug, beers = [], [], [], [], []
    next_photo = 0
    for slug, label in labels.items():
        photos = [(p, open_image(p)) for p in list_photos(data_dir / slug)]
        photos = [(p, im) for p, im in photos if im is not None]
        if not photos:
            print(f"  [нет фото] {slug} ({label['beer']})")
            continue
        index = len(beers)
        beers.append({"key": slug, "beer": label["beer"], "brewery": label["brewery"], "photos": len(photos)})
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

    if not vectors:
        raise SystemExit("В dataset/ нет ни одного фото. Положите фото по dataset/README.md или запустите fetch_off_photos.py")
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
    print(f"\nПив в галерее: {len(beers)}, векторов: {len(embeddings)}")
    if len(same):
        print(f"Сходство фото одного пива: обычно {np.percentile(same, 10):.2f}–{np.percentile(same, 90):.2f}")
    if len(different):
        print(f"Сходство фото разных пив: обычно {np.percentile(different, 10):.2f}–{np.percentile(different, 95):.2f}")
    print(f"Порог «узнали»: {threshold:.2f} ({note})")

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out.with_suffix(".npz"), embeddings=embeddings, beer_index=beer_index)
    out.with_suffix(".json").write_text(
        json.dumps(
            {"embedder": embedder.name, "threshold": threshold, "margin": args.margin, "beers": beers},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Готово: {out.with_suffix('.npz')} и {out.with_suffix('.json')}")
    print("Запустите сервис: uvicorn serve:app --port 8001 (см. README.md)")


if __name__ == "__main__":
    main()
