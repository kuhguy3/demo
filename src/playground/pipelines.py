"""Prebuilt recon pipelines that chain individual tools together."""

from __future__ import annotations

from playground import actions
from playground.engagement import Engagement

WEB_PORTS = {80, 443, 8080, 8443}


def _web_url(host: str, port: int) -> str:
    scheme = "https" if port in (443, 8443) else "http"
    return f"{scheme}://{host}" if port in (80, 443) else f"{scheme}://{host}:{port}"


def run_recon(engagement: Engagement, domain: str, as_json: bool = False) -> None:
    """subdomains -> scan each resolved host -> fingerprint + map any web ports found."""
    print(f"=== recon: {domain} ===")
    subdomain_results = actions.run_subdomains(engagement, domain, as_json=as_json)
    hosts = [domain] + [host for host, _ip in subdomain_results]

    for host in hosts:
        print(f"\n--- scanning {host} ---")
        try:
            scan_results = actions.run_scan(engagement, host, as_json=as_json)
        except OSError:
            continue
        for result in scan_results:
            if result.open and result.port in WEB_PORTS:
                url = _web_url(host, result.port)
                print(f"\n--- fingerprinting {url} ---")
                actions.run_fingerprint(engagement, url, as_json=as_json)
                print(f"\n--- mapping {url} ---")
                actions.run_map(engagement, url, as_json=as_json)

    print(f"\n=== recon complete: see {engagement.report_path} ===")


def run_webrecon(engagement: Engagement, url: str, as_json: bool = False) -> None:
    """fingerprint -> map -> crawl -> fuzz the same target."""
    print(f"=== webrecon: {url} ===")
    actions.run_fingerprint(engagement, url, as_json=as_json)
    actions.run_map(engagement, url, as_json=as_json)
    actions.run_crawl(engagement, url, as_json=as_json)
    actions.run_fuzz(engagement, url, as_json=as_json)
    print(f"\n=== webrecon complete: see {engagement.report_path} ===")
