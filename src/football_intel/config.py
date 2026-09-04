"""API credential configuration, read from the environment.

None of these are required — football_intel runs fine on sample data
with no keys set at all. Set whichever you have to enable live data for
that piece of the pipeline. See providers/README.md for how to obtain
each key; football_intel never fetches or stores credentials on your
behalf, it only reads them from your own environment/.env file.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str) -> str | None:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else None


@dataclass(frozen=True)
class ProviderConfig:
    # Odds: https://the-odds-api.com (free tier: 500 requests/month, 1X2 + totals
    # for soccer, decimal odds, includes an /odds-history endpoint for opening lines).
    odds_api_key: str | None = field(default_factory=lambda: _env("ODDS_API_KEY"))

    # Fixtures/results/standings: https://www.football-data.org (free tier covers
    # all 8 competitions in this module — PL, PD, BL1, SA, FL1, CL, plus EL/ECL on
    # paid tiers). Used to derive form, goals, clean sheets, and H2H history.
    football_data_api_key: str | None = field(default_factory=lambda: _env("FOOTBALL_DATA_API_KEY"))

    # xG/xGA/PPDA/shot conversion/big chances: no free official API exists for
    # these across all 8 competitions. Paid options: Opta/StatsPerform, Wyscout,
    # SkillCorner. Point this at whichever you subscribe to; xg_provider.py
    # documents the adapter interface to implement for your vendor.
    xg_provider_api_key: str | None = field(default_factory=lambda: _env("XG_PROVIDER_API_KEY"))
    xg_provider_base_url: str | None = field(default_factory=lambda: _env("XG_PROVIDER_BASE_URL"))

    @property
    def live_data_available(self) -> bool:
        return bool(self.odds_api_key or self.football_data_api_key)


def load_config() -> ProviderConfig:
    """Re-read provider configuration from the current environment."""
    return ProviderConfig()


CONFIG = load_config()
