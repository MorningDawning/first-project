"""Проверка всего конвейера на искусственных «этикетках» и встроенном упрощённом эмбеддере (без нейросети)."""

import json
import pathlib
import random
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

ML_DIR = pathlib.Path(__file__).resolve().parents[1]

# Пять «марок»: у каждой свой цвет фона и рисунок
DESIGNS = {
    "red-lager": ((200, 40, 40), "stripes"),
    "blue-ipa": ((40, 70, 200), "box"),
    "green-sour": ((40, 160, 70), "dots"),
    "gold-weizen": ((230, 180, 40), "cross"),
    "black-stout": ((25, 25, 30), "box"),
}


def draw_label(design: str, rng: random.Random, size=(160, 200)) -> Image.Image:
    color, pattern = DESIGNS[design]
    jitter = lambda c: max(0, min(255, c + rng.randint(-14, 14)))
    image = Image.new("RGB", size, tuple(jitter(c) for c in color))
    d = ImageDraw.Draw(image)
    w, h = size
    ox, oy = rng.randint(-6, 6), rng.randint(-6, 6)
    if pattern == "stripes":
        for i in range(5):
            d.rectangle([10 + ox, 20 + i * 34 + oy, w - 10 + ox, 34 + i * 34 + oy], fill=(255, 255, 255))
    elif pattern == "box":
        d.rectangle([30 + ox, 50 + oy, w - 30 + ox, h - 50 + oy], fill=(240, 240, 240))
    elif pattern == "dots":
        for i in range(3):
            for j in range(4):
                d.ellipse([20 + i * 45 + ox, 20 + j * 45 + oy, 45 + i * 45 + ox, 45 + j * 45 + oy], fill=(255, 255, 255))
    else:
        d.rectangle([w // 2 - 8 + ox, 10 + oy, w // 2 + 8 + ox, h - 10 + oy], fill=(20, 20, 20))
        d.rectangle([10 + ox, h // 2 - 8 + oy, w - 10 + ox, h // 2 + 8 + oy], fill=(20, 20, 20))
    return image


@pytest.fixture()
def dataset(tmp_path):
    rng = random.Random(1)
    root = tmp_path / "dataset"
    labels = {}
    for slug in DESIGNS:
        (root / slug).mkdir(parents=True)
        labels[slug] = {"beer": slug.replace("-", " ").title(), "brewery": "Test Brewery"}
        for i in range(4):
            draw_label(slug, rng).save(root / slug / f"{i:03d}.jpg")
    (root / "labels.json").write_text(json.dumps(labels), encoding="utf-8")
    return root


def build(dataset, out):
    subprocess.run(
        [sys.executable, "build_gallery.py", "--data", str(dataset), "--out", str(out), "--embedder", "stub", "--augment-count", "3"],
        cwd=ML_DIR, check=True, capture_output=True, text=True,
    )


def test_gallery_recognizes_known_and_rejects_unknown(dataset, tmp_path):
    from common import StubEmbedder
    from retrieval import Gallery

    out = tmp_path / "gallery"
    build(dataset, out)
    gallery = Gallery.load(out)
    assert len(gallery.beers) == 5
    embedder = StubEmbedder()
    rng = random.Random(99)

    for slug in DESIGNS:  # новое фото знакомой марки
        query = embedder.embed([draw_label(slug, rng)])[0]
        recognized, found = gallery.recognize(query)
        assert recognized, f"{slug}: не узнали (лучший {found[:1]})"
        assert found[0][0]["key"] == slug

    # незнакомая этикетка: рисунок, которого в галерее нет
    stranger = Image.new("RGB", (160, 200), (150, 40, 150))
    d = ImageDraw.Draw(stranger)
    d.polygon([(10, 190), (80, 10), (150, 190)], fill=(255, 255, 0))
    recognized, _ = gallery.recognize(embedder.embed([stranger])[0])
    assert not recognized


def test_serve_api(dataset, tmp_path, monkeypatch):
    out = tmp_path / "gallery"
    build(dataset, out)
    monkeypatch.setenv("BEERVIA_ML_GALLERY", str(out))
    monkeypatch.setenv("BEERVIA_EMBEDDER", "stub")
    import importlib
    import serve

    importlib.reload(serve)
    with TestClient(serve.app) as client:
        assert client.get("/health").json()["modelLoaded"] is True
        buffer = io.BytesIO()
        draw_label("blue-ipa", random.Random(7)).save(buffer, "JPEG")
        response = client.post("/recognize", files={"photo": ("scan.jpg", buffer.getvalue(), "image/jpeg")}).json()
        assert response["recognized"] is True
        assert response["candidates"][0]["beerName"] == "Blue Ipa"
        assert response["candidates"][0]["breweryName"] == "Test Brewery"
        bad = client.post("/recognize", files={"photo": ("scan.jpg", b"not an image", "image/jpeg")}).json()
        assert bad == {"recognized": False, "candidates": []}


def test_serve_without_gallery(tmp_path, monkeypatch):
    monkeypatch.setenv("BEERVIA_ML_GALLERY", str(tmp_path / "missing"))
    import importlib
    import serve

    importlib.reload(serve)
    with TestClient(serve.app) as client:
        assert client.get("/health").json()["modelLoaded"] is False
        r = client.post("/recognize", files={"photo": ("a.jpg", b"x", "image/jpeg")}).json()
        assert r["recognized"] is False


def test_evaluate_runs(dataset):
    result = subprocess.run(
        [sys.executable, "evaluate.py", "--data", str(dataset), "--embedder", "stub", "--augment-count", "3"],
        cwd=ML_DIR, check=True, capture_output=True, text=True,
    )
    assert "знакомое пиво" in result.stdout and "Только по названию" in result.stdout
    top1 = [line for line in result.stdout.splitlines() if line.startswith("Верное пиво первым")][0]
    assert int(top1.split(":")[1].strip().rstrip("%")) >= 80


class OffHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.startswith("/cgi/search.pl"):
            base = f"http://127.0.0.1:{self.server.server_port}"
            products = [
                {"code": "111", "product_name": "Blue IPA", "brands": "Test Brewery", "image_front_url": f"{base}/img/111.jpg"},
                {"code": "222", "product_name": "Blue IPA Sixpack", "brands": "Other Brewery", "image_front_url": f"{base}/img/222.jpg"},
                {"code": "333", "product_name": "Red Lager", "brands": "Test Brewery", "image_front_url": f"{base}/img/333.jpg"},
            ]
            body = json.dumps({"products": products}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
        else:
            buffer = io.BytesIO()
            draw_label("blue-ipa", random.Random(3)).save(buffer, "JPEG")
            self.send_response(200); self.send_header("Content-Type", "image/jpeg"); self.end_headers(); self.wfile.write(buffer.getvalue())


def test_fetch_off_photos(tmp_path):
    root = tmp_path / "dataset"
    root.mkdir()
    (root / "labels.json").write_text(json.dumps({"blue-ipa": {"beer": "Blue IPA", "brewery": "Test Brewery"}}), encoding="utf-8")
    server = HTTPServer(("127.0.0.1", 0), OffHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        subprocess.run(
            [sys.executable, "fetch_off_photos.py", "--data", str(root), "--base-url", f"http://127.0.0.1:{server.server_port}", "--delay", "0"],
            cwd=ML_DIR, check=True, capture_output=True, text=True,
        )
    finally:
        server.shutdown()
    files = sorted(p.name for p in (root / "blue-ipa").iterdir())
    assert files == ["SOURCES.txt", "off-111.jpg"], files  # чужая пивоварня и другое пиво не подошли
    assert "openfoodfacts.org/product/111" in (root / "blue-ipa" / "SOURCES.txt").read_text(encoding="utf-8")


def test_beer_without_photos_is_listed_and_has_name_vector(dataset, tmp_path):
    """Пиво без единого фото попадает в галерею и получает вектор названия (смысл сходства проверяет только настоящий CLIP)."""
    from retrieval import Gallery

    labels = json.loads((dataset / "labels.json").read_text(encoding="utf-8"))
    labels["no-photo-beer"] = {"beer": "Zeta Amber", "brewery": "Ghost Brewery"}
    (dataset / "no-photo-beer").mkdir()
    (dataset / "labels.json").write_text(json.dumps(labels), encoding="utf-8")

    out = tmp_path / "gallery"
    build(dataset, out)
    gallery = Gallery.load(out)
    ghost = [i for i, b in enumerate(gallery.beers) if b["photos"] == 0]
    assert len(ghost) == 1 and gallery.beers[ghost[0]]["key"] == "no-photo-beer"
    assert (gallery.text_beer_index == ghost[0]).sum() == 1
    assert (gallery.text_beer_index == -1).sum() > 0  # «посторонние» подписи


def test_name_matching_logic_with_synthetic_vectors():
    """Правила «узнали по названию»: явный лидер узнаётся; близко к постороннему, слабое сходство или ничья — нет."""
    from retrieval import Gallery

    rng = np.random.default_rng(0)
    dim = 64
    unit = lambda v: v / np.linalg.norm(v)
    beers = [{"key": f"b{i}", "beer": f"Beer {i}", "brewery": "X", "photos": 0} for i in range(4)]
    names = np.stack([unit(rng.normal(size=dim)) for _ in range(4)])
    generic = np.stack([unit(rng.normal(size=dim)) for _ in range(3)])
    text = np.concatenate([names, generic]).astype(np.float32)
    index = np.array([0, 1, 2, 3, -1, -1, -1], dtype=np.int32)
    meta = {"text_logit_scale": 100.0, "text_min_sim": 0.22}
    gallery = Gallery(np.zeros((0, dim), dtype=np.float32), np.zeros(0, dtype=np.int32), beers, meta, text, index)

    near = lambda v: unit(v + 0.15 * rng.normal(size=dim) / np.sqrt(dim))

    ok, found = gallery.recognize(near(names[2]))
    assert ok and found[0][0]["key"] == "b2"

    ok, _ = gallery.recognize(near(generic[1]))  # похоже на «посторонний» снимок
    assert not ok

    ok, _ = gallery.recognize(unit(rng.normal(size=dim)))  # ни на что не похоже
    assert not ok

    tie = unit(names[0] + names[1])  # два пива одинаково подходят
    ok, found = gallery.recognize(tie)
    assert not ok and {f[0]["key"] for f in found} >= {"b0", "b1"}
