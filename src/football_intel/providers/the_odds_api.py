"""Live 1X2 odds via https://the-odds-api.com.

Sign-up: https://the-odds-api.com/#get-access (free tier: 500 requests/month,
covers soccer_epl, soccer_spain_la_liga, soccer_germany_bundesliga,
soccer_italy_serie_a, soccer_france_ligue_one, soccer_uefa_champs_league,
soccer_uefa_europa_league, soccer_uefa_europa_conference_league).
Set the key as the ODDS_API_KEY environment variable — football_intel
never transmits it anywhere but this API's own endpoint.
"""

from __future__ import annotations

from dataclasses import dataclass

import requests

BASE_URL = "https://api.the-odds-api.com/v4"

# football_intel competition name -> the-odds-api sport key
SPORT_KEYS = {
    "UEFA Champions League": "soccer_uefa_champs_league",
    "Premier League": "soccer_epl",
    "La Liga": "soccer_spain_la_liga",
    "Bundesliga": "soccer_germany_bundesliga",
    "Serie A": "soccer_italy_serie_a",
    "Ligue 1": "soccer_france_ligue_one",
    "Europa League": "soccer_uefa_europa_league",
    "Conference League": "soccer_uefa_europa_conference_league",
}


class OddsAPIError(RuntimeError):
    pass


@dataclass
class RawOdds:
    home_team: str
    away_team: str
    commence_time: str
    home_price: float
    draw_price: float
    away_price: float


class TheOddsAPIClient:
    """Thin, dependency-light client. Raises OddsAPIError on any failure —
    callers should catch it and fall back to sample/cached data rather than
    crash a report run over a transient API issue."""

    def __init__(self, api_key: str, session: requests.Session | None = None, timeout: float = 10.0) -> None:
        self.api_key = api_key
        self.session = session or requests.Session()
        self.timeout = timeout

    def current_odds(self, competition: str, region: str = "eu") -> list[RawOdds]:
        sport_key = SPORT_KEYS.get(competition)
        if sport_key is None:
            raise OddsAPIError(f"no the-odds-api sport key mapped for competition {competition!r}")

        try:
            resp = self.session.get(
                f"{BASE_URL}/sports/{sport_key}/odds",
                params={
                    "apiKey": self.api_key,
                    "regions": region,
                    "markets": "h2h",
                    "oddsFormat": "decimal",
                },
                timeout=self.timeout,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise OddsAPIError(f"the-odds-api request failed for {competition}: {exc}") from exc

        events = resp.json()
        results = []
        for event in events:
            prices = _extract_h2h_prices(event)
            if prices is None:
                continue
            home_price, draw_price, away_price = prices
            results.append(
                RawOdds(
                    home_team=event.get("home_team", ""),
                    away_team=event.get("away_team", ""),
                    commence_time=event.get("commence_time", ""),
                    home_price=home_price,
                    draw_price=draw_price,
                    away_price=away_price,
                )
            )
        return results


def _extract_h2h_prices(event: dict) -> tuple[float, float, float] | None:
    """Average the h2h market's decimal odds across all bookmakers in the
    response (a simple consensus line) and return (home, draw, away)."""
    home_team, away_team = event.get("home_team"), event.get("away_team")
    home_prices, draw_prices, away_prices = [], [], []

    for bookmaker in event.get("bookmakers", []):
        for market in bookmaker.get("markets", []):
            if market.get("key") != "h2h":
                continue
            for outcome in market.get("outcomes", []):
                name, price = outcome.get("name"), outcome.get("price")
                if name == home_team:
                    home_prices.append(price)
                elif name == away_team:
                    away_prices.append(price)
                else:
                    draw_prices.append(price)

    if not (home_prices and draw_prices and away_prices):
        return None
    return (
        sum(home_prices) / len(home_prices),
        sum(draw_prices) / len(draw_prices),
        sum(away_prices) / len(away_prices),
    )
