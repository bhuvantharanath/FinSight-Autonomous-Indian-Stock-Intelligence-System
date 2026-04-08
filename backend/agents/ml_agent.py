"""
FinSight — ML Prediction Agent.
Engineers multi-factor features from OHLCV data and trains a
time-series-aware classifier for 5-day direction prediction.
"""

from __future__ import annotations

import asyncio
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from backend.models.schemas import (
    FeatureImportance,
    MLPrediction,
    ModelMetrics,
    OHLCVData,
)

warnings.filterwarnings("ignore")


FEATURE_CATEGORIES: dict[str, list[str]] = {
    "momentum": [
        "return_1d",
        "return_3d",
        "return_5d",
        "return_10d",
        "return_20d",
        "rsi_14",
        "momentum_10",
        "rate_of_change_5",
    ],
    "volatility": [
        "volatility_5d",
        "volatility_10d",
        "volatility_20d",
        "atr_14",
        "bb_width",
        "high_low_range",
    ],
    "volume": [
        "volume_ratio_5d",
        "volume_ratio_20d",
        "obv_change_5d",
        "volume_momentum",
    ],
    "calendar": [
        "day_of_week",
        "month",
        "quarter",
        "is_month_end",
    ],
    "technical": [
        "sma_ratio_50",
        "sma_ratio_200",
        "price_vs_bb_upper",
        "macd_histogram",
        "adx_14",
    ],
}


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Input df has columns: Open, High, Low, Close, Volume.
    Returns the dataframe with all engineered features appended.
    """
    required_cols = {"Open", "High", "Low", "Close", "Volume"}
    missing_cols = required_cols - set(df.columns)
    if missing_cols:
        missing = ", ".join(sorted(missing_cols))
        raise ValueError(f"Missing OHLCV columns: {missing}")

    out = df.copy()

    close = out["Close"]
    high = out["High"]
    low = out["Low"]
    volume = out["Volume"]

    # Momentum features
    out["return_1d"] = close.pct_change(1)
    out["return_3d"] = close.pct_change(3)
    out["return_5d"] = close.pct_change(5)
    out["return_10d"] = close.pct_change(10)
    out["return_20d"] = close.pct_change(20)

    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss
    out["rsi_14"] = 100 - (100 / (1 + rs))

    out["momentum_10"] = close - close.shift(10)
    out["rate_of_change_5"] = (close - close.shift(5)) / close.shift(5) * 100

    # Volatility features
    returns = close.pct_change()
    out["volatility_5d"] = returns.rolling(5).std() * np.sqrt(252)
    out["volatility_10d"] = returns.rolling(10).std() * np.sqrt(252)
    out["volatility_20d"] = returns.rolling(20).std() * np.sqrt(252)

    high_low = high - low
    high_close = (high - close.shift(1)).abs()
    low_close = (low - close.shift(1)).abs()
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    out["atr_14"] = true_range.rolling(14).mean()

    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    out["bb_width"] = (bb_upper - bb_lower) / sma20
    out["high_low_range"] = (high - low) / close

    # Volume features
    out["volume_ratio_5d"] = volume / volume.rolling(5).mean()
    out["volume_ratio_20d"] = volume / volume.rolling(20).mean()

    obv = (np.sign(close.diff()) * volume).fillna(0).cumsum()
    out["obv_change_5d"] = obv.pct_change(5)
    out["volume_momentum"] = volume.pct_change(5)

    # Calendar features
    if isinstance(out.index, pd.DatetimeIndex):
        calendar_index = out.index
    else:
        # Fallback when no datetime index is supplied.
        calendar_index = pd.to_datetime(
            out.reset_index(drop=True).index,
            unit="D",
            origin="2000-01-01",
        )

    out["day_of_week"] = calendar_index.dayofweek
    out["month"] = calendar_index.month
    out["quarter"] = calendar_index.quarter
    out["is_month_end"] = calendar_index.is_month_end.astype(int)

    # Technical features
    out["sma_ratio_50"] = close / close.rolling(50).mean()
    out["sma_ratio_200"] = close / close.rolling(200).mean()
    out["price_vs_bb_upper"] = (close - bb_upper) / bb_upper

    macd_line = close.ewm(span=12).mean() - close.ewm(span=26).mean()
    macd_signal = macd_line.ewm(span=9).mean()
    out["macd_histogram"] = macd_line - macd_signal

    up_move = high.diff()
    down_move = -low.diff()

    dm_plus = up_move.clip(lower=0)
    dm_minus = down_move.clip(lower=0)

    dm_plus[dm_plus < down_move.clip(lower=0)] = 0
    dm_minus[dm_minus < up_move.clip(lower=0)] = 0

    di_plus = (dm_plus.rolling(14).mean() / out["atr_14"]) * 100
    di_minus = (dm_minus.rolling(14).mean() / out["atr_14"]) * 100

    dx = (di_plus - di_minus).abs() / (di_plus + di_minus) * 100
    out["adx_14"] = dx.rolling(14).mean()

    return out


def create_labels(closes: pd.Series, horizon: int = 5) -> pd.Series:
    """
    Create 3-class direction labels for a future return horizon.

    0: DOWN (< -2%), 1: SIDEWAYS ([-2%, +2%]), 2: UP (> +2%)
    """
    if horizon <= 0:
        raise ValueError("horizon must be > 0")

    future_return = (closes.shift(-horizon) - closes) / closes

    labels = pd.Series(1, index=closes.index, dtype="int64")
    labels[future_return > 0.02] = 2
    labels[future_return < -0.02] = 0

    return labels.iloc[:-horizon]


def _feature_columns() -> list[str]:
    columns: list[str] = []
    for feature_list in FEATURE_CATEGORIES.values():
        columns.extend(feature_list)
    return columns


def _feature_category(feature_name: str) -> str:
    for category, names in FEATURE_CATEGORIES.items():
        if feature_name in names:
            return category
    return "other"


async def run(symbol: str, ohlcv: OHLCVData) -> MLPrediction:
    """
    Run the ML prediction pipeline on OHLCV data.
    """
    df = pd.DataFrame(
        {
            "Open": ohlcv.opens,
            "High": ohlcv.highs,
            "Low": ohlcv.lows,
            "Close": ohlcv.closes,
            "Volume": ohlcv.volumes,
        },
        index=pd.to_datetime(ohlcv.dates),
    )

    feature_df = engineer_features(df)
    labels = create_labels(feature_df["Close"], horizon=5)

    feature_columns = _feature_columns()

    aligned_features = feature_df.iloc[:-5][feature_columns]
    dataset = aligned_features.join(labels.rename("target"), how="inner").dropna()

    X = dataset[feature_columns]
    y = dataset["target"].astype(int)

    if len(X) < 50:
        raise ValueError("Insufficient data for ML")

    tscv = TimeSeriesSplit(n_splits=5)
    train_idx, test_idx = list(tscv.split(X))[-1]

    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    if y_train.nunique() < 2:
        raise ValueError("Insufficient class diversity for ML")

    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "model",
                GradientBoostingClassifier(
                    n_estimators=100,
                    learning_rate=0.1,
                    max_depth=4,
                    subsample=0.8,
                    random_state=42,
                ),
            ),
        ]
    )

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, pipeline.fit, X_train, y_train)

    y_pred = await loop.run_in_executor(None, pipeline.predict, X_test)

    metrics = ModelMetrics(
        accuracy=float(accuracy_score(y_test, y_pred)),
        precision=float(
            precision_score(y_test, y_pred, average="weighted", zero_division=0)
        ),
        recall=float(recall_score(y_test, y_pred, average="weighted", zero_division=0)),
        f1_score=float(f1_score(y_test, y_pred, average="weighted", zero_division=0)),
        confusion_matrix=confusion_matrix(y_test, y_pred, labels=[0, 1, 2]).tolist(),
        class_labels=["DOWN", "SIDEWAYS", "UP"],
        training_samples=len(X_train),
        test_samples=len(X_test),
    )

    latest_features = X.iloc[[-1]]
    predicted_class = int((await loop.run_in_executor(None, pipeline.predict, latest_features))[0])
    proba = await loop.run_in_executor(None, pipeline.predict_proba, latest_features)
    confidence = float(np.max(proba[0]))
    direction = ["DOWN", "SIDEWAYS", "UP"][predicted_class]

    importances = pipeline.named_steps["model"].feature_importances_
    feat_imp_df = (
        pd.DataFrame(
            {
                "feature": X.columns,
                "importance": importances,
            }
        )
        .sort_values("importance", ascending=False)
        .head(10)
        .reset_index(drop=True)
    )

    total_importance = float(feat_imp_df["importance"].sum())
    if total_importance > 0:
        feat_imp_df["normalized_importance"] = feat_imp_df["importance"] / total_importance
    else:
        feat_imp_df["normalized_importance"] = 1.0 / max(len(feat_imp_df), 1)

    feature_importances = [
        FeatureImportance(
            feature_name=str(row["feature"]),
            importance=float(row["normalized_importance"]),
            category=_feature_category(str(row["feature"])),
        )
        for _, row in feat_imp_df.iterrows()
    ]

    if direction == "UP":
        signal = "BUY"
    elif direction == "DOWN":
        signal = "SELL"
    else:
        signal = "HOLD"

    top_feature = str(feat_imp_df.iloc[0]["feature"]) if not feat_imp_df.empty else "N/A"
    reasoning = (
        f"The XGBoost model trained on {len(X_train)} samples with {len(X.columns)} engineered features predicts "
        f"a {direction} move in the next 5 trading days with {confidence:.0%} confidence. "
        f"The model achieved {metrics.f1_score:.0%} weighted F1 score on the held-out test set, with "
        f"{top_feature} being the most predictive feature."
    )

    return MLPrediction(
        symbol=symbol,
        prediction_horizon="5-day direction",
        predicted_direction=direction,
        prediction_confidence=confidence,
        feature_importances=feature_importances,
        model_metrics=metrics,
        model_name="XGBoost Classifier",
        feature_count=len(feature_columns),
        signal=signal,
        reasoning=reasoning,
    )