"""
Раскладывает ваши «идеальные» фото упаковок (например, сохранённые из интернет-магазина) по сортам каталога.

    1. Положите фото в папку ml/inbox/ и назовите файл по пиву: «Балтика 7.jpg», «Bud Original.png», «Hoegaarden - Белое.jpg».
    2. python import_inbox.py --cut        (разложит фото и сразу вырежет фон)
    3. в папке server: npm run sync-photos:local   (картинки появятся в приложении)

Скрипт ищет в labels.json сорт, название которого больше всего совпадает с именем файла, и копирует фото в
dataset/<папка сорта>/front.jpg. Такое фото используется вместо фото из Open Food Facts. Если совпадение
неуверенное или их несколько, файл остаётся в inbox/ и попадает в отчёт: переименуйте его точнее.
Разобранные файлы переезжают в inbox/done/.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import shutil
import subprocess
import sys

from PIL import Image

from common import load_labels, open_image

EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MIN_SCORE = 0.5   # доля совпавших слов
MIN_MARGIN = 0.15  # насколько лучший сорт должен опережать второй


def tokens(text: str) -> set[str]:
    text = text.lower().replace("ё", "е")
    return {t for t in re.split(r"[^0-9a-zа-я]+", text) if t}


def match(name: str, labels: dict[str, dict[str, str]]) -> tuple[str | None, str]:
    """Возвращает (папка сорта, пояснение). Папка None, если совпадение неуверенное."""
    wanted = tokens(name)
    if not wanted:
        return None, "в названии файла нет слов"
    scored = []
    for slug, label in labels.items():
        have = tokens(f"{label.get('brewery', '')} {label.get('beer', '')}")
        common = wanted & have
        if common:
            scored.append((len(common) / len(wanted | have), slug))
    scored.sort(reverse=True)
    if not scored:
        return None, "такого сорта нет в каталоге"
    best_score, best = scored[0]
    if best_score < MIN_SCORE:
        return None, f"похоже на «{labels[best]['brewery']} {labels[best]['beer']}», но слишком неточно"
    if len(scored) > 1 and best_score - scored[1][0] < MIN_MARGIN:
        other = labels[scored[1][1]]
        return None, f"подходит и «{labels[best]['beer']}», и «{other['beer']}»: назовите файл точнее"
    return best, "ok"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="dataset")
    parser.add_argument("--inbox", default="inbox")
    parser.add_argument("--cut", action="store_true", help="Сразу вырезать фон у разложенных фото (make_cutouts.py --force --preview)")
    args = parser.parse_args()

    data_dir, inbox = pathlib.Path(args.data), pathlib.Path(args.inbox)
    inbox.mkdir(exist_ok=True)
    labels = load_labels(data_dir)
    files = sorted(p for p in inbox.iterdir() if p.is_file() and p.suffix.lower() in EXTENSIONS)
    if not files:
        print(f"В папке {inbox} нет фото. Положите туда файлы вроде «Балтика 7.jpg» и запустите снова.")
        return

    done_dir = inbox / "done"
    placed, skipped = 0, []
    slugs: list[str] = []
    for path in files:
        # Имя файла может совпасть с папкой сорта напрямую (например, punk-ipa.jpg)
        slug, note = (path.stem, "ok") if path.stem in labels else match(path.stem, labels)
        image = open_image(path)
        if slug is None or image is None:
            skipped.append((path.name, note if image is not None else "не удалось открыть картинку"))
            continue
        folder = data_dir / slug
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("front.*"):
            old.unlink()
        image.save(folder / "front.jpg", quality=95)
        done_dir.mkdir(exist_ok=True)
        shutil.move(str(path), str(done_dir / path.name))
        placed += 1
        slugs.append(slug)
        print(f"  {path.name} → {slug} ({labels[slug]['brewery']} — {labels[slug]['beer']})")

    print(f"\nРазложено фото: {placed}, осталось в inbox: {len(skipped)}.")
    for name, why in skipped:
        print(f"  не разобрано: {name} — {why}")
    if placed and args.cut:
        print("\nВырезаем фон…")
        subprocess.run([sys.executable, "make_cutouts.py", "--data", args.data, "--force", "--preview", "--only", ",".join(slugs)], check=False)
    elif placed:
        print("Дальше: python make_cutouts.py --force --preview")


if __name__ == "__main__":
    main()
