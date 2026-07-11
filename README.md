# demo — security playground

A personal Python playground for authorized security testing, CTF practice,
and recon experiments. **Only point these tools at systems you own or have
explicit permission to test.**

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Tools

- **Network recon** (`playground.recon`)
  - `port_scanner` — threaded TCP connect scan with banner grabbing
  - `host_discovery` — ICMP ping sweep over a CIDR range
- **Web app testing** (`playground.webtest`)
  - `inspector` — status/headers/cookies/redirect-chain inspection
  - `fuzzer` — wordlist-based path fuzzing
  - `crawler` — minimal same-domain link crawler

## CLI

```bash
playground scan 127.0.0.1 --ports 22,80,443
playground discover 192.168.1.0/24
playground headers https://example.com
playground fuzz https://example.com --wordlist words.txt
playground crawl https://example.com --max-pages 25
```

## Tests

```bash
pytest
```

All tests run against local sockets/servers spun up in-process — no
external network access is required.
