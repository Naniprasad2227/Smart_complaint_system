import re
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR.parent / "dataset" / "complaints.csv"
MODEL_PATH = BASE_DIR / "complaint_model.pkl"


def clean_text(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def clean_text_series(text_series):
    return text_series.apply(clean_text)


def train_and_save_model() -> None:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)
    df = df.dropna(subset=["text", "category", "priority", "department"])

    required_columns = {"text", "category", "priority", "department"}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing columns: {sorted(missing)}")

    # If sentiment is absent, keep a neutral default in the saved metadata.
    if "sentiment" not in df.columns:
        df["sentiment"] = "Neutral"

    category_model = Pipeline(
        [
            ("clean", FunctionTransformer(clean_text_series, validate=False)),
            ("tfidf", TfidfVectorizer(stop_words="english", ngram_range=(1, 2))),
            ("clf", LogisticRegression(max_iter=2000)),
        ]
    )

    category_model.fit(df["text"], df["category"])

    # Priority/department/sentiment are mapped by dominant values per category.
    category_meta = (
        df.groupby("category")[["priority", "department", "sentiment"]]
        .agg(lambda s: s.value_counts().index[0])
        .to_dict(orient="index")
    )

    model_bundle = {
        "version": "1.0.0",
        "category_model": category_model,
        "category_meta": category_meta,
    }

    joblib.dump(model_bundle, MODEL_PATH)
    print(f"Model saved to: {MODEL_PATH}")


if __name__ == "__main__":
    train_and_save_model()
