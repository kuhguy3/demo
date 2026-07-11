"""DNS-based subdomain enumeration.

For use only against domains you own or are explicitly authorized to test.
"""

from __future__ import annotations

import random
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

DEFAULT_SUBDOMAINS = [
    "www", "mail", "ftp", "api", "dev", "staging", "test", "admin",
    "portal", "vpn", "remote", "webmail", "ns1", "ns2", "smtp", "cpanel",
    "blog", "shop", "m", "app", "cdn", "static", "beta", "internal",
]


def _resolve(subdomain: str, domain: str, delay: float) -> tuple[str, str] | None:
    if delay:
        time.sleep(delay + random.uniform(0, delay))
    host = f"{subdomain}.{domain}"
    try:
        ip = socket.gethostbyname(host)
        return host, ip
    except socket.gaierror:
        return None


def enumerate(
    domain: str,
    wordlist: list[str] | None = None,
    max_workers: int = 8,
    delay: float = 0.0,
) -> list[tuple[str, str]]:
    """Resolve candidate subdomains of `domain` and return the ones that
    resolve, as sorted (host, ip) pairs.
    """
    words = wordlist or DEFAULT_SUBDOMAINS
    found: list[tuple[str, str]] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_resolve, word, domain, delay): word for word in words}
        for future in as_completed(futures):
            result = future.result()
            if result:
                found.append(result)
    return sorted(found)


def format_results(domain: str, results: list[tuple[str, str]]) -> str:
    lines = [f"Subdomains of {domain}:"]
    if not results:
        lines.append("  none found")
    for host, ip in results:
        lines.append(f"  {host} -> {ip}")
    return "\n".join(lines)
