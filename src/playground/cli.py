"""Command-line entry point for the playground toolkit.

Usage:
    playground scan HOST [--ports 22,80,443] [--timeout 0.5]
    playground discover CIDR [--timeout 1.0]
    playground headers URL
    playground fuzz URL [--wordlist FILE]
    playground crawl URL [--max-pages 25]
"""

from __future__ import annotations

import argparse
import sys

from playground.recon import host_discovery, port_scanner
from playground.webtest import crawler, fuzzer, inspector

DISCLAIMER = "Only run these tools against systems you own or are explicitly authorized to test."


def _cmd_scan(args: argparse.Namespace) -> None:
    ports = [int(p) for p in args.ports.split(",")] if args.ports else None
    results = port_scanner.scan(args.host, ports=ports, timeout=args.timeout)
    print(port_scanner.format_results(args.host, results))


def _cmd_discover(args: argparse.Namespace) -> None:
    alive = host_discovery.sweep(args.cidr, timeout=args.timeout)
    print(f"Live hosts in {args.cidr}:")
    for host in alive:
        print(f"  {host}")
    if not alive:
        print("  none responded")


def _cmd_headers(args: argparse.Namespace) -> None:
    result = inspector.inspect(args.url)
    print(inspector.format_result(result))


def _cmd_fuzz(args: argparse.Namespace) -> None:
    wordlist = None
    if args.wordlist:
        with open(args.wordlist) as f:
            wordlist = [line.strip() for line in f if line.strip()]
    results = fuzzer.fuzz(args.url, wordlist=wordlist)
    print(f"Fuzz results for {args.url}:")
    print(fuzzer.format_results(results))


def _cmd_crawl(args: argparse.Namespace) -> None:
    pages = crawler.crawl(args.url, max_pages=args.max_pages)
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
    scan_p.set_defaults(func=_cmd_scan)

    discover_p = subparsers.add_parser("discover", help="ICMP ping sweep over a CIDR")
    discover_p.add_argument("cidr")
    discover_p.add_argument("--timeout", type=float, default=1.0)
    discover_p.set_defaults(func=_cmd_discover)

    headers_p = subparsers.add_parser("headers", help="Inspect a URL's response headers/cookies")
    headers_p.add_argument("url")
    headers_p.set_defaults(func=_cmd_headers)

    fuzz_p = subparsers.add_parser("fuzz", help="Wordlist-based path fuzzing")
    fuzz_p.add_argument("url")
    fuzz_p.add_argument("--wordlist", help="path to a newline-delimited wordlist file")
    fuzz_p.set_defaults(func=_cmd_fuzz)

    crawl_p = subparsers.add_parser("crawl", help="Same-domain link crawler")
    crawl_p.add_argument("url")
    crawl_p.add_argument("--max-pages", type=int, default=25)
    crawl_p.set_defaults(func=_cmd_crawl)

    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
