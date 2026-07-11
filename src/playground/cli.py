"""Command-line entry point for the playground toolkit.

Usage:
    playground scan HOST [--ports 22,80,443] [--timeout 0.5]
    playground discover CIDR [--timeout 1.0]
    playground subdomains DOMAIN [--wordlist FILE]
    playground headers URL
    playground fingerprint URL
    playground fuzz URL [--wordlist FILE]
    playground crawl URL [--max-pages 25]
    playground map URL
    playground recon DOMAIN       (pipeline: subdomains -> scan -> fingerprint/map)
    playground webrecon URL       (pipeline: fingerprint -> map -> crawl -> fuzz)
    playground scope init|add TARGET|list

Every command records its findings into an engagement workspace
(default: ./.playground/) containing scope.yaml, audit.log,
findings.json, and report.md. Use --engagement DIR to point elsewhere.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from playground import actions, interactive, pipelines
from playground.engagement import Engagement, ScopeViolation

DISCLAIMER = "Only run these tools against systems you own or are explicitly authorized to test."


def _load_wordlist(path: str | None) -> list[str] | None:
    if not path:
        return None
    with open(path) as f:
        return [line.strip() for line in f if line.strip()]


def _cmd_scan(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    ports = [int(p) for p in args.ports.split(",")] if args.ports else None
    results = actions.run_scan(
        engagement,
        args.host,
        ports=ports,
        timeout=args.timeout,
        workers=args.workers,
        delay=args.delay,
        banners=args.banners,
        as_json=args.json,
    )
    if interactive.is_interactive(args.no_interactive, args.json):
        interactive.drill_down_scan(engagement, args.host, results, args.json)


def _cmd_discover(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    hosts = actions.run_discover(
        engagement, args.cidr, timeout=args.timeout, workers=args.workers, delay=args.delay, as_json=args.json
    )
    if interactive.is_interactive(args.no_interactive, args.json):
        interactive.drill_down_discover(engagement, hosts, args.json)


def _cmd_subdomains(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    wordlist = _load_wordlist(args.wordlist)
    results = actions.run_subdomains(
        engagement, args.domain, wordlist=wordlist, workers=args.workers, delay=args.delay, as_json=args.json
    )
    if interactive.is_interactive(args.no_interactive, args.json):
        interactive.drill_down_subdomains(engagement, results, args.json)


def _cmd_headers(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    actions.run_headers(engagement, args.url, as_json=args.json)
    if interactive.is_interactive(args.no_interactive, args.json):
        interactive.drill_down_url(engagement, args.url, args.json)


def _cmd_fingerprint(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    actions.run_fingerprint(engagement, args.url, as_json=args.json)
    if interactive.is_interactive(args.no_interactive, args.json):
        interactive.drill_down_url(engagement, args.url, args.json)


def _cmd_fuzz(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    wordlist = _load_wordlist(args.wordlist)
    results = actions.run_fuzz(
        engagement, args.url, wordlist=wordlist, workers=args.workers, delay=args.delay, as_json=args.json
    )
    if interactive.is_interactive(args.no_interactive, args.json):
        interactive.drill_down_fuzz(engagement, results, args.json)


def _cmd_crawl(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    pages = actions.run_crawl(engagement, args.url, max_pages=args.max_pages, delay=args.delay, as_json=args.json)
    if interactive.is_interactive(args.no_interactive, args.json):
        interactive.drill_down_crawl(engagement, pages, args.json)


def _cmd_map(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    actions.run_map(engagement, args.url, as_json=args.json)
    if interactive.is_interactive(args.no_interactive, args.json):
        interactive.drill_down_url(engagement, args.url, args.json)


def _cmd_recon(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    pipelines.run_recon(engagement, args.domain, as_json=args.json)


def _cmd_webrecon(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    pipelines.run_webrecon(engagement, args.url, as_json=args.json)


def _cmd_scope_init(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    engagement.scope.save(engagement.scope_path)
    print(f"Initialized scope at {engagement.scope_path} (enforcement is now ON — nothing is authorized yet).")


def _cmd_scope_add(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    engagement.scope.add(args.target)
    engagement.scope.save(engagement.scope_path)
    print(f"Authorized '{args.target}' in {engagement.scope_path}")


def _cmd_scope_list(args: argparse.Namespace) -> None:
    engagement = Engagement(Path(args.engagement))
    if not engagement.scope.enforced:
        print("Scope is not enforced (no scope.yaml found). Run `playground scope init` to enable it.")
        return
    if not engagement.scope.entries:
        print(f"Scope enforced ({engagement.scope_path}) but empty — nothing is authorized.")
        return
    print(f"Authorized targets ({engagement.scope_path}):")
    for entry in engagement.scope.entries:
        print(f"  {entry}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="playground", description=DISCLAIMER)
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--engagement", default=".playground", help="engagement workspace directory (scope/audit/findings/report)"
    )

    tool = argparse.ArgumentParser(add_help=False, parents=[common])
    tool.add_argument("--json", action="store_true", help="print machine-readable JSON instead of formatted text")
    tool.add_argument("--no-interactive", action="store_true", help="skip the post-run drill-down menu")

    scan_p = subparsers.add_parser("scan", parents=[tool], help="TCP connect port scan")
    scan_p.add_argument("host")
    scan_p.add_argument("--ports", help="comma-separated port list")
    scan_p.add_argument("--timeout", type=float, default=0.5)
    scan_p.add_argument("--workers", type=int, default=10, help="max concurrent connection attempts")
    scan_p.add_argument("--delay", type=float, default=0.0, help="pacing delay (seconds) between probes")
    scan_p.add_argument("--banners", action="store_true", help="attempt banner grabbing on open ports")
    scan_p.set_defaults(func=_cmd_scan)

    discover_p = subparsers.add_parser("discover", parents=[tool], help="ICMP ping sweep over a CIDR")
    discover_p.add_argument("cidr")
    discover_p.add_argument("--timeout", type=float, default=1.0)
    discover_p.add_argument("--workers", type=int, default=8, help="max concurrent pings")
    discover_p.add_argument("--delay", type=float, default=0.0, help="pacing delay (seconds) between pings")
    discover_p.set_defaults(func=_cmd_discover)

    subdomains_p = subparsers.add_parser("subdomains", parents=[tool], help="DNS-based subdomain enumeration")
    subdomains_p.add_argument("domain")
    subdomains_p.add_argument("--wordlist", help="path to a newline-delimited wordlist file")
    subdomains_p.add_argument("--workers", type=int, default=8, help="max concurrent resolutions")
    subdomains_p.add_argument("--delay", type=float, default=0.0, help="pacing delay (seconds) between lookups")
    subdomains_p.set_defaults(func=_cmd_subdomains)

    headers_p = subparsers.add_parser("headers", parents=[tool], help="Inspect a URL's response headers/cookies")
    headers_p.add_argument("url")
    headers_p.set_defaults(func=_cmd_headers)

    fingerprint_p = subparsers.add_parser(
        "fingerprint", parents=[tool], help="Passive tech fingerprinting + missing security headers"
    )
    fingerprint_p.add_argument("url")
    fingerprint_p.set_defaults(func=_cmd_fingerprint)

    fuzz_p = subparsers.add_parser("fuzz", parents=[tool], help="Wordlist-based path fuzzing")
    fuzz_p.add_argument("url")
    fuzz_p.add_argument("--wordlist", help="path to a newline-delimited wordlist file")
    fuzz_p.add_argument("--workers", type=int, default=3, help="max concurrent requests")
    fuzz_p.add_argument("--delay", type=float, default=0.3, help="pacing delay (seconds) between requests")
    fuzz_p.set_defaults(func=_cmd_fuzz)

    crawl_p = subparsers.add_parser("crawl", parents=[tool], help="Same-domain link crawler")
    crawl_p.add_argument("url")
    crawl_p.add_argument("--max-pages", type=int, default=25)
    crawl_p.add_argument("--delay", type=float, default=0.2, help="pacing delay (seconds) between page fetches")
    crawl_p.set_defaults(func=_cmd_crawl)

    map_p = subparsers.add_parser(
        "map", parents=[tool], help="Discover forms/inputs and hidden content (robots.txt/sitemap.xml)"
    )
    map_p.add_argument("url")
    map_p.set_defaults(func=_cmd_map)

    recon_p = subparsers.add_parser(
        "recon", parents=[tool], help="Pipeline: subdomains -> scan -> fingerprint/map any web ports found"
    )
    recon_p.add_argument("domain")
    recon_p.set_defaults(func=_cmd_recon)

    webrecon_p = subparsers.add_parser(
        "webrecon", parents=[tool], help="Pipeline: fingerprint -> map -> crawl -> fuzz"
    )
    webrecon_p.add_argument("url")
    webrecon_p.set_defaults(func=_cmd_webrecon)

    scope_p = subparsers.add_parser("scope", help="Manage the engagement's authorized-target scope")
    scope_sub = scope_p.add_subparsers(dest="scope_command", required=True)

    scope_init_p = scope_sub.add_parser("init", parents=[common], help="create an (empty) scope file, enabling enforcement")
    scope_init_p.set_defaults(func=_cmd_scope_init)

    scope_add_p = scope_sub.add_parser("add", parents=[common], help="authorize a target (domain, IP, or CIDR)")
    scope_add_p.add_argument("target")
    scope_add_p.set_defaults(func=_cmd_scope_add)

    scope_list_p = scope_sub.add_parser("list", parents=[common], help="list authorized targets")
    scope_list_p.set_defaults(func=_cmd_scope_list)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except ScopeViolation as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
