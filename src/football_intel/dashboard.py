"""Renders the European Football Intelligence predictions into a single,
self-contained, premium-styled HTML dashboard (mobile-first, dark-mode aware).
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone

from football_intel import DISCLAIMER
from football_intel.engine import MatchPrediction
from football_intel.picks import key_reason, top_picks

LEAGUE_BADGES = {
    "UEFA Champions League": "🏆",
    "Premier League": "🦁",
    "La Liga": "🇪🇸",
    "Bundesliga": "🇩🇪",
    "Serie A": "🇮🇹",
    "Ligue 1": "🇫🇷",
    "Europa League": "🌍",
    "Conference League": "⭐",
}


def _confidence_color(confidence: int) -> str:
    if confidence <= 3:
        return "red"
    if confidence <= 6:
        return "amber"
    return "green"


def _initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    return "".join(p[0] for p in parts[:2]).upper()


def _prob_bar(label: str, pct: float, color: str) -> str:
    return f"""
      <div class="prob-row">
        <span class="prob-label">{html.escape(label)}</span>
        <div class="prob-track"><div class="prob-fill prob-{color}" style="width:{pct}%"></div></div>
        <span class="prob-pct">{pct:.0f}%</span>
      </div>"""


def _value_badge(vb) -> str:
    slug = vb.label.lower().replace(" ", "-")
    return (
        f'<span class="value-badge value-{slug}">{html.escape(vb.label)}: {html.escape(vb.selection)} '
        f"(edge +{vb.edge:.1f}%)</span>"
    )


def _match_card(pred: MatchPrediction, featured: bool = False) -> str:
    fx = pred.fixture
    color = _confidence_color(pred.confidence)
    badge = LEAGUE_BADGES.get(fx.competition, "⚽")
    kickoff = datetime.fromisoformat(fx.kickoff_utc.replace("Z", "+00:00")).strftime("%a %d %b, %H:%M UTC")

    value_html = "".join(_value_badge(vb) for vb in pred.value_bets) or (
        '<span class="value-badge value-no-value">No Value</span>'
    )
    scores_html = "".join(
        f'<div class="score-pill"><span>{html.escape(s)}</span><small>{p:.1f}%</small></div>'
        for s, p in pred.correct_scores
    )
    risks_html = "".join(f"<li>{html.escape(r)}</li>" for r in pred.reasoning["risks"])
    stats_html = "".join(f"<li>{html.escape(s)}</li>" for s in pred.reasoning["supporting_stats"])
    sharp_html = f'<p class="sharp-signal">📈 {html.escape(pred.sharp_signal)}</p>' if pred.sharp_signal else ""

    return f"""
    <article class="card {'card-featured' if featured else ''}" data-league="{html.escape(fx.competition)}" data-confidence="{pred.confidence}">
      <header class="card-header">
        <span class="league-badge">{badge} {html.escape(fx.competition)}</span>
        <span class="confidence-chip conf-{color}">{pred.confidence}/10 · {pred.confidence_band}</span>
      </header>

      <div class="matchup">
        <div class="team">
          <div class="crest">{_initials(fx.home.name)}</div>
          <span>{html.escape(fx.home.name)}</span>
        </div>
        <span class="vs">vs</span>
        <div class="team">
          <div class="crest">{_initials(fx.away.name)}</div>
          <span>{html.escape(fx.away.name)}</span>
        </div>
      </div>
      <p class="kickoff">{kickoff}</p>

      <div class="probs">
        {_prob_bar("Home Win", pred.home_win_pct, "home")}
        {_prob_bar("Draw", pred.draw_pct, "draw")}
        {_prob_bar("Away Win", pred.away_win_pct, "away")}
      </div>

      <div class="goals-grid">
        <div><span>O1.5</span><strong>{pred.goals.over_1_5:.0f}%</strong></div>
        <div><span>O2.5</span><strong>{pred.goals.over_2_5:.0f}%</strong></div>
        <div><span>O3.5</span><strong>{pred.goals.over_3_5:.0f}%</strong></div>
        <div><span>U2.5</span><strong>{pred.goals.under_2_5:.0f}%</strong></div>
        <div><span>BTTS Y</span><strong>{pred.goals.btts_yes:.0f}%</strong></div>
        <div><span>BTTS N</span><strong>{pred.goals.btts_no:.0f}%</strong></div>
      </div>

      <div class="scores-row">{scores_html}</div>

      <div class="consensus">
        <div class="consensus-ring" style="--pct:{pred.consensus.score}">
          <span>{pred.consensus.score}</span>
        </div>
        <div>
          <strong>AI Consensus Index</strong>
          <p>{pred.consensus.interpretation}{' · models agree' if pred.consensus.agreement else ''}</p>
        </div>
      </div>

      <div class="value-bets">{value_html}</div>
      {sharp_html}

      <details class="transparency">
        <summary>Why this prediction</summary>
        <p class="why">{html.escape(str(pred.reasoning["why"]))}</p>
        <h4>Key stats</h4>
        <ul>{stats_html}</ul>
        <h4>Main risks</h4>
        <ul>{risks_html}</ul>
        <p class="rationale">{html.escape(str(pred.reasoning["confidence_rationale"]))}</p>
      </details>
    </article>"""


def _picks_row(pred: MatchPrediction, rank: int) -> str:
    fx = pred.fixture
    color = _confidence_color(pred.confidence)
    top_vb = pred.value_bets[0] if pred.value_bets else None
    value_html = f"{top_vb.label} ({top_vb.selection})" if top_vb else "No Value"
    win_pct = max(pred.home_win_pct, pred.draw_pct, pred.away_win_pct)
    outcome = (
        f"{fx.home.name} Win"
        if win_pct == pred.home_win_pct
        else ("Draw" if win_pct == pred.draw_pct else f"{fx.away.name} Win")
    )
    return f"""
      <tr>
        <td class="rank">#{rank}</td>
        <td>{html.escape(fx.home.name)} vs {html.escape(fx.away.name)}</td>
        <td>{LEAGUE_BADGES.get(fx.competition, "⚽")} {html.escape(fx.competition)}</td>
        <td>{html.escape(outcome)}</td>
        <td><span class="confidence-chip conf-{color}">{pred.confidence}/10</span></td>
        <td>{win_pct:.0f}%</td>
        <td>{html.escape(value_html)}</td>
        <td class="reason">{html.escape(key_reason(pred))}</td>
      </tr>"""


def render_dashboard(predictions: list[MatchPrediction]) -> str:
    predictions_sorted = sorted(predictions, key=lambda p: p.fixture.kickoff_utc)
    picks = top_picks(predictions)
    leagues = sorted({p.fixture.competition for p in predictions_sorted})

    picks_rows = "".join(_picks_row(p, i + 1) for i, p in enumerate(picks))
    cards_html = "".join(_match_card(p) for p in predictions_sorted)
    league_tabs = "".join(
        f'<button class="tab" data-league="{html.escape(lg)}">{LEAGUE_BADGES.get(lg, "⚽")} {html.escape(lg)}</button>'
        for lg in leagues
    )
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    summary = {
        "generated_at": generated_at,
        "fixtures_analyzed": len(predictions_sorted),
        "top_picks": len(picks),
    }

    return _TEMPLATE.format(
        generated_at=generated_at,
        summary_json=html.escape(json.dumps(summary)),
        league_tabs=league_tabs,
        picks_rows=picks_rows or '<tr><td colspan="8">No fixtures meet the 7/10 confidence threshold this weekend.</td></tr>',
        cards_html=cards_html,
        disclaimer=html.escape(DISCLAIMER),
        fixture_count=len(predictions_sorted),
        pick_count=len(picks),
    )


_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>European Football Intelligence</title>
<style>
:root {{
  --bg: #f5f6f8; --surface: #ffffff; --surface-2: #f0f1f4; --text: #14161c; --text-dim: #5b606c;
  --border: #e2e4e9; --accent: #5b5bf5; --accent-2: #16a3a3;
  --green: #1c9c5a; --amber: #c98a12; --red: #d43f3f;
  --home: #5b5bf5; --draw: #9aa0ad; --away: #ef6a5f;
  --radius: 14px; --shadow: 0 1px 3px rgba(20,22,28,.08), 0 8px 24px rgba(20,22,28,.06);
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --bg: #0d0e12; --surface: #16171d; --surface-2: #1d1f27; --text: #eef0f4; --text-dim: #9198a6;
    --border: #2a2d37; --shadow: 0 1px 3px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  }}
}}
:root[data-theme="dark"] {{
  --bg: #0d0e12; --surface: #16171d; --surface-2: #1d1f27; --text: #eef0f4; --text-dim: #9198a6;
  --border: #2a2d37; --shadow: 0 1px 3px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
.wrap {{ max-width: 1180px; margin: 0 auto; padding: 20px 16px 64px; }}
.hero {{ display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; padding: 28px 0 20px; }}
.hero h1 {{ font-size: clamp(22px, 4vw, 32px); margin: 0; letter-spacing: -0.02em; }}
.hero .eyebrow {{ color: var(--accent); font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }}
.hero .sub {{ color: var(--text-dim); margin-top: 4px; font-size: 14px; }}
.theme-toggle {{ background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 8px 14px; cursor: pointer; color: var(--text); font-size: 13px; }}
.stats-row {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 12px; margin-bottom: 24px; }}
.stat {{ background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow); }}
.stat strong {{ display: block; font-size: 22px; }}
.stat span {{ color: var(--text-dim); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }}

section.panel {{ background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; margin-bottom: 28px; overflow-x: auto; }}
section.panel h2 {{ margin: 0 0 4px; font-size: 19px; }}
section.panel .panel-sub {{ color: var(--text-dim); font-size: 13px; margin: 0 0 16px; }}
table {{ border-collapse: collapse; width: 100%; min-width: 720px; font-size: 13px; }}
th, td {{ text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }}
th {{ color: var(--text-dim); font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }}
td.rank {{ font-weight: 700; color: var(--accent); }}
td.reason {{ color: var(--text-dim); max-width: 260px; }}

.tabs {{ display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }}
.tab {{ border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 999px; padding: 7px 14px; font-size: 13px; cursor: pointer; }}
.tab.active {{ background: var(--accent); border-color: var(--accent); color: #fff; }}

.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }}
.card {{ background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; display: flex; flex-direction: column; gap: 12px; }}
.card-header {{ display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }}
.league-badge {{ font-size: 12px; color: var(--text-dim); font-weight: 600; }}
.confidence-chip {{ font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; color: #fff; }}
.conf-green {{ background: var(--green); }}
.conf-amber {{ background: var(--amber); }}
.conf-red {{ background: var(--red); }}

.matchup {{ display: flex; align-items: center; justify-content: space-between; gap: 8px; }}
.team {{ display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; text-align: center; font-size: 13px; font-weight: 600; }}
.crest {{ width: 44px; height: 44px; border-radius: 50%; background: var(--surface-2); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: var(--accent); border: 1px solid var(--border); }}
.vs {{ color: var(--text-dim); font-size: 12px; }}
.kickoff {{ margin: -6px 0 0; text-align: center; color: var(--text-dim); font-size: 12px; }}

.prob-row {{ display: grid; grid-template-columns: 70px 1fr 38px; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 6px; }}
.prob-track {{ background: var(--surface-2); border-radius: 999px; height: 8px; overflow: hidden; }}
.prob-fill {{ height: 100%; border-radius: 999px; }}
.prob-home {{ background: var(--home); }}
.prob-draw {{ background: var(--draw); }}
.prob-away {{ background: var(--away); }}
.prob-pct {{ text-align: right; font-weight: 700; }}

.goals-grid {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; text-align: center; background: var(--surface-2); border-radius: 10px; padding: 8px; }}
.goals-grid div {{ display: flex; flex-direction: column; gap: 2px; }}
.goals-grid span {{ font-size: 10px; color: var(--text-dim); text-transform: uppercase; }}
.goals-grid strong {{ font-size: 13px; }}

.scores-row {{ display: flex; gap: 8px; flex-wrap: wrap; }}
.score-pill {{ background: var(--surface-2); border-radius: 8px; padding: 6px 10px; font-size: 12px; display: flex; flex-direction: column; align-items: center; gap: 2px; }}
.score-pill small {{ color: var(--text-dim); }}

.consensus {{ display: flex; align-items: center; gap: 12px; }}
.consensus-ring {{ --pct: 0; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; background: conic-gradient(var(--accent-2) calc(var(--pct) * 1%), var(--surface-2) 0); flex-shrink: 0; }}
.consensus-ring span {{ background: var(--surface); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }}
.consensus p {{ margin: 2px 0 0; font-size: 12px; color: var(--text-dim); }}

.value-bets {{ display: flex; flex-wrap: wrap; gap: 6px; }}
.value-badge {{ font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--border); }}
.value-no-value {{ color: var(--text-dim); }}
.value-small-edge {{ background: rgba(201,138,18,.15); color: var(--amber); border-color: transparent; }}
.value-strong-value {{ background: rgba(28,156,90,.15); color: var(--green); border-color: transparent; }}
.value-premium-value {{ background: rgba(91,91,245,.15); color: var(--accent); border-color: transparent; }}

.sharp-signal {{ font-size: 12px; color: var(--accent-2); margin: -6px 0 0; }}

details.transparency summary {{ cursor: pointer; font-size: 13px; font-weight: 600; color: var(--accent); }}
details.transparency ul {{ margin: 6px 0; padding-left: 18px; font-size: 12px; color: var(--text-dim); }}
details.transparency h4 {{ margin: 10px 0 2px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-dim); }}
details.transparency .why {{ font-size: 13px; margin: 6px 0; }}
details.transparency .rationale {{ font-size: 11px; color: var(--text-dim); margin-top: 8px; }}

footer.disclaimer {{ margin-top: 32px; padding: 16px; border-radius: var(--radius); background: var(--surface-2); color: var(--text-dim); font-size: 12px; text-align: center; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div>
      <div class="eyebrow">Premium</div>
      <h1>European Football Intelligence</h1>
      <p class="sub">Structured predictions across Europe's major competitions · generated {generated_at}</p>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button">🌓 Toggle theme</button>
  </div>

  <div class="stats-row">
    <div class="stat"><strong>{fixture_count}</strong><span>Fixtures analyzed</span></div>
    <div class="stat"><strong>{pick_count}</strong><span>Top picks (7/10+)</span></div>
    <div class="stat"><strong>8</strong><span>Competitions covered</span></div>
    <div class="stat"><strong>4</strong><span>Consensus sub-models</span></div>
  </div>

  <section class="panel">
    <h2>Weekend Top European Picks</h2>
    <p class="panel-sub">Ranked strongest to weakest · confidence 7/10 or higher only</p>
    <table>
      <thead>
        <tr><th>#</th><th>Match</th><th>League</th><th>Prediction</th><th>Confidence</th><th>Est. Probability</th><th>Value Rating</th><th>Key Reason</th></tr>
      </thead>
      <tbody>{picks_rows}</tbody>
    </table>
  </section>

  <section class="panel">
    <h2>All Fixtures</h2>
    <p class="panel-sub">Filter by competition</p>
    <div class="tabs" id="leagueTabs">
      <button class="tab active" data-league="all">All</button>
      {league_tabs}
    </div>
    <div class="grid" id="cardsGrid">{cards_html}</div>
  </section>

  <footer class="disclaimer">{disclaimer}</footer>
</div>

<script>
(function() {{
  var toggle = document.getElementById('themeToggle');
  var root = document.documentElement;
  try {{
    var saved = localStorage.getItem('fi-theme');
    if (saved) root.setAttribute('data-theme', saved);
  }} catch (e) {{}}
  toggle.addEventListener('click', function() {{
    var current = root.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : (current === 'light' ? null : 'dark');
    if (next) root.setAttribute('data-theme', next); else root.removeAttribute('data-theme');
    try {{ localStorage.setItem('fi-theme', next || ''); }} catch (e) {{}}
  }});

  var tabs = document.querySelectorAll('#leagueTabs .tab');
  var cards = document.querySelectorAll('#cardsGrid .card');
  tabs.forEach(function(tab) {{
    tab.addEventListener('click', function() {{
      tabs.forEach(function(t) {{ t.classList.remove('active'); }});
      tab.classList.add('active');
      var league = tab.getAttribute('data-league');
      cards.forEach(function(card) {{
        card.style.display = (league === 'all' || card.getAttribute('data-league') === league) ? '' : 'none';
      }});
    }});
  }});
}})();
</script>
</body>
</html>
"""
