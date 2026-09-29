"""
Скачивает фото упаковки пива из открытой базы Open Food Facts (openfoodfacts.org) в dataset/<марка>/.

    python fetch_off_photos.py --data dataset

Для каждой марки из labels.json ищет товар по названию и пивоварне и берёт фото лицевой стороны.
Это официальный открытый интерфейс (без ключа, лицензия фото CC BY-SA), а не скрейпинг магазинов.
Для каждой папки создаётся SOURCES.txt со ссылками на источник, чтобы соблюсти условия лицензии.

Что важно знать:
  - Фото из базы «студийные»: чистая упаковка анфас. Для честной работы добавьте несколько своих фото
    с телефона (см. dataset/README.md) — иначе на реальных снимках качество будет ниже.
  - Нашлось не всё: у части марок в базе нет фото или нет самой марки. Отчёт в конце покажет, каких.
  - Сервис просит не больше 10 поисковых запросов в минуту, поэтому скрипт идёт неторопливо.
"""

import argparse
import io
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

from PIL import Image

from common import list_photos, load_labels

USER_AGENT = "BeerVia/0.1 (beervia.app)"


def fold(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("ё", "е")).strip()


def http_get(url: str, timeout: int = 20) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def search_products(base_url: str, beer: str, brewery: str) -> list[dict]:
    query = urllib.parse.urlencode(
        {
            "search_terms": f"{brewery} {beer}".strip(),
            "search_simple": 1,
            "action": "process",
            "json": 1,
            "page_size": 12,
            "fields": "code,product_name,brands,image_front_url",
        }
    )
    data = json.loads(http_get(f"{base_url}/cgi/search.pl?{query}"))
    return data.get("products", [])


def matches(product: dict, beer: str, brewery: str) -> bool:
    name = fold(product.get("product_name") or "")
    brands = fold(product.get("brands") or "")
    if not all(token in name for token in fold(beer).split()):
        return False
    return not brewery or all(token in f"{brands} {name}" for token in fold(brewery).split()[:1])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="dataset")
    parser.add_argument("--per-beer", type=int, default=4, help="Сколько фото брать на марку (разные товары/упаковки)")
    parser.add_argument("--only", help="Только эта папка, например punk-ipa")
    parser.add_argument("--base-url", default="https://world.openfoodfacts.org")
    parser.add_argument("--delay", type=float, default=6.5, help="Пауза между поисковыми запросами, секунд")
    args = parser.parse_args()

    data_dir = pathlib.Path(args.data)
    labels = load_labels(data_dir)
    report: list[tuple[str, str, int]] = []

    for slug, label in labels.items():
        if args.only and slug != args.only:
            continue
        folder = data_dir / slug
        folder.mkdir(parents=True, exist_ok=True)
        have = {p.name for p in list_photos(folder)}
        saved = 0
        try:
            products = [p for p in search_products(args.base_url, label["beer"], label["brewery"]) if matches(p, label["beer"], label["brewery"])]
        except Exception as exc:  # noqa: BLE001 — сеть может подвести, идём дальше
            print(f"  [ошибка поиска] {slug}: {exc}")
            report.append((slug, label["beer"], 0))
            time.sleep(args.delay)
            continue

        sources = []
        for product in products:
            if saved >= args.per_beer:
                break
            code, url = product.get("code"), product.get("image_front_url")
            name = f"off-{code}.jpg"
            if not code or not url or not url.startswith("https://") and not url.startswith("http://"):
                continue
            if name in have:
                continue
            try:
                image = Image.open(io.BytesIO(http_get(url))).convert("RGB")
            except Exception as exc:  # noqa: BLE001
                print(f"  [пропуск] {slug}/{name}: {exc}")
                continue
            image.save(folder / name, "JPEG", quality=92)
            sources.append(f"{name}\thttps://world.openfoodfacts.org/product/{code}\tOpen Food Facts, CC BY-SA 3.0")
            saved += 1

        if sources:
            with open(folder / "SOURCES.txt", "a", encoding="utf-8") as fh:
                fh.write("\n".join(sources) + "\n")
        print(f"  {slug} ({label['beer']}): скачано {saved}, всего фото в папке {len(list_photos(folder))}")
        report.append((slug, label["beer"], len(list_photos(folder))))
        time.sleep(args.delay)

    empty = [(slug, beer) for slug, beer, count in report if count == 0]
    print(f"\nГотово. Марок с фото: {len(report) - len(empty)} из {len(report)}.")
    if empty:
        print("Без фото остались (добавьте свои снимки в эти папки):")
        for slug, beer in empty:
            print(f"  dataset/{slug}/   ({beer})")


if __name__ == "__main__":
    main()
