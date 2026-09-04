"""Fixtures, results, and standings via https://www.football-data.org.

Sign-up: https://www.football-data.org/client/register (free tier covers
PL, PD (La Liga), BL1 (Bundesliga), SA (Serie A), FL1 (Ligue 1), CL
(Champions League) at 10 requests/minute; Europa League/Conference League
require a paid tier). Set the key as the FOOTBALL_DATA_API_KEY
environment variable.

Used to derive: last-5 form (W/D/L, goals scored/conceded, clean sheets)
and head-to-head history — the inputs the scoring framework needs beyond
odds and xG.
"""

from __future__ import annotations

from dataclasses import dataclass

import requests

BASE_URL = "https://api.football-data.org/v4"

# football_intel competition name -> football-data.org competition code
COMPETITION_CODES = {
    "UEFA Champions League": "CL",
    "Premier League": "PL",
    "La Liga": "PD",
    "Bundesliga": "BL1",
    "Serie A": "SA",
    "Ligue 1": "FL1",
    # Europa League / Conference League are not on football-data.org's free
    # tier as of this writing; left unmapped so callers get a clear KeyError
    # rather than a silent wrong answer.
}


class FootballDataAPIError(RuntimeError):
    pass


@dataclass
class RecentMatch:
    date: str
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int


class FootballDataOrgClient:
    def __init__(self, api_key: str, session: requests.Session | None = None, timeout: float = 10.0) -> None:
        self.api_key = api_key
        self.session = session or requests.Session()
        self.timeout = timeout

    def _get(self, path: str, params: dict | None = None) -> dict:
        try:
            resp = self.session.get(
                f"{BASE_URL}{path}",
                headers={"X-Auth-Token": self.api_key},
                params=params or {},
                timeout=self.timeout,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise FootballDataAPIError(f"football-data.org request failed for {path}: {exc}") from exc
        return resp.json()

    def team_recent_matches(self, team_id: int, limit: int = 5) -> list[RecentMatch]:
        data = self._get(f"/teams/{team_id}/matches", params={"status": "FINISHED", "limit": limit})
        matches = []
        for m in data.get("matches", [])[-limit:]:
            score = m.get("score", {}).get("fullTime", {})
            matches.append(
                RecentMatch(
                    date=m.get("utcDate", ""),
                    home_team=m.get("homeTeam", {}).get("name", ""),
                    away_team=m.get("awayTeam", {}).get("name", ""),
                    home_goals=score.get("home") or 0,
                    away_goals=score.get("away") or 0,
                )
            )
        return matches

    def head_to_head(self, match_id: int, limit: int = 5) -> list[RecentMatch]:
        data = self._get(f"/matches/{match_id}/head2head", params={"limit": limit})
        matches = []
        for m in data.get("matches", []):
            score = m.get("score", {}).get("fullTime", {})
            matches.append(
                RecentMatch(
                    date=m.get("utcDate", ""),
                    home_team=m.get("homeTeam", {}).get("name", ""),
                    away_team=m.get("awayTeam", {}).get("name", ""),
                    home_goals=score.get("home") or 0,
                    away_goals=score.get("away") or 0,
                )
            )
        return matches


def result_from_perspective(match: RecentMatch, team_name: str) -> str:
    """W/D/L for `team_name` in this match."""
    if match.home_goals == match.away_goals:
        return "D"
    home_won = match.home_goals > match.away_goals
    team_was_home = match.home_team == team_name
    return "W" if (home_won == team_was_home) else "L"
