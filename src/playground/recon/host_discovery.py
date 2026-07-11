"""Host discovery via ICMP ping sweep.

For use only against networks you own or are explicitly authorized to test.
Shells out to the system `ping` binary so it works without raw-socket
privileges.
"""

from __future__ import annotations

import ipaddress
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed


def _is_alive(host: str, timeout: float) -> bool:
    timeout_ms = max(int(timeout * 1000), 1)
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", str(max(int(timeout), 1)), host],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout + 1,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False
    finally:
        _ = timeout_ms  # reserved for platforms where ping takes ms


def sweep(cidr: str, timeout: float = 1.0, max_workers: int = 32) -> list[str]:
    """Ping-sweep every host in `cidr` and return the list of hosts that responded."""
    network = ipaddress.ip_network(cidr, strict=False)
    hosts = [str(ip) for ip in network.hosts()] or [str(network.network_address)]

    alive: list[str] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_is_alive, host, timeout): host for host in hosts}
        for future in as_completed(futures):
            host = futures[future]
            if future.result():
                alive.append(host)
    return sorted(alive, key=lambda ip: ipaddress.ip_address(ip))
