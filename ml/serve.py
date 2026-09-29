"""
Сервис распознавания этикеток BeerVia: принимает фото, возвращает кандидатов.

    uvicorn serve:app --host 0.0.0.0 --port 8001

Пока галереи нет (не запускали build_gallery.py), честно отвечает recognized=false — бэкенд в этом
случае просит пользователя отсканировать штрихкод или добавить пиво (см. server/src/routes/scan.ts).

Переменные окружения:
  BEERVIA_ML_GALLERY   путь к галерее без расширения (по умолчанию gallery)
  BEERVIA_EMBEDDER     clip (по умолчанию) или stub (только для тестов)
  BEERVIA_ML_THRESHOLD своё значение порога вместо подобранного при сборке
"""

import io
import os
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, File, UploadFile
from PIL import Image
from pydantic import BaseModel

from common import DEFAULT_MODEL, DEFAULT_PRETRAINED, make_embedder
from retrieval import Gallery

GALLERY_PATH = os.environ.get("BEERVIA_ML_GALLERY", "gallery")
EMBEDDER_KIND = os.environ.get("BEERVIA_EMBEDDER", "clip")
THRESHOLD_OVERRIDE = os.environ.get("BEERVIA_ML_THRESHOLD")

_state: dict = {"gallery": None, "embedder": None}


class Candidate(BaseModel):
    beerName: str
    breweryName: str
    confidence: float


class RecognizeResponse(BaseModel):
    recognized: bool
    candidates: list[Candidate]


def load_gallery() -> None:
    npz = os.path.exists(f"{GALLERY_PATH}.npz")
    if not (npz and os.path.exists(f"{GALLERY_PATH}.json")):
        print(f"[serve] Галерея не найдена ({GALLERY_PATH}.npz). Соберите её: python build_gallery.py")
        return
    gallery = Gallery.load(GALLERY_PATH)
    kind = "stub" if gallery.meta.get("embedder") == "stub" else EMBEDDER_KIND
    _state["embedder"] = make_embedder(kind, DEFAULT_MODEL, DEFAULT_PRETRAINED)
    _state["gallery"] = gallery
    print(f"[serve] Галерея загружена: пив {len(gallery.beers)}, векторов {len(gallery.embeddings)}, порог {gallery.threshold:.2f}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_gallery()
    yield


app = FastAPI(title="BeerVia label recognition", lifespan=lifespan)


@app.get("/health")
def health():
    gallery = _state["gallery"]
    return {
        "ok": True,
        "modelLoaded": gallery is not None,
        "beers": len(gallery.beers) if gallery else 0,
        "threshold": gallery.threshold if gallery else None,
    }


@app.post("/recognize", response_model=RecognizeResponse)
async def recognize(photo: UploadFile = File(...)) -> RecognizeResponse:
    gallery = _state["gallery"]
    if gallery is None:
        return RecognizeResponse(recognized=False, candidates=[])
    try:
        image = Image.open(io.BytesIO(await photo.read())).convert("RGB")
    except Exception:
        return RecognizeResponse(recognized=False, candidates=[])

    embedding = _state["embedder"].embed([image])[0]
    threshold = float(THRESHOLD_OVERRIDE) if THRESHOLD_OVERRIDE else None
    recognized, found = gallery.recognize(np.asarray(embedding), threshold=threshold)
    candidates = [
        Candidate(beerName=b["beer"], breweryName=b["brewery"], confidence=round(score, 3)) for b, score in found
    ]
    return RecognizeResponse(recognized=recognized, candidates=candidates)
