"""Passive technology fingerprinting and security-header review.

For use only against sites you own or are explicitly authorized to test.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import requests

SECURITY_HEADERS = [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
]

_HEADER_HINTS = [
    ("Server", "nginx", "nginx"),
    ("Server", "apache", "Apache"),
    ("Server", "cloudflare", "Cloudflare"),
    ("Server", "microsoft-iis", "IIS"),
    ("X-Powered-By", "php", "PHP"),
    ("X-Powered-By", "asp.net", "ASP.NET"),
    ("X-Powered-By", "express", "Express/Node.js"),
]

_COOKIE_HINTS = [
    ("phpsessid", "PHP"),
    ("jsessionid", "Java/JSP"),
    ("asp.net_sessionid", "ASP.NET"),
    ("laravel_session", "Laravel"),
    ("django", "Django"),
    ("_rails", "Ruby on Rails"),
]


@dataclass
class FingerprintResult:
    url: str
    technologies: set[str] = field(default_factory=set)
    missing_security_headers: list[str] = field(default_factory=list)
    cookies_seen: list[str] = field(default_factory=list)


def fingerprint(url: str, timeout: float = 10.0) -> FingerprintResult:
    """Passively fingerprint `url` from response headers/cookies and flag
    missing security headers. Makes a single GET request — no probing.
    """
    resp = requests.get(url, timeout=timeout)
    headers = resp.headers

    technologies: set[str] = set()
    for header, needle, tech in _HEADER_HINTS:
        value = headers.get(header, "").lower()
        if needle in value:
            technologies.add(tech)

    cookie_names = list(resp.cookies.keys())
    for name in cookie_names:
        for needle, tech in _COOKIE_HINTS:
            if needle in name.lower():
                technologies.add(tech)

    missing = [h for h in SECURITY_HEADERS if h not in headers]

    return FingerprintResult(
        url=resp.url,
        technologies=technologies,
        missing_security_headers=missing,
        cookies_seen=cookie_names,
    )


def format_result(result: FingerprintResult) -> str:
    lines = [f"Fingerprint for {result.url}:"]
    lines.append("Technologies: " + (", ".join(sorted(result.technologies)) or "none detected"))
    if result.cookies_seen:
        lines.append("Cookies seen: " + ", ".join(result.cookies_seen))
    lines.append("Missing security headers:")
    if result.missing_security_headers:
        for header in result.missing_security_headers:
            lines.append(f"  {header}")
    else:
        lines.append("  none — all checked headers present")
    return "\n".join(lines)
