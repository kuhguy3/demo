"""CLI entry point for the European Football Intelligence module.

Usage:
    football-intel report [--out FILE]
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict

from football_intel.dashboard import render_dashboard
from football_intel.data.sample_fixtures import FIXTURES
from football_intel.engine import PredictionEngine
from football_intel.picks import top_picks


def _cmd_report(args: argparse.Namespace) -> None:
    engine = PredictionEngine()
    predictions = [engine.predict(fx) for fx in FIXTURES]

    html_out = render_dashboard(predictions)
    with open(args.out, "w") as f:
        f.write(html_out)
    print(f"Dashboard written to {args.out} ({len(predictions)} fixtures, {len(top_picks(predictions))} top picks)")

    if args.json_out:
        summary = [
            {
                "fixture": p.fixture.fixture_id,
                "competition": p.fixture.competition,
                "match": f"{p.fixture.home.name} vs {p.fixture.away.name}",
                "home_win_pct": p.home_win_pct,
                "draw_pct": p.draw_pct,
                "away_win_pct": p.away_win_pct,
                "goals": asdict(p.goals),
                "correct_scores": p.correct_scores,
                "confidence": p.confidence,
                "confidence_band": p.confidence_band,
                "consensus": asdict(p.consensus),
                "value_bets": [asdict(vb) for vb in p.value_bets],
            }
            for p in predictions
        ]
        with open(args.json_out, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"JSON report written to {args.json_out}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="football-intel", description="European Football Intelligence")
    subparsers = parser.add_subparsers(dest="command", required=True)

    report_p = subparsers.add_parser("report", help="Generate the premium HTML dashboard from sample fixtures")
    report_p.add_argument("--out", default="football_intelligence.html", help="output HTML path")
    report_p.add_argument("--json-out", help="also write a JSON summary to this path")
    report_p.set_defaults(func=_cmd_report)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
