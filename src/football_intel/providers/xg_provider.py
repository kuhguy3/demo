"""Adapter interface for an xG/xGA/PPDA/shot-conversion/big-chances provider.

There is no free, official API covering these advanced metrics across all
8 competitions. Realistic options, in rough order of cost:

- Opta / Stats Perform (opta.com) — the industry standard, licensed B2B,
  full coverage of all 8 competitions. Requires a commercial contract.
- Wyscout (wyscout.com) — similar coverage, also commercial/licensed.
- StatsBomb (statsbomb.com) — strong open-data program for some
  competitions/seasons; commercial API for live current-season data.

Once you have a contract and a key, implement `XGProvider` for that
vendor's response shape and set XG_PROVIDER_API_KEY / XG_PROVIDER_BASE_URL
(football_intel.config) to activate it. Until then, football_intel uses
the bundled sample per-match xG/xGA figures.
"""

from __future__ import annotations

from typing import Protocol


class XGMetrics:
    def __init__(
        self,
        xg_per_match: float,
        xga_per_match: float,
        ppda: float,
        shot_conversion_pct: float,
        big_chances_created_last5: int,
        big_chances_conceded_last5: int,
    ) -> None:
        self.xg_per_match = xg_per_match
        self.xga_per_match = xga_per_match
        self.ppda = ppda
        self.shot_conversion_pct = shot_conversion_pct
        self.big_chances_created_last5 = big_chances_created_last5
        self.big_chances_conceded_last5 = big_chances_conceded_last5


class XGProvider(Protocol):
    """Implement this against your vendor's API to plug xG data into the
    scoring framework (football_intel.scoring.XGModel)."""

    def team_metrics(self, team_name: str, competition: str) -> XGMetrics: ...
