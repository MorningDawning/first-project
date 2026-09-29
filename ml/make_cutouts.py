"""
Делает из фото упаковки «студийную» картинку: банка или бутылка без фона, по центру, с прозрачным фоном.
Именно такая картинка показывается в приложении после скана (как в Vivino).

    python make_cutouts.py --data dataset

Для каждой папки dataset/<марка>/ берётся самое крупное фото и сохраняется как cutout.png в той же папке.
Потом в server: npm run sync-photos:local, и приложение начнёт показывать вырезки.

Режимы (--mode):
  floodfill  (по умолчанию, если нет rembg) фон вырезается, если он однородный: белый или светлый,
             как на большинстве снимков упаковки в Open Food Facts. Фото на «живом» фоне пропускаются и в отчёте
             помечены; для них приложение покажет исходную картинку.
  rembg      нейросеть вырезает любой фон. Установка: pip install "rembg[cpu]", при первом запуске скачивается
             модель (около 170 МБ, может понадобиться VPN).
  auto       rembg, если он установлен, иначе floodfill.
"""

from __future__ import annotations

import argparse
import pathlib
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

from common import list_photos, load_labels, open_image

WORK_SIZE = 640         # длинная сторона рабочей картинки
TOLERANCE = 28          # насколько цвет может отличаться от фона, чтобы считаться фоном
UNIFORM_BORDER = 0.85   # какая доля рамки картинки должна быть цвета фона, чтобы фон считался однородным
MIN_FILL, MAX_FILL = 0.04, 0.9  # доля кадра, занятая упаковкой: меньше или больше — вырезка не удалась
PADDING = 0.06


def _border_connected(background: np.ndarray) -> np.ndarray:
    """Пиксели фона, связанные с краем картинки (заливка от рамки)."""
    height, width = background.shape
    flat = background.reshape(-1)
    visited = bytearray(height * width)
    queue: deque[int] = deque()

    def push(index: int) -> None:
        if flat[index] and not visited[index]:
            visited[index] = 1
            queue.append(index)

    for x in range(width):
        push(x)
        push((height - 1) * width + x)
    for y in range(height):
        push(y * width)
        push(y * width + width - 1)

    while queue:
        index = queue.popleft()
        y, x = divmod(index, width)
        if x > 0:
            push(index - 1)
        if x < width - 1:
            push(index + 1)
        if y > 0:
            push(index - width)
        if y < height - 1:
            push(index + width)
    return np.frombuffer(bytes(visited), dtype=np.uint8).reshape(height, width).astype(bool)


def cutout_floodfill(image: Image.Image) -> tuple[Image.Image | None, str]:
    """Вырезка по однородному фону. Возвращает (RGBA-картинка или None, пояснение)."""
    image = image.convert("RGB")
    scale = WORK_SIZE / max(image.size)
    if scale < 1:
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    array = np.asarray(image, dtype=np.int16)

    border = np.concatenate([array[0], array[-1], array[:, 0], array[:, -1]])
    background_color = np.median(border, axis=0)
    if (np.abs(border - background_color).max(axis=1) <= TOLERANCE).mean() < UNIFORM_BORDER:
        return None, "фон неоднородный (нужен rembg)"

    similar = np.abs(array - background_color).max(axis=2) <= TOLERANCE
    foreground = ~_border_connected(similar)

    alpha = Image.fromarray((foreground * 255).astype(np.uint8), "L")
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # убираем одиночные пятнышки
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))  # края чуть мягче и без белой каймы
    box = alpha.getbbox()
    if box is None:
        return None, "ничего не осталось"
    fill = (np.asarray(alpha) > 127).mean()
    if not (MIN_FILL <= fill <= MAX_FILL):
        return None, f"упаковка занимает {fill:.0%} кадра — вырезка ненадёжна"

    result = image.convert("RGBA")
    result.putalpha(alpha)
    return _crop_with_padding(result, box), "ok"


def cutout_rembg(image: Image.Image) -> tuple[Image.Image | None, str]:
    from rembg import remove  # type: ignore

    result = remove(image.convert("RGB"))
    box = result.getchannel("A").getbbox()
    return (_crop_with_padding(result, box), "ok") if box else (None, "ничего не осталось")


def _crop_with_padding(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = box
    pad_x, pad_y = round((right - left) * PADDING), round((bottom - top) * PADDING)
    box = (max(0, left - pad_x), max(0, top - pad_y), min(image.width, right + pad_x), min(image.height, bottom + pad_y))
    return image.crop(box)


def pick_source(folder: pathlib.Path) -> tuple[pathlib.Path, Image.Image] | None:
    """Самое крупное фото в папке."""
    best = None
    for path in list_photos(folder):
        image = open_image(path)
        if image is not None and (best is None or image.width * image.height > best[1].width * best[1].height):
            best = (path, image)
    return best


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="dataset")
    parser.add_argument("--mode", default="auto", choices=["auto", "floodfill", "rembg"])
    parser.add_argument("--only", help="Только эта папка")
    parser.add_argument("--force", action="store_true", help="Переделать, даже если cutout.png уже есть")
    args = parser.parse_args()

    mode = args.mode
    if mode == "auto":
        try:
            import rembg  # noqa: F401

            mode = "rembg"
        except ImportError:
            mode = "floodfill"
    make = cutout_rembg if mode == "rembg" else cutout_floodfill
    print(f"Режим: {mode}")

    data_dir = pathlib.Path(args.data)
    done = existing = 0
    failed: list[tuple[str, str]] = []
    no_photo: list[str] = []
    for slug in load_labels(data_dir):
        if args.only and slug != args.only:
            continue
        folder = data_dir / slug
        target = folder / "cutout.png"
        if target.exists() and not args.force:
            existing += 1
            continue
        source = pick_source(folder)
        if source is None:
            no_photo.append(slug)
            continue
        result, note = make(source[1])
        if result is None:
            failed.append((slug, note))
            continue
        result.save(target, "PNG")
        done += 1
        print(f"  {slug}: готово ({source[0].name})")

    print(f"\nСделано вырезок: {done}, уже были: {existing}, без фото: {len(no_photo)}, не удалось: {len(failed)}.")
    for slug, note in failed[:30]:
        print(f"  не удалось: {slug} — {note}")
    if len(failed) > 30:
        print(f"  … и ещё {len(failed) - 30}")
    print("Дальше: в папке server выполните npm run sync-photos:local")


if __name__ == "__main__":
    main()
