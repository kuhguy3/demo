"""Data models for the European Football Intelligence prediction engine."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TeamProfile:
    """Everything the scoring framework needs about one side."""

    name: str
    league: str
    elo: float
    market_value_m: float  # squad market value, EUR millions
    manager_rating: float  # 0-100 subjective manager performance index
    injuries: list[str] = field(default_factory=list)
    suspensions: list[str] = field(default_factory=list)
    matches_last_14_days: int = 2  # fixture congestion proxy
    travel_km_since_last_match: float = 0.0  # travel fatigue proxy

    # Last 5 matches, oldest to newest: "W" / "D" / "L"
    last5: list[str] = field(default_factory=list)
    goals_scored_last5: int = 0
    goals_conceded_last5: int = 0
    clean_sheets_last5: int = 0

    # Advanced metrics (per-match averages over the same sample as last5)
    xg_per_match: float = 1.3
    xga_per_match: float = 1.3
    ppda: float = 10.0  # passes allowed per defensive action; lower = higher press
    shot_conversion_pct: float = 10.0
    big_chances_created_last5: int = 0
    big_chances_conceded_last5: int = 0

    def form_points(self) -> int:
        return sum({"W": 3, "D": 1, "L": 0}[r] for r in self.last5)


@dataclass
class OddsSnapshot:
    """Decimal odds, opening and current, home/draw/away 1X2 market."""

    home_open: float
    draw_open: float
    away_open: float
    home_current: float
    draw_current: float
    away_current: float

    @staticmethod
    def _implied(odds_home: float, odds_draw: float, odds_away: float) -> tuple[float, float, float]:
        raw = (1 / odds_home, 1 / odds_draw, 1 / odds_away)
        overround = sum(raw)
        return tuple(r / overround for r in raw)  # type: ignore[return-value]

    def implied_probabilities_current(self) -> tuple[float, float, float]:
        return self._implied(self.home_current, self.draw_current, self.away_current)

    def implied_probabilities_open(self) -> tuple[float, float, float]:
        return self._implied(self.home_open, self.draw_open, self.away_open)


@dataclass
class H2HRecord:
    """Last 5 head-to-head meetings, from the current home team's perspective."""

    results: list[str] = field(default_factory=list)  # "W"/"D"/"L" for the home side, most recent last
    home_wins_at_home: int = 0
    home_losses_at_home: int = 0
    avg_total_goals: float = 2.5
    btts_pct: float = 50.0
    over25_pct: float = 50.0


@dataclass
class Fixture:
    fixture_id: str
    competition: str
    kickoff_utc: str
    home: TeamProfile
    away: TeamProfile
    odds: OddsSnapshot
    h2h: H2HRecord
