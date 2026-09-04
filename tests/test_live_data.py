from football_intel.config import ProviderConfig
from football_intel.data.sample_fixtures import FIXTURES
from football_intel.live_data import with_live_odds
from football_intel.providers.the_odds_api import RawOdds


class _FakeClient:
    def __init__(self, odds_by_competition):
        self.odds_by_competition = odds_by_competition
        self.calls = []

    def current_odds(self, competition):
        self.calls.append(competition)
        return self.odds_by_competition.get(competition, [])


def test_no_api_key_returns_fixtures_unchanged():
    config = ProviderConfig(odds_api_key=None, football_data_api_key=None)
    result = with_live_odds(FIXTURES, config=config)
    assert result is FIXTURES


def test_matched_fixture_gets_live_current_odds_only():
    fx = FIXTURES[0]
    fake_odds = [RawOdds(home_team=fx.home.name, away_team=fx.away.name, commence_time="", home_price=1.5, draw_price=4.0, away_price=6.0)]
    client = _FakeClient({fx.competition: fake_odds})
    config = ProviderConfig(odds_api_key="fake-key", football_data_api_key=None)

    result = with_live_odds([fx], config=config, client=client)

    updated = result[0]
    assert updated.odds.home_current == 1.5
    assert updated.odds.draw_current == 4.0
    assert updated.odds.away_current == 6.0
    assert updated.odds.home_open == fx.odds.home_open  # opening line untouched
    assert updated.home is fx.home and updated.away is fx.away  # non-market data untouched


def test_unmatched_fixture_falls_back_to_existing_odds():
    fx = FIXTURES[0]
    client = _FakeClient({fx.competition: []})
    config = ProviderConfig(odds_api_key="fake-key", football_data_api_key=None)

    result = with_live_odds([fx], config=config, client=client)

    assert result[0].odds == fx.odds
