"""Inspect a URL's response: status, headers, cookies, redirect chain, timing.

For use only against sites you own or are explicitly authorized to test.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import requests


@dataclass
class InspectionResult:
    url: str
    status_code: int
    elapsed_ms: float
    headers: dict = field(default_factory=dict)
    cookies: dict = field(default_factory=dict)
    redirect_chain: list[str] = field(default_factory=list)


def inspect(url: str, timeout: float = 10.0, method: str = "GET") -> InspectionResult:
    response = requests.request(method, url, timeout=timeout, allow_redirects=True)
    return InspectionResult(
        url=response.url,
        status_code=response.status_code,
        elapsed_ms=response.elapsed.total_seconds() * 1000,
        headers=dict(response.headers),
        cookies=response.cookies.get_dict(),
        redirect_chain=[r.url for r in response.history],
    )


def format_result(result: InspectionResult) -> str:
    lines = [
        f"{result.status_code} {result.url}  ({result.elapsed_ms:.0f} ms)",
    ]
    if result.redirect_chain:
        lines.append("Redirects: " + " -> ".join(result.redirect_chain + [result.url]))
    lines.append("Headers:")
    for key, value in result.headers.items():
        lines.append(f"  {key}: {value}")
    if result.cookies:
        lines.append("Cookies:")
        for key, value in result.cookies.items():
            lines.append(f"  {key}={value}")
    return "\n".join(lines)
