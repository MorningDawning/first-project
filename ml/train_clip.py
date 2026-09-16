"""
Дообучение CLIP для распознавания этикеток BeerVia — linear probe.

Backbone CLIP замораживается как есть (веса не меняются); обучается только
лёгкий линейный классификатор поверх эмбеддингов изображений. Это осознанный
выбор, а не упрощение: при 30-50 фото на класс полный fine-tuning backbone'а
почти гарантированно переобучится, а linear probe — стандартный и надёжный
способ адаптировать CLIP под небольшой датасет (описан ещё в оригинальной
статье CLIP как основной способ его оценки на downstream-задачах).

Использование:
    pip install -r requirements.txt
    python train_clip.py --data dataset --out checkpoint.joblib
"""

import argparse
import json
import pathlib

import joblib
import open_clip
import torch
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")


def load_dataset(data_dir: pathlib.Path, model, preprocess, device: str):
    labels_path = data_dir / "labels.json"
    if not labels_path.exists():
        raise SystemExit(f"Не найден {labels_path} — см. dataset/README.md")
    labels = json.loads(labels_path.read_text(encoding="utf-8"))

    embeddings, targets = [], []
    for slug, beer_name in labels.items():
        folder = data_dir / slug
        photos = sorted(p for p in folder.glob("*") if p.suffix.lower() in IMAGE_EXTENSIONS)
        if not photos:
            print(f"  [пропуск] {slug}: фото нет")
            continue

        print(f"  {slug} ({beer_name}): {len(photos)} фото")
        for photo_path in photos:
            try:
                image = Image.open(photo_path).convert("RGB")
            except Exception as exc:  # noqa: BLE001 — сообщаем и пропускаем битый файл
                print(f"    [пропуск] {photo_path.name}: {exc}")
                continue
            tensor = preprocess(image).unsqueeze(0).to(device)
            with torch.no_grad():
                embedding = model.encode_image(tensor)
                embedding = embedding / embedding.norm(dim=-1, keepdim=True)
            embeddings.append(embedding.squeeze(0).cpu().numpy())
            targets.append(beer_name)

    return embeddings, targets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default="dataset", help="Папка с датасетом (labels.json + подпапки с фото)")
    parser.add_argument("--out", default="checkpoint.joblib", help="Куда сохранить обученный классификатор")
    parser.add_argument("--model", default="ViT-B-32", help="Архитектура CLIP (см. open_clip.list_pretrained())")
    parser.add_argument("--pretrained", default="openai", help="Набор весов CLIP")
    args = parser.parse_args()

    data_dir = pathlib.Path(args.data)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Устройство: {device}")

    print(f"Загружаем CLIP ({args.model}/{args.pretrained})...")
    model, _, preprocess = open_clip.create_model_and_transforms(args.model, pretrained=args.pretrained)
    model = model.to(device).eval()

    print("Извлекаем эмбеддинги фото...")
    embeddings, targets = load_dataset(data_dir, model, preprocess, device)

    n_classes = len(set(targets))
    print(f"\nВсего фото: {len(embeddings)}, марок пива с фото: {n_classes}")
    if n_classes < 2:
        raise SystemExit(
            "Нужно минимум 2 марки пива с фото, чтобы обучить классификатор. "
            "Сложите фото в папки dataset/<марка>/ по dataset/README.md."
        )

    print("Обучаем линейный классификатор (linear probe)...")
    classifier = LogisticRegression(max_iter=2000, C=1.0)

    min_per_class = min(targets.count(t) for t in set(targets))
    if min_per_class >= 3:
        cv_folds = min(5, min_per_class)
        scores = cross_val_score(classifier, embeddings, targets, cv=cv_folds)
        print(f"Точность на кросс-валидации ({cv_folds}-fold): {scores.mean():.1%} ± {scores.std():.1%}")
    else:
        print("Слишком мало фото на класс для кросс-валидации — пропускаем оценку точности.")

    classifier.fit(embeddings, targets)

    pathlib.Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"classifier": classifier, "clip_model": args.model, "clip_pretrained": args.pretrained},
        args.out,
    )
    print(f"\nГотово! Классификатор сохранён в {args.out}")
    print("Запустите serve.py с BEERVIA_ML_CHECKPOINT, указывающим на этот файл, чтобы включить распознавание.")


if __name__ == "__main__":
    main()
