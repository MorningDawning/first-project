"""
Дообучение CLIP для распознавания этикеток BeerVia — linear probe.

Backbone CLIP замораживается как есть (веса не меняются); обучается только
лёгкий линейный классификатор поверх эмбеддингов изображений. Это осознанный
выбор, а не упрощение: при 30-50 фото на класс полный fine-tuning backbone'а
почти гарантированно переобучится, а linear probe — стандартный и надёжный
способ адаптировать CLIP под небольшой датасет (описан ещё в оригинальной
статье CLIP как основной способ его оценки на downstream-задачах).

Каждое исходное фото дополнительно размножается случайными аугментациями
(поворот, яркость/контраст, обрезка-зум, лёгкое размытие) — это особенно
важно, если часть датасета — студийные фото товаров из интернет-магазинов:
они идеальные (ровный свет, анфас, чистый фон), а реальные фото пользователей
телефоном — нет. Аугментации частично симулируют этот разброс условий, даже
когда исходных фото немного.

Использование:
    pip install -r requirements.txt
    python train_clip.py --data dataset --out checkpoint.joblib
"""

import argparse
import json
import pathlib
import random

import joblib
import open_clip
import torch
from PIL import Image, ImageEnhance, ImageFilter
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")


def augment_image(image: Image.Image) -> Image.Image:
    """One randomized variant of `image`, simulating a phone photo instead of a studio shot."""
    width, height = image.size

    # Обрезка-зум: имитирует разное расстояние/кадрирование при съёмке.
    zoom = random.uniform(0.82, 1.0)
    crop_w, crop_h = int(width * zoom), int(height * zoom)
    left = random.randint(0, width - crop_w)
    top = random.randint(0, height - crop_h)
    image = image.crop((left, top, left + crop_w, top + crop_h)).resize((width, height))

    # Поворот: банку редко держат идеально ровно.
    angle = random.uniform(-12, 12)
    image = image.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=(128, 128, 128))

    # Яркость/контраст/насыщенность: разное освещение (окно, лампа, вспышка).
    image = ImageEnhance.Brightness(image).enhance(random.uniform(0.75, 1.25))
    image = ImageEnhance.Contrast(image).enhance(random.uniform(0.8, 1.2))
    image = ImageEnhance.Color(image).enhance(random.uniform(0.8, 1.2))

    # Лёгкое размытие: расфокус или дрожание руки — не всегда, но часто.
    if random.random() < 0.4:
        image = image.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.5, 1.8)))

    return image


def embed(image: Image.Image, model, preprocess, device: str):
    tensor = preprocess(image).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(tensor)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding.squeeze(0).cpu().numpy()


def load_dataset(data_dir: pathlib.Path, model, preprocess, device: str, augment_count: int):
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

        per_photo = 1 + augment_count
        print(f"  {slug} ({beer_name}): {len(photos)} фото × {per_photo} (с аугментацией) = {len(photos) * per_photo}")
        for photo_path in photos:
            try:
                original = Image.open(photo_path).convert("RGB")
            except Exception as exc:  # noqa: BLE001 — сообщаем и пропускаем битый файл
                print(f"    [пропуск] {photo_path.name}: {exc}")
                continue

            embeddings.append(embed(original, model, preprocess, device))
            targets.append(beer_name)

            for _ in range(augment_count):
                embeddings.append(embed(augment_image(original), model, preprocess, device))
                targets.append(beer_name)

    return embeddings, targets


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="dataset", help="Папка с датасетом (labels.json + подпапки с фото)")
    parser.add_argument("--out", default="checkpoint.joblib", help="Куда сохранить обученный классификатор")
    parser.add_argument("--model", default="ViT-B-32", help="Архитектура CLIP (см. open_clip.list_pretrained())")
    parser.add_argument("--pretrained", default="openai", help="Набор весов CLIP")
    parser.add_argument(
        "--augment-count",
        type=int,
        default=5,
        help="Сколько аугментированных копий генерировать на каждое исходное фото (0 — выключить)",
    )
    parser.add_argument("--seed", type=int, default=42, help="Seed для аугментаций (для воспроизводимости)")
    args = parser.parse_args()

    random.seed(args.seed)

    data_dir = pathlib.Path(args.data)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Устройство: {device}")

    print(f"Загружаем CLIP ({args.model}/{args.pretrained})...")
    model, _, preprocess = open_clip.create_model_and_transforms(args.model, pretrained=args.pretrained)
    model = model.to(device).eval()

    print(f"Извлекаем эмбеддинги фото (аугментаций на фото: {args.augment_count})...")
    embeddings, targets = load_dataset(data_dir, model, preprocess, device, args.augment_count)

    n_classes = len(set(targets))
    print(f"\nВсего эмбеддингов: {len(embeddings)}, марок пива с фото: {n_classes}")
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
        if args.augment_count > 0:
            print(
                "  (с аугментацией число завышено — аугментированные копии одного и того же фото "
                "могут попасть и в train, и в val. Ориентир, не точная цифра — лучше проверять "
                "на новых фото, которых не было в dataset/ вообще.)"
            )
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
