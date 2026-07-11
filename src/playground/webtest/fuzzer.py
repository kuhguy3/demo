"""Simple wordlist-based path fuzzer.

For use only against sites you own or are explicitly authorized to test.
Requests are made sequentially with a small delay by default to avoid
hammering the target; tune `delay` and `max_workers` deliberately.
"""

from __future__ import annotations

import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

import requests

DEFAULT_WORDLIST = [
    "admin",
    "login",
    "api",
    "backup",
    "config",
    "dashboard",
    "debug",
    "test",
    ".env",
    "robots.txt",
    "sitemap.xml",
    ".git/HEAD",
    "uploads",
    "wp-admin",
]


@dataclass
class FuzzResult:
    path: str
    url: str
    status_code: int | None
    length: int | None


def fuzz(
    base_url: str,
    wordlist: list[str] | None = None,
    timeout: float = 5.0,
    max_workers: int = 3,
    delay: float = 0.3,
) -> list[FuzzResult]:
    """Request `base_url` + each word in `wordlist` and report status/length.

    `max_workers` and `delay` control how bursty the fuzzing is; defaults
    favor a quieter footprint over speed.
    """
    base_url = base_url.rstrip("/")
    words = wordlist or DEFAULT_WORDLIST

    def probe(word: str) -> FuzzResult:
        url = f"{base_url}/{word}"
        time.sleep(delay + random.uniform(0, delay))
        try:
            resp = requests.get(url, timeout=timeout, allow_redirects=False)
            return FuzzResult(path=word, url=url, status_code=resp.status_code, length=len(resp.content))
        except requests.RequestException:
            return FuzzResult(path=word, url=url, status_code=None, length=None)

    results: list[FuzzResult] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(probe, word): word for word in words}
        for future in as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda r: r.path)


def format_results(results: list[FuzzResult]) -> str:
    lines = []
    for r in results:
        if r.status_code is None:
            lines.append(f"  {r.path:<20} ERROR")
        elif r.status_code != 404:
            lines.append(f"  {r.path:<20} {r.status_code} ({r.length} bytes)")
    return "\n".join(lines) if lines else "  no interesting paths found"
