"""Post-run drill-down menus: act on specific findings interactively."""

from __future__ import annotations

import sys

from playground import actions
from playground.engagement import Engagement

WEB_PORTS = {80, 443, 8080, 8443}


def is_interactive(no_interactive: bool, as_json: bool) -> bool:
    return not no_interactive and not as_json and sys.stdin.isatty() and sys.stdout.isatty()


def prompt_menu(title: str, options: list[str]) -> int | None:
    print(f"\n{title}")
    for i, option in enumerate(options, start=1):
        print(f"  {i}) {option}")
    print("  0) done")
    try:
        choice = input("> ").strip()
    except EOFError:
        return None
    if not choice or choice == "0":
        return None
    if not choice.isdigit():
        return None
    index = int(choice)
    return index - 1 if 1 <= index <= len(options) else None


def _web_url(host: str, port: int) -> str:
    scheme = "https" if port in (443, 8443) else "http"
    return f"{scheme}://{host}" if port in (80, 443) else f"{scheme}://{host}:{port}"


def drill_down_url(engagement: Engagement, url: str, as_json: bool) -> None:
    """Generic next-step menu for a single URL (used after headers/fingerprint/map)."""
    while True:
        choice = prompt_menu(f"What next for {url}?", ["fingerprint", "map (forms + hidden content)", "fuzz", "crawl"])
        if choice is None:
            return
        if choice == 0:
            actions.run_fingerprint(engagement, url, as_json=as_json)
        elif choice == 1:
            actions.run_map(engagement, url, as_json=as_json)
        elif choice == 2:
            actions.run_fuzz(engagement, url, as_json=as_json)
        elif choice == 3:
            actions.run_crawl(engagement, url, as_json=as_json)


def drill_down_scan(engagement: Engagement, host: str, results, as_json: bool) -> None:
    open_web = [r for r in results if r.open and r.port in WEB_PORTS]
    if not open_web:
        return
    while True:
        labels = [f"{r.port}/tcp — investigate as web service" for r in open_web]
        choice = prompt_menu(f"Open web ports on {host}", labels)
        if choice is None:
            return
        drill_down_url(engagement, _web_url(host, open_web[choice].port), as_json)


def drill_down_discover(engagement: Engagement, hosts: list[str], as_json: bool) -> None:
    if not hosts:
        return
    while True:
        choice = prompt_menu("Live hosts", hosts)
        if choice is None:
            return
        actions.run_scan(engagement, hosts[choice], as_json=as_json)


def drill_down_subdomains(engagement: Engagement, results: list[tuple[str, str]], as_json: bool) -> None:
    if not results:
        return
    while True:
        labels = [f"{host} ({ip})" for host, ip in results]
        choice = prompt_menu("Resolved subdomains", labels)
        if choice is None:
            return
        host, _ip = results[choice]
        action = prompt_menu(f"What next for {host}?", ["scan ports", "fingerprint https://" + host])
        if action == 0:
            actions.run_scan(engagement, host, as_json=as_json)
        elif action == 1:
            actions.run_fingerprint(engagement, f"https://{host}", as_json=as_json)


def drill_down_fuzz(engagement: Engagement, results, as_json: bool) -> None:
    hits = [r for r in results if r.status_code and r.status_code != 404]
    if not hits:
        return
    while True:
        labels = [f"{r.path} ({r.status_code})" for r in hits]
        choice = prompt_menu("Fuzz hits", labels)
        if choice is None:
            return
        drill_down_url(engagement, hits[choice].url, as_json)


def drill_down_crawl(engagement: Engagement, pages: list[str], as_json: bool) -> None:
    if not pages:
        return
    while True:
        choice = prompt_menu("Discovered pages", pages)
        if choice is None:
            return
        drill_down_url(engagement, pages[choice], as_json)
