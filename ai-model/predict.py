import io
from pathlib import Path
from typing import Dict
import re

import joblib
import numpy as np
from fastapi import FastAPI, File, UploadFile
from PIL import Image
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "complaint_model.pkl"

DEFAULT_RESPONSE = {
    "category": "General",
    "priority": "Medium",
    "department": "General Operations",
    "sentiment": "Neutral",
}


class ComplaintIn(BaseModel):
    text: str


app = FastAPI(title="Complaint AI Model", version="1.0.0")


def load_bundle() -> Dict:
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH)
    return {}


MODEL_BUNDLE = load_bundle()


def clean_text(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def rule_based_fallback(text: str) -> Dict[str, str]:
    lowered = text.lower()

    if any(word in lowered for word in ["garbage", "waste", "trash", "cleaning"]):
        return {
            "category": "Sanitation",
            "priority": "Medium",
            "department": "Cleaning",
            "sentiment": "Negative",
        }
    if any(word in lowered for word in ["water", "leak", "pipeline", "drainage"]):
        return {
            "category": "Water Supply",
            "priority": "High",
            "department": "Water Department",
            "sentiment": "Negative",
        }
    if any(word in lowered for word in ["road", "pothole", "street", "traffic", "light"]):
        return {
            "category": "Infrastructure",
            "priority": "High",
            "department": "Public Works",
            "sentiment": "Negative",
        }

    return DEFAULT_RESPONSE


@app.get("/health")
def health() -> Dict[str, str]:
    return {"ok": "true", "service": "ai-model"}


@app.post("/predict")
def predict(payload: ComplaintIn) -> Dict[str, str]:
    text = clean_text(payload.text)
    if not text:
        return DEFAULT_RESPONSE

    if not MODEL_BUNDLE:
        return rule_based_fallback(text)

    category_model = MODEL_BUNDLE["category_model"]
    category_meta = MODEL_BUNDLE.get("category_meta", {})

    predicted_category = category_model.predict([text])[0]
    meta = category_meta.get(predicted_category, {})

    return {
      "category": predicted_category,
      "priority": meta.get("priority", "Medium"),
      "department": meta.get("department", "General Operations"),
      "sentiment": meta.get("sentiment", "Neutral"),
    }


@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)) -> Dict:
    """
    Analyze an uploaded image using color & texture features to detect
    common civic complaint categories (pothole, garbage, water leak, etc.).
    """
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        image = image.resize((224, 224))

        arr = np.array(image, dtype=np.float32)

        r_mean = float(arr[:, :, 0].mean())
        g_mean = float(arr[:, :, 1].mean())
        b_mean = float(arr[:, :, 2].mean())
        brightness = (r_mean + g_mean + b_mean) / 3.0

        gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        gray_std = float(gray.std())

        # Feature flags
        is_bluish = b_mean > r_mean + 20 and b_mean > g_mean + 20
        is_dark = brightness < 90
        is_grey = abs(r_mean - g_mean) < 25 and abs(g_mean - b_mean) < 25
        is_rough = gray_std > 50
        is_greenish = g_mean > r_mean + 10 and g_mean > b_mean + 10
        is_brownish = r_mean > g_mean > b_mean and brightness < 130
        is_bright = brightness > 180
        is_yellowish = r_mean > 150 and g_mean > 130 and b_mean < 100

        if is_bluish:
            return {
                "detected_issue": "Water Leak / Flooding",
                "category": "Water Supply",
                "priority": "High",
                "department": "Water Department",
                "confidence": 0.82,
                "suggestion": "Detected water or flooding. Submit as a Water Supply complaint.",
            }
        if is_dark and is_grey and is_rough:
            return {
                "detected_issue": "Road Damage / Pothole",
                "category": "Infrastructure",
                "priority": "High",
                "department": "Public Works",
                "confidence": 0.79,
                "suggestion": "Detected road surface damage. Submit as an Infrastructure complaint.",
            }
        if is_greenish or is_brownish:
            return {
                "detected_issue": "Garbage / Waste Dump",
                "category": "Sanitation",
                "priority": "Medium",
                "department": "Cleaning",
                "confidence": 0.74,
                "suggestion": "Detected waste or garbage. Submit as a Sanitation complaint.",
            }
        if is_bright and is_yellowish:
            return {
                "detected_issue": "Fire / Electrical Hazard",
                "category": "Safety",
                "priority": "High",
                "department": "Emergency Services",
                "confidence": 0.71,
                "suggestion": "Detected possible fire or electrical hazard. Submit immediately!",
            }
        if is_dark and not is_grey:
            return {
                "detected_issue": "Broken Streetlight / Power Outage",
                "category": "Infrastructure",
                "priority": "Medium",
                "department": "Electrical Department",
                "confidence": 0.68,
                "suggestion": "Detected dark area possibly indicating a lighting issue.",
            }
        return {
            "detected_issue": "General Civic Issue",
            "category": "General",
            "priority": "Medium",
            "department": "General Operations",
            "confidence": 0.55,
            "suggestion": "Could not identify a specific issue. Please describe the problem in text.",
        }
    except Exception as exc:
        return {
            "detected_issue": "Analysis Failed",
            "category": "General",
            "priority": "Medium",
            "department": "General Operations",
            "confidence": 0.0,
            "suggestion": f"Image analysis error: {exc}",
        }
