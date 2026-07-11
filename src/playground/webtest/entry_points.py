"""Entry-point mapping: HTML forms/inputs on a page, and hidden content
surfaced by robots.txt / sitemap.xml.

For use only against sites you own or are explicitly authorized to test.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urljoin
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup


@dataclass
class FormInfo:
    action: str
    method: str
    inputs: list[str] = field(default_factory=list)


def discover_forms(url: str, timeout: float = 10.0) -> list[FormInfo]:
    """Fetch `url` and return each HTML form's action, method, and input names."""
    resp = requests.get(url, timeout=timeout)
    soup = BeautifulSoup(resp.text, "html.parser")

    forms: list[FormInfo] = []
    for form in soup.find_all("form"):
        action = urljoin(url, form.get("action", ""))
        method = form.get("method", "get").upper()
        inputs = [
            tag.get("name")
            for tag in form.find_all(["input", "textarea", "select"])
            if tag.get("name")
        ]
        forms.append(FormInfo(action=action, method=method, inputs=inputs))
    return forms


def hidden_content(base_url: str, timeout: float = 10.0) -> list[str]:
    """Pull candidate paths out of robots.txt (Disallow/Allow) and sitemap.xml."""
    base_url = base_url.rstrip("/")
    paths: set[str] = set()

    try:
        resp = requests.get(f"{base_url}/robots.txt", timeout=timeout)
        if resp.status_code == 200:
            for line in resp.text.splitlines():
                line = line.strip()
                if line.lower().startswith(("disallow:", "allow:")):
                    _, _, value = line.partition(":")
                    value = value.strip()
                    if value and value != "/":
                        paths.add(value)
    except requests.RequestException:
        pass

    try:
        resp = requests.get(f"{base_url}/sitemap.xml", timeout=timeout)
        if resp.status_code == 200:
            try:
                root = ElementTree.fromstring(resp.content)
                for elem in root.iter():
                    if elem.tag.endswith("loc") and elem.text:
                        paths.add(elem.text.strip())
            except ElementTree.ParseError:
                pass
    except requests.RequestException:
        pass

    return sorted(paths)


def format_forms(forms: list[FormInfo]) -> str:
    if not forms:
        return "  no forms found"
    lines = []
    for form in forms:
        inputs = ", ".join(form.inputs) or "none"
        lines.append(f"  {form.method} {form.action}  inputs: {inputs}")
    return "\n".join(lines)
