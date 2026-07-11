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
  - `port_scanner` — threaded TCP connect scan, banner grabbing opt-in
  - `host_discovery` — ICMP ping sweep over a CIDR range
- **Web app testing** (`playground.webtest`)
  - `inspector` — status/headers/cookies/redirect-chain inspection
  - `fuzzer` — wordlist-based path fuzzing
  - `crawler` — minimal same-domain link crawler

Recon and web-testing tools default to low concurrency and paced,
jittered delays between requests to keep traffic quiet rather than
bursty. Tune `--workers`/`--delay` (or the `max_workers`/`delay`
function args) if you need something faster.

## CLI

```bash
playground scan 127.0.0.1 --ports 22,80,443 --banners
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
