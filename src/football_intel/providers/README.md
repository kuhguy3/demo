# Live data providers

football_intel runs entirely on bundled sample data with zero setup. To
point it at real data, get your own API key from the relevant provider
below (I can't sign up or hold credentials on your behalf — these all
require you to accept the vendor's own terms) and set it as an
environment variable.

| Data | Provider | Env var | Free tier? |
|---|---|---|---|
| 1X2 odds (opening/current, sharp-money detection) | [the-odds-api.com](https://the-odds-api.com/#get-access) | `ODDS_API_KEY` | Yes — 500 requests/month |
| Fixtures, results, form, H2H | [football-data.org](https://www.football-data.org/client/register) | `FOOTBALL_DATA_API_KEY` | Yes — PL/La Liga/Bundesliga/Serie A/Ligue 1/UCL only; EL/ECL need a paid tier |
| xG / xGA / PPDA / shot conversion / big chances | Opta, Wyscout, or StatsBomb (commercial) | `XG_PROVIDER_API_KEY`, `XG_PROVIDER_BASE_URL` | No — all require a paid license |

## Setup

```bash
export ODDS_API_KEY="your-key-here"
football-intel report --live --out football_intelligence.html
```

With no keys set, `--live` prints a warning and falls back to sample data
rather than failing.

## Adding a new provider

- `the_odds_api.py` / `football_data_org.py` are thin `requests`-based
  clients you can extend (e.g. add historical/opening-line endpoints).
- `xg_provider.py` defines the `XGProvider` protocol to implement against
  whichever advanced-metrics vendor you contract with.
- `live_data.py` is the one place that turns provider responses into
  `football_intel.models.Fixture` objects consumed by the prediction
  engine — extend `with_live_odds` (or add a sibling function) as you
  wire in more providers.
