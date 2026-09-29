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
    assert "Знакомое пиво" in result.stdout and "Незнакомое пиво" in result.stdout
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
