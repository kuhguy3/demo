"""The structured scoring framework: four independent sub-models, each
producing a home/draw/away probability triple plus a 0-100 confidence
weight. The prediction engine (engine.py) blends them — no randomness
anywhere in this module.
"""

from __future__ import annotations

import math

from football_intel.models import Fixture

HOME_ADVANTAGE_ELO = 60.0


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _normalize3(a: float, b: float, c: float) -> tuple[float, float, float]:
    total = a + b + c
    if total <= 0:
        return (1 / 3, 1 / 3, 1 / 3)
    return (a / total, b / total, c / total)


def _injury_suspension_penalty(team) -> float:
    """Elo-equivalent points lost to unavailable players (crude but structured)."""
    return 8.0 * len(team.injuries) + 6.0 * len(team.suspensions)


def _fatigue_penalty(team) -> float:
    congestion = max(0, team.matches_last_14_days - 4) * 10.0
    travel = min(team.travel_km_since_last_match / 1000.0, 5.0) * 4.0
    return congestion + travel


class TeamStrengthModel:
    """ELO differential + squad value + manager + injuries/suspensions + fatigue."""

    name = "Statistical Model"

    def evaluate(self, fx: Fixture) -> tuple[tuple[float, float, float], float]:
        home, away = fx.home, fx.away

        elo_diff = (home.elo - away.elo) + HOME_ADVANTAGE_ELO
        elo_diff -= _injury_suspension_penalty(home) - _injury_suspension_penalty(away)
        elo_diff -= _fatigue_penalty(home) - _fatigue_penalty(away)

        value_diff = math.log(max(home.market_value_m, 1.0) / max(away.market_value_m, 1.0)) * 40.0
        manager_diff = (home.manager_rating - away.manager_rating) * 0.6

        composite = elo_diff + value_diff + manager_diff

        p_home_or_away = _sigmoid(composite / 200.0)
        p_home = p_home_or_away
        p_away = 1 - p_home_or_away

        draw_weight = 0.24 + 0.08 * (1 - abs(p_home - p_away))
        p_home *= 1 - draw_weight
        p_away *= 1 - draw_weight
        p_draw = draw_weight

        confidence = min(100.0, abs(composite) / 3.0)
        return _normalize3(p_home, p_draw, p_away), confidence


class FormModel:
    """Last-5 results, goals scored/conceded, clean sheets."""

    name = "Form Model"

    def evaluate(self, fx: Fixture) -> tuple[tuple[float, float, float], float]:
        home, away = fx.home, fx.away

        home_score = (
            home.form_points()
            + home.goals_scored_last5 * 0.4
            - home.goals_conceded_last5 * 0.3
            + home.clean_sheets_last5 * 1.2
        )
        away_score = (
            away.form_points()
            + away.goals_scored_last5 * 0.4
            - away.goals_conceded_last5 * 0.3
            + away.clean_sheets_last5 * 1.2
        )

        diff = home_score - away_score
        p_home_or_away = _sigmoid(diff / 8.0)
        p_home = p_home_or_away * 0.78
        p_away = (1 - p_home_or_away) * 0.78
        p_draw = 1 - p_home - p_away

        confidence = min(100.0, abs(diff) * 6.0)
        return _normalize3(p_home, p_draw, p_away), confidence


class MarketModel:
    """Bookmaker-implied probabilities, plus sharp-money / steam detection."""

    name = "Market Model"

    def evaluate(self, fx: Fixture) -> tuple[tuple[float, float, float], float]:
        p_home, p_draw, p_away = fx.odds.implied_probabilities_current()
        p_home_open, p_draw_open, p_away_open = fx.odds.implied_probabilities_open()

        movement = (p_home - p_home_open, p_draw - p_draw_open, p_away - p_away_open)
        biggest_move = max(movement, key=abs)
        # Confidence rises when the market has moved decisively (sharp action)
        # rather than sitting flat since open.
        confidence = min(100.0, abs(biggest_move) * 600.0 + 40.0)

        return (p_home, p_draw, p_away), confidence

    @staticmethod
    def sharp_signal(fx: Fixture) -> str | None:
        """Return a short note when current odds have moved >=3pp implied
        probability away from the opening line on one selection."""
        p_home, p_draw, p_away = fx.odds.implied_probabilities_current()
        p_home_o, p_draw_o, p_away_o = fx.odds.implied_probabilities_open()
        moves = {"Home": p_home - p_home_o, "Draw": p_draw - p_draw_o, "Away": p_away - p_away_o}
        selection, move = max(moves.items(), key=lambda kv: abs(kv[1]))
        if abs(move) >= 0.03:
            direction = "shortening" if move > 0 else "drifting"
            return f"{selection} odds {direction} ({move * 100:+.1f}pp implied since open) — sharp money indicator"
        return None


class XGModel:
    """Expected goals, PPDA press intensity, shot conversion, big chances."""

    name = "xG Model"

    def expected_goals(self, fx: Fixture) -> tuple[float, float]:
        home, away = fx.home, fx.away

        # Attack strength adjusted by opponent defensive vulnerability (xGA)
        home_attack = home.xg_per_match * (away.xga_per_match / 1.3)
        away_attack = away.xg_per_match * (home.xga_per_match / 1.3)

        # Press intensity: lower PPDA (harder press) suppresses opponent xG
        home_attack *= _press_factor(away.ppda)
        away_attack *= _press_factor(home.ppda)

        # Shot conversion and big-chance creation nudge finishing efficiency
        home_attack *= 1 + (home.shot_conversion_pct - 10.0) / 100.0
        away_attack *= 1 + (away.shot_conversion_pct - 10.0) / 100.0
        home_attack *= 1 + 0.02 * (home.big_chances_created_last5 - home.big_chances_conceded_last5) / 5.0
        away_attack *= 1 + 0.02 * (away.big_chances_created_last5 - away.big_chances_conceded_last5) / 5.0

        home_attack *= 1.08  # home advantage in expected goals
        return max(home_attack, 0.15), max(away_attack, 0.15)

    def evaluate(self, fx: Fixture) -> tuple[tuple[float, float, float], float]:
        lam_home, lam_away = self.expected_goals(fx)
        p_home, p_draw, p_away = _scoreline_outcome_probs(lam_home, lam_away)
        confidence = min(100.0, abs(lam_home - lam_away) * 45.0 + 25.0)
        return (p_home, p_draw, p_away), confidence


def _press_factor(ppda: float) -> float:
    """Lower PPDA = more aggressive press = suppresses the opponent's xG."""
    baseline = 10.0
    return max(0.85, min(1.15, 1.0 + (ppda - baseline) / 60.0))


def _poisson_pmf(k: int, lam: float) -> float:
    return math.exp(-lam) * lam**k / math.factorial(k)


def score_grid(lam_home: float, lam_away: float, max_goals: int = 6) -> dict[tuple[int, int], float]:
    grid: dict[tuple[int, int], float] = {}
    for h in range(max_goals + 1):
        for a in range(max_goals + 1):
            grid[(h, a)] = _poisson_pmf(h, lam_home) * _poisson_pmf(a, lam_away)
    return grid


def _scoreline_outcome_probs(lam_home: float, lam_away: float, max_goals: int = 10) -> tuple[float, float, float]:
    grid = score_grid(lam_home, lam_away, max_goals)
    p_home = sum(p for (h, a), p in grid.items() if h > a)
    p_draw = sum(p for (h, a), p in grid.items() if h == a)
    p_away = sum(p for (h, a), p in grid.items() if h < a)
    return _normalize3(p_home, p_draw, p_away)
