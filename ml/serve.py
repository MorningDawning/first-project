"""
Сервис распознавания этикеток BeerVia — принимает фото, возвращает кандидатов.

Пока обученного чекпоинта нет (BEERVIA_ML_CHECKPOINT не указывает на реальный
файл), сервис честно отвечает recognized=false — бэкенд в этом случае уходит
в резервный сценарий (см. server/src/routes/scan.ts), само приложение при
этом продолжает работать.

Запуск:
    pip install -r requirements.txt
    uvicorn serve:app --host 0.0.0.0 --port 8001
"""

import io
import os

import joblib
import open_clip
import torch
from fastapi import FastAPI, File, UploadFile
from PIL import Image
from pydantic import BaseModel

CHECKPOINT_PATH = os.environ.get("BEERVIA_ML_CHECKPOINT", "checkpoint.joblib")
CONFIDENCE_THRESHOLD = float(os.environ.get("BEERVIA_ML_CONFIDENCE_THRESHOLD", "0.55"))
TOP_K = 3

app = FastAPI(title="BeerVia label recognition")

_state: dict = {"classifier": None, "model": None, "preprocess": None, "device": "cpu"}


class Candidate(BaseModel):
    beerName: str
    confidence: float


class RecognizeResponse(BaseModel):
    recognized: bool
    candidates: list[Candidate]


@app.on_event("startup")
def load_checkpoint() -> None:
    if not os.path.exists(CHECKPOINT_PATH):
        print(
            f"[serve] Чекпоинт не найден ({CHECKPOINT_PATH}) — сервис будет отвечать "
            "'не распознано'. Обучите модель: python train_clip.py"
        )
        return

    bundle = joblib.load(CHECKPOINT_PATH)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms(
        bundle["clip_model"], pretrained=bundle["clip_pretrained"]
    )
    _state.update(
        classifier=bundle["classifier"],
        model=model.to(device).eval(),
        preprocess=preprocess,
        device=device,
    )
    print(f"[serve] Модель загружена ({device}), классов: {len(_state['classifier'].classes_)}")


@app.get("/health")
def health():
    return {"ok": True, "modelLoaded": _state["classifier"] is not None}


@app.post("/recognize", response_model=RecognizeResponse)
async def recognize(photo: UploadFile = File(...)) -> RecognizeResponse:
    if _state["classifier"] is None:
        return RecognizeResponse(recognized=False, candidates=[])

    image_bytes = await photo.read()
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return RecognizeResponse(recognized=False, candidates=[])

    tensor = _state["preprocess"](image).unsqueeze(0).to(_state["device"])
    with torch.no_grad():
        embedding = _state["model"].encode_image(tensor)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    probabilities = _state["classifier"].predict_proba(embedding.cpu().numpy())[0]
    ranked = sorted(zip(_state["classifier"].classes_, probabilities), key=lambda pair: pair[1], reverse=True)
    candidates = [Candidate(beerName=name, confidence=round(float(p), 3)) for name, p in ranked[:TOP_K]]

    recognized = bool(candidates) and candidates[0].confidence >= CONFIDENCE_THRESHOLD
    return RecognizeResponse(recognized=recognized, candidates=candidates)
