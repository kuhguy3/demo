"""Minimal same-domain crawler for mapping a site's link graph.

For use only against sites you own or are explicitly authorized to test.
"""

from __future__ import annotations

from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


def crawl(start_url: str, max_pages: int = 25, timeout: float = 5.0) -> list[str]:
    """Breadth-first crawl of same-domain links starting at `start_url`.

    Returns the list of discovered URLs, in visit order.
    """
    domain = urlparse(start_url).netloc
    visited: set[str] = set()
    queue: list[str] = [start_url]
    discovered: list[str] = []

    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            resp = requests.get(url, timeout=timeout)
        except requests.RequestException:
            continue

        discovered.append(url)
        content_type = resp.headers.get("Content-Type", "")
        if "text/html" not in content_type:
            continue

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup.find_all("a", href=True):
            link = urljoin(url, tag["href"])
            parsed = urlparse(link)
            clean = parsed._replace(fragment="").geturl()
            if parsed.netloc == domain and clean not in visited:
                queue.append(clean)

    return discovered
