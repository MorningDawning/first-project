"""Общие части ML: разметка датасета, аугментации, получение эмбеддингов картинок."""

from __future__ import annotations

import json
import pathlib
import random

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
DEFAULT_MODEL = "ViT-B-32"
DEFAULT_PRETRAINED = "openai"


# ---------- разметка ----------

def load_labels(data_dir: pathlib.Path) -> dict[str, dict[str, str]]:
    """labels.json: папка -> {"beer": название, "brewery": пивоварня}. Старый формат (папка -> название) тоже понимаем."""
    path = data_dir / "labels.json"
    if not path.exists():
        raise SystemExit(f"Не найден {path} — см. dataset/README.md")
    raw = json.loads(path.read_text(encoding="utf-8"))
    labels: dict[str, dict[str, str]] = {}
    for slug, value in raw.items():
        labels[slug] = {"beer": value, "brewery": ""} if isinstance(value, str) else {
            "beer": value["beer"],
            "brewery": value.get("brewery", ""),
        }
    return labels


def list_photos(folder: pathlib.Path) -> list[pathlib.Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS)


def open_image(path: pathlib.Path) -> Image.Image | None:
    try:
        return Image.open(path).convert("RGB")
    except Exception as exc:  # noqa: BLE001 — битый файл не должен ронять весь запуск
        print(f"  [пропуск] {path.name}: {exc}")
        return None


# ---------- аугментации ----------

def augment_image(image: Image.Image, rng: random.Random) -> Image.Image:
    """Один случайный вариант фото, похожий на снимок с телефона (свет, ракурс, расфокус)."""
    width, height = image.size

    zoom = rng.uniform(0.82, 1.0)  # разное расстояние и кадрирование
    crop_w, crop_h = max(1, int(width * zoom)), max(1, int(height * zoom))
    left = rng.randint(0, width - crop_w)
    top = rng.randint(0, height - crop_h)
    image = image.crop((left, top, left + crop_w, top + crop_h)).resize((width, height))

    image = image.rotate(rng.uniform(-12, 12), resample=Image.BICUBIC, expand=False, fillcolor=(128, 128, 128))

    image = ImageEnhance.Brightness(image).enhance(rng.uniform(0.75, 1.25))  # окно, лампа, вспышка
    image = ImageEnhance.Contrast(image).enhance(rng.uniform(0.8, 1.2))
    image = ImageEnhance.Color(image).enhance(rng.uniform(0.8, 1.2))

    if rng.random() < 0.4:  # расфокус или дрожание руки
        image = image.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.5, 1.8)))
    return image


# ---------- эмбеддинги ----------

class Embedder:
    """Превращает картинки в нормированные векторы: похожие картинки — близкие векторы."""

    name = "base"

    def embed(self, images: list[Image.Image]) -> np.ndarray:  # (n, d), длина каждой строки = 1
        raise NotImplementedError


class ClipEmbedder(Embedder):
    def __init__(self, model: str = DEFAULT_MODEL, pretrained: str = DEFAULT_PRETRAINED):
        import open_clip  # тяжёлые библиотеки грузим только когда они реально нужны
        import torch

        self._torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.name = f"clip:{model}/{pretrained}"
        print(f"Загружаем CLIP ({model}/{pretrained}) на {self.device}... первый раз скачиваются веса, это несколько минут.")
        net, _, self._preprocess = open_clip.create_model_and_transforms(model, pretrained=pretrained)
        self._model = net.to(self.device).eval()

    def embed(self, images: list[Image.Image]) -> np.ndarray:
        torch = self._torch
        out = []
        for start in range(0, len(images), 32):
            batch = torch.stack([self._preprocess(im) for im in images[start : start + 32]]).to(self.device)
            with torch.no_grad():
                vectors = self._model.encode_image(batch)
                vectors = vectors / vectors.norm(dim=-1, keepdim=True)
            out.append(vectors.cpu().numpy())
        return np.concatenate(out).astype(np.float32) if out else np.zeros((0, 1), dtype=np.float32)


class StubEmbedder(Embedder):
    """Простой встроенный «эмбеддер» без нейросети (цвета и грубая картинка). Только для тестов пайплайна."""

    name = "stub"

    def embed(self, images: list[Image.Image]) -> np.ndarray:
        vectors = []
        for image in images:
            small = np.asarray(image.resize((12, 12)), dtype=np.float32).reshape(-1) / 255.0
            vector = small - small.mean()
            vectors.append(vector / (np.linalg.norm(vector) + 1e-9))
        return np.stack(vectors).astype(np.float32)


def make_embedder(kind: str = "clip", model: str = DEFAULT_MODEL, pretrained: str = DEFAULT_PRETRAINED) -> Embedder:
    if kind == "stub":
        return StubEmbedder()
    return ClipEmbedder(model, pretrained)
