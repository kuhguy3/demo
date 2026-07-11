"""TCP connect port scanner.

For use only against hosts you own or are explicitly authorized to test.
"""

from __future__ import annotations

import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

COMMON_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 8080, 8443]


@dataclass
class PortResult:
    port: int
    open: bool
    banner: str | None = None


def _probe_port(host: str, port: int, timeout: float) -> PortResult:
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            banner = None
            try:
                sock.settimeout(timeout)
                data = sock.recv(128)
                if data:
                    banner = data.decode(errors="replace").strip()
            except (socket.timeout, OSError):
                pass
            return PortResult(port=port, open=True, banner=banner)
    except (socket.timeout, ConnectionRefusedError, OSError):
        return PortResult(port=port, open=False)


def scan(
    host: str,
    ports: list[int] | None = None,
    timeout: float = 0.5,
    max_workers: int = 50,
) -> list[PortResult]:
    """Scan `host` on `ports` (default: COMMON_PORTS) using TCP connect scanning.

    Returns results for every port, open and closed, in ascending port order.
    """
    ports = ports or COMMON_PORTS
    results: list[PortResult] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_probe_port, host, port, timeout): port for port in ports}
        for future in as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda r: r.port)


def format_results(host: str, results: list[PortResult]) -> str:
    lines = [f"Scan results for {host}:"]
    open_results = [r for r in results if r.open]
    if not open_results:
        lines.append("  no open ports found")
    for r in open_results:
        banner = f" ({r.banner})" if r.banner else ""
        lines.append(f"  {r.port}/tcp open{banner}")
    return "\n".join(lines)
