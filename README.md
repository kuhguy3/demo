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

Every tool below is a plain Python function (`playground.recon.*` /
`playground.webtest.*`) as well as a CLI subcommand. Whichever way you
call it, the run goes through `playground.actions`, which checks the
target against the active engagement's scope, appends an audit-log
entry, executes the tool, and records the result into that
engagement's `findings.json`/`report.md` — see
[Engagements](#engagements-scope-audit-log-findings-reports) below.

### Network recon (`playground.recon`)

- **`port_scanner`** (`playground scan HOST`) — threaded TCP *connect*
  scan (a full handshake, not a stealth SYN scan) against a port list
  (default: a common-services list — 21, 22, 80, 443, 3306, etc., or
  pass `--ports`). Reports each port as open/closed. Banner grabbing
  (reading whatever bytes a service sends unprompted, e.g. an SSH or
  FTP version string) is opt-in via `--banners` since it's an extra
  read per open port.
- **`host_discovery`** (`playground discover CIDR`) — an ICMP ping
  sweep over every host in a CIDR block (shells out to the system
  `ping`, so no raw-socket/root privileges needed). Returns which
  hosts in the range actually respond, so you know what's worth
  port-scanning before you scan it.
- **`subdomains`** (`playground subdomains DOMAIN`) — DNS-based
  subdomain enumeration: resolves `<word>.<domain>` for each entry in
  a wordlist (default: common prefixes like `www`, `api`, `staging`,
  `admin`) and returns the ones that resolve, as `(hostname, ip)`
  pairs. Used to expand a single domain into the fuller set of hosts
  that make up a target.

### Web app testing (`playground.webtest`)

- **`inspector`** (`playground headers URL`) — makes one request to a
  URL and reports its status code, response time, headers, cookies,
  and full redirect chain. The quickest way to see what a single
  endpoint actually returns.
- **`fingerprint`** (`playground fingerprint URL`) — passively guesses
  the underlying tech stack from response headers (`Server`,
  `X-Powered-By`) and cookie names (`PHPSESSID`, `JSESSIONID`,
  `laravel_session`, etc. hint at PHP/Java/Laravel), and separately
  checks for six standard security headers (CSP,
  `Strict-Transport-Security`, `X-Frame-Options`, etc.), reporting
  which ones are missing. One GET request, purely observational.
- **`entry_points`** (`playground map URL`) — maps where user input
  can enter the app: `discover_forms` parses the page's HTML for
  `<form>` elements and lists each one's action URL, HTTP method, and
  input field names; `hidden_content` fetches `robots.txt` and
  `sitemap.xml` from the site root and pulls out any disallowed paths
  or listed URLs that aren't linked from the page itself.
- **`fuzzer`** (`playground fuzz URL`) — requests `URL/<word>` for
  every word in a wordlist (default: common sensitive paths like
  `admin`, `.env`, `.git/HEAD`, `backup`) and reports any that don't
  404 — a fast way to turn up forgotten or undocumented endpoints.
- **`crawler`** (`playground crawl URL`) — starts at a URL and follows
  same-domain links breadth-first (via `<a href>` tags) up to
  `--max-pages`, returning every page it found. Useful for mapping a
  site's structure before running the other tools against specific
  pages.

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
