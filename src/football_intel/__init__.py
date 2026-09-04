"""European Football Intelligence: a structured prediction engine for Europe's
major club competitions (Champions League, Premier League, La Liga, Bundesliga,
Serie A, Ligue 1, Europa League, Conference League).

Every prediction is derived from a deterministic scoring framework (team
strength, form, advanced metrics, market intelligence, head-to-head history)
combined across four sub-models into an AI Consensus Index. Nothing here is
randomly generated.

Predictions are probability estimates based on available data and are not
financial or betting advice.
"""

__version__ = "0.1.0"

DISCLAIMER = (
    "Football predictions are probability estimates based on available data "
    "and should not be considered financial or betting advice."
)

COMPETITIONS = [
    "UEFA Champions League",
    "Premier League",
    "La Liga",
    "Bundesliga",
    "Serie A",
    "Ligue 1",
    "Europa League",
    "Conference League",
]
