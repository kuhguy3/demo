"""Host discovery via ICMP ping sweep.

For use only against networks you own or are explicitly authorized to test.
Shells out to the system `ping` binary so it works without raw-socket
privileges.
"""

from __future__ import annotations

import ipaddress
import random
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed


def _is_alive(host: str, timeout: float, delay: float) -> bool:
    if delay:
        time.sleep(delay + random.uniform(0, delay))
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


def sweep(cidr: str, timeout: float = 1.0, max_workers: int = 8, delay: float = 0.0) -> list[str]:
    """Ping-sweep every host in `cidr` and return the list of hosts that responded.

    `max_workers` and `delay` control how bursty the sweep is; defaults
    favor a quieter footprint over speed.
    """
    network = ipaddress.ip_network(cidr, strict=False)
    hosts = [str(ip) for ip in network.hosts()] or [str(network.network_address)]

    alive: list[str] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_is_alive, host, timeout, delay): host for host in hosts}
        for future in as_completed(futures):
            host = futures[future]
            if future.result():
                alive.append(host)
    return sorted(alive, key=lambda ip: ipaddress.ip_address(ip))
