"""Engagement scope: restrict tools to explicitly authorized targets.

If no scope file exists for an engagement, scope is unenforced (matches the
tool's original behavior). Once a scope file exists — even an empty one —
enforcement is fail-closed: only listed targets are authorized.
"""

from __future__ import annotations

import ipaddress
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

import yaml


@dataclass
class Scope:
    entries: list[str] = field(default_factory=list)
    enforced: bool = False

    @classmethod
    def load(cls, path: Path) -> "Scope":
        if not path.exists():
            return cls(entries=[], enforced=False)
        data = yaml.safe_load(path.read_text()) or {}
        return cls(entries=list(data.get("authorized", [])), enforced=True)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.safe_dump({"authorized": self.entries}, sort_keys=False))
        self.enforced = True

    def add(self, target: str) -> None:
        if target not in self.entries:
            self.entries.append(target)

    def is_authorized(self, target: str) -> bool:
        if not self.enforced:
            return True
        # An IP or CIDR target is authorized only if its whole range is a
        # subnet of an authorized CIDR entry -- not merely if its network
        # address falls inside one. Otherwise authorizing 10.0.0.0/28 would
        # also authorize the far broader 10.0.0.0/8.
        target_net = _as_network(target)
        if target_net is not None:
            for entry in self.entries:
                entry_net = _as_network(entry)
                if (
                    entry_net is not None
                    and entry_net.version == target_net.version
                    and target_net.subnet_of(entry_net)
                ):
                    return True
            return False
        host = _extract_host(target)
        return any(_matches(host, entry) for entry in self.entries)


def _as_network(value: str):
    """Return the ip_network for a bare IP or CIDR, or None for a hostname/URL.

    A bare IP parses as a /32 (or /128) so single-host targets flow through the
    same subnet-containment check as CIDR ranges.
    """
    try:
        return ipaddress.ip_network(value, strict=False)
    except ValueError:
        return None


def _extract_host(target: str) -> str:
    if "://" in target:
        return urlparse(target).hostname or target
    return target.split("/")[0].split(":")[0]


def _matches(host: str, entry: str) -> bool:
    entry_host = _extract_host(entry)

    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None

    if ip is not None:
        try:
            return ip in ipaddress.ip_network(entry, strict=False)
        except ValueError:
            return False

    return host == entry_host or host.endswith("." + entry_host)
