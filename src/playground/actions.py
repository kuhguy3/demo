"""Core tool actions: run a tool, print its result, and record it against an
engagement (scope check + audit log + findings/report). Shared by the CLI,
the interactive drill-down menu, and the prebuilt pipelines so the
authorization/audit/reporting behavior is identical no matter how a tool is
invoked.
"""

from __future__ import annotations

import json as jsonlib

from playground.engagement import Engagement
from playground.recon import host_discovery, port_scanner, subdomains
from playground.webtest import crawler, entry_points, fingerprint, fuzzer, inspector


def _emit(data, summary: str, as_json: bool) -> None:
    if as_json:
        print(jsonlib.dumps(data, indent=2, default=str))
    else:
        print(summary)


def run_scan(
    engagement: Engagement,
    host: str,
    ports: list[int] | None = None,
    timeout: float = 0.5,
    workers: int = 10,
    delay: float = 0.0,
    banners: bool = False,
    as_json: bool = False,
) -> list[port_scanner.PortResult]:
    engagement.require_authorized(host)
    engagement.audit("scan", {"host": host, "ports": ports, "timeout": timeout, "workers": workers, "delay": delay, "banners": banners})
    results = port_scanner.scan(host, ports=ports, timeout=timeout, max_workers=workers, delay=delay, grab_banners=banners)
    summary = port_scanner.format_results(host, results)
    engagement.record_finding("scan", host, results, summary)
    _emit([r.__dict__ for r in results], summary, as_json)
    return results


def run_discover(
    engagement: Engagement,
    cidr: str,
    timeout: float = 1.0,
    workers: int = 8,
    delay: float = 0.0,
    as_json: bool = False,
) -> list[str]:
    engagement.require_authorized(cidr)
    engagement.audit("discover", {"cidr": cidr, "timeout": timeout, "workers": workers, "delay": delay})
    alive = host_discovery.sweep(cidr, timeout=timeout, max_workers=workers, delay=delay)
    summary = f"Live hosts in {cidr}:\n" + ("\n".join(f"  {h}" for h in alive) if alive else "  none responded")
    engagement.record_finding("discover", cidr, alive, summary)
    _emit(alive, summary, as_json)
    return alive


def run_subdomains(
    engagement: Engagement,
    domain: str,
    wordlist: list[str] | None = None,
    workers: int = 8,
    delay: float = 0.0,
    as_json: bool = False,
) -> list[tuple[str, str]]:
    engagement.require_authorized(domain)
    engagement.audit("subdomains", {"domain": domain, "workers": workers, "delay": delay})
    results = subdomains.enumerate(domain, wordlist=wordlist, max_workers=workers, delay=delay)
    summary = subdomains.format_results(domain, results)
    engagement.record_finding("subdomains", domain, results, summary)
    _emit(results, summary, as_json)
    return results


def run_headers(engagement: Engagement, url: str, as_json: bool = False) -> inspector.InspectionResult:
    engagement.require_authorized(url)
    engagement.audit("headers", {"url": url})
    result = inspector.inspect(url)
    summary = inspector.format_result(result)
    engagement.record_finding("headers", url, result, summary)
    _emit(result.__dict__, summary, as_json)
    return result


def run_fingerprint(engagement: Engagement, url: str, as_json: bool = False) -> fingerprint.FingerprintResult:
    engagement.require_authorized(url)
    engagement.audit("fingerprint", {"url": url})
    result = fingerprint.fingerprint(url)
    summary = fingerprint.format_result(result)
    engagement.record_finding("fingerprint", url, result, summary)
    _emit(result.__dict__, summary, as_json)
    return result


def run_fuzz(
    engagement: Engagement,
    url: str,
    wordlist: list[str] | None = None,
    workers: int = 3,
    delay: float = 0.3,
    as_json: bool = False,
) -> list[fuzzer.FuzzResult]:
    engagement.require_authorized(url)
    engagement.audit("fuzz", {"url": url, "workers": workers, "delay": delay})
    results = fuzzer.fuzz(url, wordlist=wordlist, max_workers=workers, delay=delay)
    summary = f"Fuzz results for {url}:\n" + fuzzer.format_results(results)
    engagement.record_finding("fuzz", url, results, summary)
    _emit([r.__dict__ for r in results], summary, as_json)
    return results


def run_crawl(
    engagement: Engagement,
    url: str,
    max_pages: int = 25,
    delay: float = 0.2,
    as_json: bool = False,
) -> list[str]:
    engagement.require_authorized(url)
    engagement.audit("crawl", {"url": url, "max_pages": max_pages, "delay": delay})
    pages = crawler.crawl(url, max_pages=max_pages, delay=delay)
    summary = f"Discovered {len(pages)} page(s):\n" + "\n".join(f"  {p}" for p in pages)
    engagement.record_finding("crawl", url, pages, summary)
    _emit(pages, summary, as_json)
    return pages


def run_map(engagement: Engagement, url: str, as_json: bool = False) -> dict:
    engagement.require_authorized(url)
    engagement.audit("map", {"url": url})

    from urllib.parse import urlparse

    forms = entry_points.discover_forms(url)
    parsed = urlparse(url)
    site_root = f"{parsed.scheme}://{parsed.netloc}"
    hidden = entry_points.hidden_content(site_root)

    summary_lines = [f"Forms on {url}:", entry_points.format_forms(forms)]
    summary_lines.append(f"\nHidden content (robots.txt / sitemap.xml) for {site_root}:")
    summary_lines.append("\n".join(f"  {p}" for p in hidden) if hidden else "  none found")
    summary = "\n".join(summary_lines)

    data = {"forms": [f.__dict__ for f in forms], "hidden_content": hidden}
    engagement.record_finding("map", url, data, summary)
    _emit(data, summary, as_json)
    return data
