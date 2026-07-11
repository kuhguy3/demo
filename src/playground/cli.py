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
"""

from __future__ import annotations

import argparse
import sys
from urllib.parse import urlparse

from playground.recon import host_discovery, port_scanner, subdomains
from playground.webtest import crawler, entry_points, fingerprint, fuzzer, inspector

DISCLAIMER = "Only run these tools against systems you own or are explicitly authorized to test."


def _cmd_scan(args: argparse.Namespace) -> None:
    ports = [int(p) for p in args.ports.split(",")] if args.ports else None
    results = port_scanner.scan(
        args.host,
        ports=ports,
        timeout=args.timeout,
        max_workers=args.workers,
        delay=args.delay,
        grab_banners=args.banners,
    )
    print(port_scanner.format_results(args.host, results))


def _cmd_discover(args: argparse.Namespace) -> None:
    alive = host_discovery.sweep(args.cidr, timeout=args.timeout, max_workers=args.workers, delay=args.delay)
    print(f"Live hosts in {args.cidr}:")
    for host in alive:
        print(f"  {host}")
    if not alive:
        print("  none responded")


def _cmd_subdomains(args: argparse.Namespace) -> None:
    wordlist = None
    if args.wordlist:
        with open(args.wordlist) as f:
            wordlist = [line.strip() for line in f if line.strip()]
    results = subdomains.enumerate(args.domain, wordlist=wordlist, max_workers=args.workers, delay=args.delay)
    print(subdomains.format_results(args.domain, results))


def _cmd_headers(args: argparse.Namespace) -> None:
    result = inspector.inspect(args.url)
    print(inspector.format_result(result))


def _cmd_fingerprint(args: argparse.Namespace) -> None:
    result = fingerprint.fingerprint(args.url)
    print(fingerprint.format_result(result))


def _cmd_map(args: argparse.Namespace) -> None:
    forms = entry_points.discover_forms(args.url)
    print(f"Forms on {args.url}:")
    print(entry_points.format_forms(forms))

    parsed = urlparse(args.url)
    site_root = f"{parsed.scheme}://{parsed.netloc}"
    hidden = entry_points.hidden_content(site_root)
    print(f"\nHidden content (robots.txt / sitemap.xml) for {site_root}:")
    if hidden:
        for path in hidden:
            print(f"  {path}")
    else:
        print("  none found")


def _cmd_fuzz(args: argparse.Namespace) -> None:
    wordlist = None
    if args.wordlist:
        with open(args.wordlist) as f:
            wordlist = [line.strip() for line in f if line.strip()]
    results = fuzzer.fuzz(args.url, wordlist=wordlist, max_workers=args.workers, delay=args.delay)
    print(f"Fuzz results for {args.url}:")
    print(fuzzer.format_results(results))


def _cmd_crawl(args: argparse.Namespace) -> None:
    pages = crawler.crawl(args.url, max_pages=args.max_pages, delay=args.delay)
    print(f"Discovered {len(pages)} page(s):")
    for page in pages:
        print(f"  {page}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="playground", description=DISCLAIMER)
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_p = subparsers.add_parser("scan", help="TCP connect port scan")
    scan_p.add_argument("host")
    scan_p.add_argument("--ports", help="comma-separated port list")
    scan_p.add_argument("--timeout", type=float, default=0.5)
    scan_p.add_argument("--workers", type=int, default=10, help="max concurrent connection attempts")
    scan_p.add_argument("--delay", type=float, default=0.0, help="pacing delay (seconds) between probes")
    scan_p.add_argument("--banners", action="store_true", help="attempt banner grabbing on open ports")
    scan_p.set_defaults(func=_cmd_scan)

    discover_p = subparsers.add_parser("discover", help="ICMP ping sweep over a CIDR")
    discover_p.add_argument("cidr")
    discover_p.add_argument("--timeout", type=float, default=1.0)
    discover_p.add_argument("--workers", type=int, default=8, help="max concurrent pings")
    discover_p.add_argument("--delay", type=float, default=0.0, help="pacing delay (seconds) between pings")
    discover_p.set_defaults(func=_cmd_discover)

    subdomains_p = subparsers.add_parser("subdomains", help="DNS-based subdomain enumeration")
    subdomains_p.add_argument("domain")
    subdomains_p.add_argument("--wordlist", help="path to a newline-delimited wordlist file")
    subdomains_p.add_argument("--workers", type=int, default=8, help="max concurrent resolutions")
    subdomains_p.add_argument("--delay", type=float, default=0.0, help="pacing delay (seconds) between lookups")
    subdomains_p.set_defaults(func=_cmd_subdomains)

    headers_p = subparsers.add_parser("headers", help="Inspect a URL's response headers/cookies")
    headers_p.add_argument("url")
    headers_p.set_defaults(func=_cmd_headers)

    fingerprint_p = subparsers.add_parser(
        "fingerprint", help="Passive tech fingerprinting + missing security headers"
    )
    fingerprint_p.add_argument("url")
    fingerprint_p.set_defaults(func=_cmd_fingerprint)

    fuzz_p = subparsers.add_parser("fuzz", help="Wordlist-based path fuzzing")
    fuzz_p.add_argument("url")
    fuzz_p.add_argument("--wordlist", help="path to a newline-delimited wordlist file")
    fuzz_p.add_argument("--workers", type=int, default=3, help="max concurrent requests")
    fuzz_p.add_argument("--delay", type=float, default=0.3, help="pacing delay (seconds) between requests")
    fuzz_p.set_defaults(func=_cmd_fuzz)

    crawl_p = subparsers.add_parser("crawl", help="Same-domain link crawler")
    crawl_p.add_argument("url")
    crawl_p.add_argument("--max-pages", type=int, default=25)
    crawl_p.add_argument("--delay", type=float, default=0.2, help="pacing delay (seconds) between page fetches")
    crawl_p.set_defaults(func=_cmd_crawl)

    map_p = subparsers.add_parser("map", help="Discover forms/inputs and hidden content (robots.txt/sitemap.xml)")
    map_p.add_argument("url")
    map_p.set_defaults(func=_cmd_map)

    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
