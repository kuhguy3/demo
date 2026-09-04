"""Prediction engine: blends the four scoring sub-models into a single,
transparent prediction per fixture. No random number generation is used
anywhere in this pipeline — every output traces back to the input data.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from football_intel.models import Fixture
from football_intel.scoring import (
    FormModel,
    MarketModel,
    TeamStrengthModel,
    XGModel,
    score_grid,
)

# Blend weights across the four sub-models for the final 1X2 call.
MODEL_WEIGHTS = {
    "Statistical Model": 0.30,
    "Form Model": 0.20,
    "Market Model": 0.30,
    "xG Model": 0.20,
}

VALUE_EDGE_THRESHOLD = 0.05  # 5%


@dataclass
class GoalsMarkets:
    over_1_5: float
    over_2_5: float
    over_3_5: float
    under_2_5: float
    btts_yes: float
    btts_no: float


@dataclass
class ValueBet:
    selection: str
    model_probability: float
    implied_probability: float
    edge: float
    label: str


@dataclass
class ConsensusIndex:
    score: int  # 0-100
    interpretation: str
    model_scores: dict[str, float] = field(default_factory=dict)
    agreement: bool = False


@dataclass
class MatchPrediction:
    fixture: Fixture
    home_win_pct: float
    draw_pct: float
    away_win_pct: float
    goals: GoalsMarkets
    correct_scores: list[tuple[str, float]]  # [("2-1", 12.3), ...] ranked
    confidence: int  # 1-10
    confidence_band: str
    value_bets: list[ValueBet]
    consensus: ConsensusIndex
    reasoning: dict[str, object]
    sharp_signal: str | None
    model_outcomes: dict[str, tuple[float, float, float]] = field(default_factory=dict)


def _confidence_band(score: int) -> str:
    if score <= 3:
        return "Low"
    if score <= 6:
        return "Moderate"
    if score <= 8:
        return "High"
    return "Elite"


def _value_label(edge: float) -> str:
    if edge < VALUE_EDGE_THRESHOLD:
        return "No Value"
    if edge < 0.10:
        return "Small Edge"
    if edge < 0.15:
        return "Strong Value"
    return "Premium Value"


class PredictionEngine:
    def __init__(self) -> None:
        self.strength_model = TeamStrengthModel()
        self.form_model = FormModel()
        self.market_model = MarketModel()
        self.xg_model = XGModel()

    def predict(self, fx: Fixture) -> MatchPrediction:
        model_results = {
            self.strength_model.name: self.strength_model.evaluate(fx),
            self.form_model.name: self.form_model.evaluate(fx),
            self.market_model.name: self.market_model.evaluate(fx),
            self.xg_model.name: self.xg_model.evaluate(fx),
        }
        model_outcomes = {name: probs for name, (probs, _conf) in model_results.items()}
        model_confidences = {name: conf for name, (_probs, conf) in model_results.items()}

        p_home = sum(model_outcomes[n][0] * MODEL_WEIGHTS[n] for n in MODEL_WEIGHTS)
        p_draw = sum(model_outcomes[n][1] * MODEL_WEIGHTS[n] for n in MODEL_WEIGHTS)
        p_away = sum(model_outcomes[n][2] * MODEL_WEIGHTS[n] for n in MODEL_WEIGHTS)
        p_home, p_draw, p_away = _round_to_100(p_home, p_draw, p_away)

        lam_home, lam_away = self.xg_model.expected_goals(fx)
        goals = _goals_markets(lam_home, lam_away)
        correct_scores = _top_correct_scores(lam_home, lam_away)

        consensus = _consensus_index(model_outcomes, model_confidences)
        confidence = _confidence_rating(model_outcomes, consensus)
        value_bets = _detect_value_bets(fx, p_home, p_draw, p_away)
        sharp_signal = self.market_model.sharp_signal(fx)

        reasoning = _build_reasoning(fx, model_outcomes, consensus, lam_home, lam_away, sharp_signal)

        return MatchPrediction(
            fixture=fx,
            home_win_pct=p_home,
            draw_pct=p_draw,
            away_win_pct=p_away,
            goals=goals,
            correct_scores=correct_scores,
            confidence=confidence,
            confidence_band=_confidence_band(confidence),
            value_bets=value_bets,
            consensus=consensus,
            reasoning=reasoning,
            sharp_signal=sharp_signal,
            model_outcomes=model_outcomes,
        )


def _round_to_100(a: float, b: float, c: float) -> tuple[float, float, float]:
    """Round three percentages to whole numbers that sum to exactly 100."""
    scaled = [a * 100, b * 100, c * 100]
    floored = [int(x) for x in scaled]
    remainder = 100 - sum(floored)
    remainders = sorted(range(3), key=lambda i: scaled[i] - floored[i], reverse=True)
    for i in remainders[:remainder]:
        floored[i] += 1
    return tuple(floored)  # type: ignore[return-value]


def _goals_markets(lam_home: float, lam_away: float) -> GoalsMarkets:
    grid = score_grid(lam_home, lam_away, max_goals=10)
    over = lambda n: sum(p for (h, a), p in grid.items() if h + a > n) * 100  # noqa: E731
    under_2_5 = sum(p for (h, a), p in grid.items() if h + a < 3) * 100
    btts_yes = sum(p for (h, a), p in grid.items() if h > 0 and a > 0) * 100
    return GoalsMarkets(
        over_1_5=round(over(1), 1),
        over_2_5=round(over(2), 1),
        over_3_5=round(over(3), 1),
        under_2_5=round(under_2_5, 1),
        btts_yes=round(btts_yes, 1),
        btts_no=round(100 - btts_yes, 1),
    )


def _top_correct_scores(lam_home: float, lam_away: float, top_n: int = 3) -> list[tuple[str, float]]:
    grid = score_grid(lam_home, lam_away, max_goals=6)
    ranked = sorted(grid.items(), key=lambda kv: kv[1], reverse=True)[:top_n]
    return [(f"{h}-{a}", round(p * 100, 1)) for (h, a), p in ranked]


def _consensus_index(
    model_outcomes: dict[str, tuple[float, float, float]],
    model_confidences: dict[str, float],
) -> ConsensusIndex:
    # Which outcome (0=home,1=draw,2=away) does each model favor?
    picks = {name: max(range(3), key=lambda i: probs[i]) for name, probs in model_outcomes.items()}
    majority_pick = max(set(picks.values()), key=list(picks.values()).count)
    agreeing = [name for name, pick in picks.items() if pick == majority_pick]
    agreement_ratio = len(agreeing) / len(picks)

    # Score = average confidence of agreeing models, scaled by how many agree.
    if agreeing:
        avg_conf = sum(model_confidences[n] for n in agreeing) / len(agreeing)
    else:
        avg_conf = 0.0
    score = int(round(avg_conf * agreement_ratio))
    score = max(0, min(100, score))

    if score < 40:
        interpretation = "Avoid"
    elif score < 60:
        interpretation = "Lean"
    elif score < 80:
        interpretation = "Strong"
    else:
        interpretation = "Elite Opportunity"

    all_agree = agreement_ratio == 1.0
    if interpretation == "Elite Opportunity" and not all_agree:
        # Elite is reserved for broad model agreement, not just high confidence.
        score = min(score, 79)
        interpretation = "Strong"

    return ConsensusIndex(
        score=score,
        interpretation=interpretation,
        model_scores={n: round(model_confidences[n], 1) for n in model_confidences},
        agreement=all_agree,
    )


def _confidence_rating(model_outcomes: dict[str, tuple[float, float, float]], consensus: ConsensusIndex) -> int:
    # Agreement across models (low variance on the favored outcome) plus the
    # consensus index magnitude drive the 1-10 confidence scale.
    picks = [max(range(3), key=lambda i: probs[i]) for probs in model_outcomes.values()]
    majority = max(set(picks), key=picks.count)
    agree_count = picks.count(majority)

    base = {4: 8.0, 3: 6.0, 2: 4.0}.get(agree_count, 2.0)
    consensus_bonus = consensus.score / 100.0 * 2.0
    rating = base + consensus_bonus - 2.0
    rating = max(1.0, min(10.0, rating))

    # Elite (9-10) requires near-unanimous agreement, per spec.
    if agree_count < 4 and rating >= 9:
        rating = 8.0
    return int(round(rating))


def _detect_value_bets(fx: Fixture, p_home: float, p_draw: float, p_away: float) -> list[ValueBet]:
    implied_home, implied_draw, implied_away = fx.odds.implied_probabilities_current()
    candidates = [
        ("Home Win", p_home / 100.0, implied_home),
        ("Draw", p_draw / 100.0, implied_draw),
        ("Away Win", p_away / 100.0, implied_away),
    ]
    value_bets = []
    for selection, model_p, implied_p in candidates:
        edge = model_p - implied_p
        if edge > VALUE_EDGE_THRESHOLD:
            value_bets.append(
                ValueBet(
                    selection=selection,
                    model_probability=round(model_p * 100, 1),
                    implied_probability=round(implied_p * 100, 1),
                    edge=round(edge * 100, 1),
                    label=_value_label(edge),
                )
            )
    value_bets.sort(key=lambda vb: vb.edge, reverse=True)
    return value_bets


def _build_reasoning(
    fx: Fixture,
    model_outcomes: dict[str, tuple[float, float, float]],
    consensus: ConsensusIndex,
    lam_home: float,
    lam_away: float,
    sharp_signal: str | None,
) -> dict[str, object]:
    home, away = fx.home, fx.away
    supporting_stats = [
        f"Elo differential: {home.elo:.0f} vs {away.elo:.0f} (+home advantage)",
        f"Form (last 5): {''.join(home.last5)} ({home.form_points()} pts) vs "
        f"{''.join(away.last5)} ({away.form_points()} pts)",
        f"xG per match: {home.xg_per_match:.2f} vs {away.xg_per_match:.2f}; "
        f"xGA: {home.xga_per_match:.2f} vs {away.xga_per_match:.2f}",
        f"Modeled expected goals this fixture: {lam_home:.2f} - {lam_away:.2f}",
        f"H2H (last 5): {', '.join(fx.h2h.results) or 'no data'}, "
        f"BTTS {fx.h2h.btts_pct:.0f}%, Over 2.5 {fx.h2h.over25_pct:.0f}%",
    ]

    risks = []
    if home.injuries or home.suspensions:
        risks.append(f"{home.name} missing: {', '.join(home.injuries + home.suspensions) or 'none'}")
    if away.injuries or away.suspensions:
        risks.append(f"{away.name} missing: {', '.join(away.injuries + away.suspensions) or 'none'}")
    if home.matches_last_14_days > 4 or away.matches_last_14_days > 4:
        risks.append("Fixture congestion may affect intensity/rotation")
    if sharp_signal:
        risks.append(f"Market movement: {sharp_signal}")
    if not risks:
        risks.append("No significant risk factors identified in available data")

    picks = {name: max(range(3), key=lambda i: probs[i]) for name, probs in model_outcomes.items()}
    outcome_label = {0: "Home Win", 1: "Draw", 2: "Away Win"}
    why = (
        f"{sum(1 for p in picks.values() if p == max(set(picks.values()), key=list(picks.values()).count))}"
        f"/4 models favor {outcome_label[max(set(picks.values()), key=list(picks.values()).count)]}"
        f" (AI Consensus Index {consensus.score}/100 — {consensus.interpretation})"
    )

    return {
        "why": why,
        "supporting_stats": supporting_stats,
        "risks": risks,
        "confidence_rationale": (
            "Confidence reflects how many of the four independent sub-models agree on the "
            "favored outcome and the strength of that agreement (AI Consensus Index)."
        ),
    }
