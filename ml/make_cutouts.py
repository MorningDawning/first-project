"""
Делает из фото упаковки «студийную» картинку: банка или бутылка без фона, по центру, с прозрачным фоном.
Именно такая картинка показывается в приложении после скана (как в Vivino).

    python make_cutouts.py --data dataset

Для каждой папки dataset/<марка>/ берётся самое крупное фото и сохраняется как cutout.png в той же папке.
Потом в server: npm run sync-photos:local, и приложение начнёт показывать вырезки.

Режимы (--mode):
  floodfill  фон вырезается, если он однородный (белый или светлый, как на студийных снимках). Быстро и чисто,
             но на «живом» фоне не работает.
  grabcut    алгоритм OpenCV: выделяет предмет в центре кадра на любом фоне, без скачивания моделей.
             Часто срезает горлышки и края, на проверке с настоящими фото получилось плохо. Только если
             хотите попробовать сами; в auto он не используется.
  birefnet   нейросеть BiRefNet с Hugging Face (лицензия MIT): лучшее качество из доступных, вырезает любой
             фон и убирает тень. Нужно: pip install -r requirements-cutout.txt. На процессоре 10–30 секунд
             на фото. Первый запуск скачивает модель (несколько сотен МБ, может понадобиться VPN).
  rembg      нейросеть вырезает любой фон и убирает тень. Установка: pip install "rembg[cpu]", при первом
             запуске скачивается модель (около 170 МБ, может понадобиться VPN). На самых новых версиях
             Python может не ставиться.
  auto       (по умолчанию) birefnet, если установлен; иначе rembg; иначе только floodfill. Если вырезка
             не получается чисто, лучше оставить целое фото упаковки, чем показывать обрубок.

С флагом --preview рядом с датасетом сохраняется картинка cutout-preview.jpg: слева оригиналы, справа то, что
получилось, на цветном фоне. Так сразу видно, где вырезка удалась, а где нет.
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


def cutout_grabcut(image: Image.Image) -> tuple[Image.Image | None, str]:
    """Вырезка алгоритмом GrabCut (OpenCV): предмет в центре кадра, любой фон, без нейросети."""
    try:
        import cv2
    except ImportError:
        return None, "не установлен opencv (pip install opencv-python-headless)"

    image = image.convert("RGB")
    scale = min(1.0, 560 / max(image.size))
    if scale < 1:
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    height, width = image.height, image.width
    bgr = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)

    # Начальная разметка: рамка кадра — точно фон, центр — вероятно предмет, остальное — вероятно фон.
    mask = np.full((height, width), cv2.GC_PR_BGD, dtype=np.uint8)
    mx, my = max(2, round(width * 0.04)), max(2, round(height * 0.03))
    mask[:my, :] = mask[-my:, :] = cv2.GC_BGD
    mask[:, :mx] = mask[:, -mx:] = cv2.GC_BGD
    # Границы подобраны по проверке на пёстрых фонах: узкая область «вероятно предмет» даёт заметно чище края.
    mask[round(height * 0.12) : round(height * 0.9), round(width * 0.33) : round(width * 0.67)] = cv2.GC_PR_FGD
    mask[round(height * 0.3) : round(height * 0.7), round(width * 0.42) : round(width * 0.58)] = cv2.GC_FGD
    try:
        cv2.grabCut(bgr, mask, None, np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64), 6, cv2.GC_INIT_WITH_MASK)
    except cv2.error as exc:
        return None, f"GrabCut не справился ({exc.err})"

    foreground = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    # Оставляем самую крупную связную область (остальные пятна — обрывки фона) и закрываем дырки внутри.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground, connectivity=8)
    if count <= 1:
        return None, "ничего не осталось"
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    foreground = (labels == biggest).astype(np.uint8)
    contours, _ = cv2.findContours(foreground, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(foreground)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)

    fill = filled.mean()
    if not (MIN_FILL <= fill <= MAX_FILL):
        return None, f"предмет занимает {fill:.0%} кадра — вырезка ненадёжна"

    alpha = Image.fromarray(filled * 255, "L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
    box = alpha.getbbox()
    if box is None:
        return None, "ничего не осталось"
    result = image.convert("RGBA")
    result.putalpha(alpha)
    return _crop_with_padding(result, box), "ok"


def finish_from_alpha(rgb: Image.Image, alpha: Image.Image) -> tuple[Image.Image | None, str]:
    """Общая доводка для нейросетевых режимов: чистим маску, проверяем и обрезаем по предмету.

    alpha — полутоновая маска (0 — фон, 255 — предмет) того же размера, что и rgb.
    """
    solid = np.asarray(alpha) > 127
    if not solid.any():
        return None, "ничего не осталось"
    # Оставляем самую крупную область: мелкие «острова» (надписи на фоне, тени) — не часть упаковки.
    try:
        import cv2

        count, labels, stats, _ = cv2.connectedComponentsWithStats(solid.astype(np.uint8), connectivity=8)
        if count > 1:
            biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            keep = labels == biggest
            contours, _ = cv2.findContours(keep.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            filled = np.zeros(keep.shape, np.uint8)
            cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)  # закрываем дырки внутри
            keep = filled.astype(bool)
            alpha = Image.fromarray(np.where(keep & ~solid, 255, np.asarray(alpha) * keep).astype(np.uint8), "L")
            solid = keep
    except ImportError:
        pass
    fill = solid.mean()
    if not (MIN_FILL <= fill <= MAX_FILL):
        return None, f"предмет занимает {fill:.0%} кадра — вырезка ненадёжна"
    box = alpha.point(lambda v: 255 if v > 127 else 0).getbbox()
    if box is None:
        return None, "ничего не осталось"
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return _crop_with_padding(result, box), "ok"


_BIREFNET: dict = {}
BIREFNET_SIZE = 1024


def birefnet_available() -> bool:
    try:
        import einops, kornia, timm, torch, torchvision, transformers  # noqa: F401, E401
    except ImportError:
        return False
    return True


def cutout_birefnet(image: Image.Image) -> tuple[Image.Image | None, str]:
    """Вырезка нейросетью BiRefNet (Hugging Face, лицензия MIT): аккуратные края, убирает тень."""
    if not birefnet_available():
        return None, "не установлено (pip install -r requirements-cutout.txt)"
    import torch
    from torchvision import transforms
    from transformers import AutoModelForImageSegmentation

    if "model" not in _BIREFNET:
        print("Загружаем BiRefNet (первый раз скачивается несколько сотен мегабайт)...")
        try:
            model = AutoModelForImageSegmentation.from_pretrained(
                "ZhengPeng7/BiRefNet_lite", trust_remote_code=True, low_cpu_mem_usage=False
            )
        except TypeError:
            model = AutoModelForImageSegmentation.from_pretrained("ZhengPeng7/BiRefNet_lite", trust_remote_code=True)
        _BIREFNET["model"] = model.eval()
    model = _BIREFNET["model"]

    rgb = image.convert("RGB")
    prepare = transforms.Compose(
        [
            transforms.Resize((BIREFNET_SIZE, BIREFNET_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    with torch.no_grad():
        prediction = model(prepare(rgb).unsqueeze(0))[-1].sigmoid().cpu()[0].squeeze()
    alpha = transforms.ToPILImage()(prediction).resize(rgb.size, Image.LANCZOS)
    return finish_from_alpha(rgb, alpha)


def cutout_rembg(image: Image.Image) -> tuple[Image.Image | None, str]:
    from rembg import remove  # type: ignore

    rgb = image.convert("RGB")
    return finish_from_alpha(rgb, remove(rgb).getchannel("A"))


def cutout_auto(image: Image.Image) -> tuple[Image.Image | None, str]:
    """Самое качественное из доступного. Без нейросети вырезаем только по однородному фону: там результат
    чистый; иначе лучше показать целое фото, чем обрубок."""
    if birefnet_available():
        return cutout_birefnet(image)
    try:
        import rembg  # noqa: F401

        return cutout_rembg(image)
    except ImportError:
        return cutout_floodfill(image)


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


def write_preview(items: list[tuple[str, Image.Image, Image.Image | None]], target: pathlib.Path, cell: int = 220) -> None:
    """Контактный лист: оригинал и вырезка на цветном фоне (на светлом «пропавший» фон был бы не виден)."""
    columns = 4
    rows = (len(items) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell * 2, rows * cell), (40, 44, 52))
    for i, (_, original, cut) in enumerate(items):
        x, y = (i % columns) * cell * 2, (i // columns) * cell
        for offset, picture in ((0, original), (cell, cut)):
            tile = Image.new("RGB", (cell, cell), (66, 135, 200) if offset else (255, 255, 255))
            if picture is not None:
                shown = picture.copy()
                shown.thumbnail((cell - 8, cell - 8))
                tile.paste(shown.convert("RGBA"), ((cell - shown.width) // 2, (cell - shown.height) // 2), shown.convert("RGBA"))
            sheet.paste(tile, (x + offset, y))
    sheet.save(target, "JPEG", quality=88)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="dataset")
    parser.add_argument("--mode", default="auto", choices=["auto", "floodfill", "grabcut", "rembg", "birefnet"])
    parser.add_argument("--only", help="Только эта папка")
    parser.add_argument("--force", action="store_true", help="Переделать, даже если cutout.png уже есть")
    parser.add_argument("--preview", action="store_true", help="Сохранить cutout-preview.jpg: оригиналы и вырезки рядом")
    parser.add_argument("--preview-count", type=int, default=24, help="Сколько пар показать в превью")
    args = parser.parse_args()

    mode = args.mode
    if mode == "auto":
        if birefnet_available():
            mode = "birefnet"
        else:
            try:
                import rembg  # noqa: F401

                mode = "rembg"
            except ImportError:
                mode = "floodfill"
                print("Нейросеть не установлена: вырезаем только на однородном фоне. Для настоящей вырезки:")
                print("  pip install -r requirements-cutout.txt")
    make = {
        "rembg": cutout_rembg,
        "floodfill": cutout_floodfill,
        "grabcut": cutout_grabcut,
        "birefnet": cutout_birefnet,
    }.get(mode, cutout_auto)
    print(f"Режим: {mode}")

    data_dir = pathlib.Path(args.data)
    done = existing = 0
    failed: list[tuple[str, str]] = []
    no_photo: list[str] = []
    preview: list[tuple[str, Image.Image, Image.Image | None]] = []
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
        if args.preview and len(preview) < args.preview_count:
            preview.append((slug, source[1], result))
        if result is None:
            failed.append((slug, note))
            if args.force and target.exists():
                target.unlink()  # старая вырезка плохая или устарела: без неё приложение покажет целое фото
            continue
        result.save(target, "PNG")
        done += 1
        print(f"  {slug}: готово ({source[0].name})")

    print(f"\nСделано вырезок: {done}, уже были: {existing}, без фото: {len(no_photo)}, не удалось: {len(failed)}.")
    for slug, note in failed[:30]:
        print(f"  не удалось: {slug} — {note}")
    if len(failed) > 30:
        print(f"  … и ещё {len(failed) - 30}")
    if args.preview and preview:
        target_preview = pathlib.Path("cutout-preview.jpg")
        write_preview(preview, target_preview)
        print(f"Превью: {target_preview.resolve()}")
    print("Дальше: в папке server выполните npm run sync-photos:local")


if __name__ == "__main__":
    main()
