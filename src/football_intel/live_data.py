"""Overlays live provider data onto a list of Fixture objects.

Team strength/form/xG inputs still come from wherever you source them
(the bundled sample data, or your own football-data.org / xG-vendor
wiring); this module's job today is the odds leg, since the-odds-api.com
is the one piece with a real free tier that needs no per-team ID mapping.
"""

from __future__ import annotations

import sys
from dataclasses import replace

from football_intel.config import CONFIG, ProviderConfig
from football_intel.models import Fixture, OddsSnapshot
from football_intel.providers.the_odds_api import OddsAPIError, RawOdds, TheOddsAPIClient


def _name_matches(api_name: str, fixture_name: str) -> bool:
    a, b = api_name.lower(), fixture_name.lower()
    return a == b or a in b or b in a


def _find_match(raw_odds: list[RawOdds], home_name: str, away_name: str) -> RawOdds | None:
    for candidate in raw_odds:
        if _name_matches(candidate.home_team, home_name) and _name_matches(candidate.away_team, away_name):
            return candidate
    return None


def with_live_odds(
    fixtures: list[Fixture],
    config: ProviderConfig | None = None,
    client: TheOddsAPIClient | None = None,
) -> list[Fixture]:
    """Return a copy of `fixtures` with current odds replaced by a live
    consensus line from the-odds-api.com wherever a match is found.
    Opening odds and every non-market input are left untouched. Falls
    back silently (per-fixture) to the existing odds on any API error or
    unmatched fixture, so a report always renders."""
    config = config or CONFIG
    if not config.odds_api_key:
        return fixtures

    client = client or TheOddsAPIClient(config.odds_api_key)
    updated = []
    odds_by_competition: dict[str, list[RawOdds]] = {}

    for fx in fixtures:
        if fx.competition not in odds_by_competition:
            try:
                odds_by_competition[fx.competition] = client.current_odds(fx.competition)
            except OddsAPIError as exc:
                print(f"warning: {exc}", file=sys.stderr)
                odds_by_competition[fx.competition] = []

        match = _find_match(odds_by_competition[fx.competition], fx.home.name, fx.away.name)
        if match is None:
            updated.append(fx)
            continue

        live_odds = OddsSnapshot(
            home_open=fx.odds.home_open,
            draw_open=fx.odds.draw_open,
            away_open=fx.odds.away_open,
            home_current=match.home_price,
            draw_current=match.draw_price,
            away_current=match.away_price,
        )
        updated.append(replace(fx, odds=live_odds))

    return updated
