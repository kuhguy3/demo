"""Weekend Top European Picks: ranks predictions, keeping only confidence >= 7/10."""

from __future__ import annotations

from football_intel.engine import MatchPrediction

MIN_PICK_CONFIDENCE = 7


def top_picks(predictions: list[MatchPrediction], limit: int = 5) -> list[MatchPrediction]:
    eligible = [p for p in predictions if p.confidence >= MIN_PICK_CONFIDENCE]
    eligible.sort(key=lambda p: (p.confidence, p.consensus.score), reverse=True)
    return eligible[:limit]


def key_reason(prediction: MatchPrediction) -> str:
    return str(prediction.reasoning["why"])
