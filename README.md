# security playground

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
  - `subdomains` — DNS-based subdomain enumeration
- **Web app testing** (`playground.webtest`)
  - `inspector` — status/headers/cookies/redirect-chain inspection
  - `fingerprint` — passive tech fingerprinting + missing security-header report
  - `entry_points` — form/input discovery and hidden content via robots.txt/sitemap.xml
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
playground subdomains example.com
playground headers https://example.com
playground fingerprint https://example.com
playground fuzz https://example.com --wordlist words.txt
playground crawl https://example.com --max-pages 25
playground map https://example.com
```

Every command accepts `--json` (machine-readable output for scripting)
and `--no-interactive` (skip the drill-down menu below).

## Pipelines

Prebuilt chains that run several tools in sequence:

```bash
playground recon example.com      # subdomains -> scan -> fingerprint/map any web ports found
playground webrecon https://example.com  # fingerprint -> map -> crawl -> fuzz
```

## Interactive drill-down

When run in a real terminal (not `--json`/`--no-interactive`), `scan`,
`discover`, `subdomains`, `fuzz`, and `crawl` drop into a menu after
printing results, letting you act on a specific finding — e.g. scan a
discovered subdomain, or fingerprint/map/fuzz a host with an open web
port — without re-typing the command.

## Engagements: scope, audit log, findings, reports

Every command run is recorded into an **engagement workspace**
(default: `./.playground/`, override with `--engagement DIR`):

- `scope.yaml` — authorized targets (see below)
- `audit.log` — a timestamped, append-only record of every command run
- `findings.json` — structured results from every run
- `report.md` — a human-readable Markdown summary, regenerated on each run

### Scope enforcement

By default (no `scope.yaml`) tools run against any target, same as
before. Once a scope is initialized, it's enforced fail-closed — only
authorized targets can be scanned:

```bash
playground scope init --engagement ./engagements/acme
playground scope add example.com --engagement ./engagements/acme
playground scope add 10.0.0.0/24 --engagement ./engagements/acme
playground scope list --engagement ./engagements/acme

playground scan 10.0.0.5 --engagement ./engagements/acme   # allowed
playground scan evil.com --engagement ./engagements/acme   # refused, exit code 1
```

## Tests

```bash
pytest
```

All tests run against local sockets/servers spun up in-process — no
external network access is required.
