# playground (PowerShell)

A PowerShell 7+ port of the [Python playground](../README.md): the same
authorized-testing security toolkit (recon, web-app testing, engagement
scope/audit/findings, pipelines, interactive drill-down), reimplemented
with idiomatic PowerShell and .NET APIs instead of Python.

**Only run these tools against systems you own or have explicit
permission to test.**

## Requirements

- PowerShell 7.0+ (uses `ForEach-Object -Parallel`)
- No external module dependencies — everything is built on .NET
  (`System.Net.Sockets`, `System.Net.Http`, `System.Net.NetworkInformation`)
  and PowerShell built-ins (`ConvertTo-Json`/`ConvertFrom-Json` instead of
  YAML, regex-based HTML parsing instead of a DOM library)

## Design differences from the Python port

- **Scope file is `scope.json`, not `scope.yaml`** — no built-in YAML
  cmdlets in PowerShell without an extra module, so JSON (native via
  `ConvertTo-Json`/`ConvertFrom-Json`) is used instead. Same semantics:
  unenforced until the file exists, fail-closed once it does.
- **HTML parsing is regex-based**, not a full DOM parser (no
  HtmlAgilityPack dependency). Good enough for well-formed pages; unusual
  markup may not parse as cleanly as BeautifulSoup would.
- **Host discovery uses `System.Net.NetworkInformation.Ping`** directly
  (real ICMP) rather than shelling out to the system `ping` binary.

## Tools

Same tool set as the Python port — see its
[README](../README.md#tools) for what each one does. Every `Invoke-Playground*`
function is also available as a `playground.ps1` CLI subcommand:

```powershell
./playground.ps1 scan 127.0.0.1 --ports 22,80,443 --banners
./playground.ps1 discover 192.168.1.0/24
./playground.ps1 subdomains example.com
./playground.ps1 headers https://example.com
./playground.ps1 fingerprint https://example.com
./playground.ps1 fuzz https://example.com --wordlist words.txt
./playground.ps1 crawl https://example.com --max-pages 25
./playground.ps1 map https://example.com
```

Every command accepts `--engagement DIR`, `--json`, and `--no-interactive`
— see [Engagements](#engagements-scope-audit-log-findings-reports) and
[Interactive drill-down](#interactive-drill-down) below.

## Pipelines

```powershell
./playground.ps1 recon example.com              # subdomains -> scan -> fingerprint/map any web ports found
./playground.ps1 webrecon https://example.com    # fingerprint -> map -> crawl -> fuzz
```

## Interactive drill-down

When run in a real terminal (not `--json`/`--no-interactive`), `scan`,
`discover`, `subdomains`, `fuzz`, and `crawl` drop into a menu after
printing results, letting you act on a specific finding — e.g. scan a
discovered subdomain, or fingerprint/map/fuzz a host with an open web
port — without re-typing the command.

## Engagements: scope, audit log, findings, reports

Every command run is recorded into an **engagement workspace** (default:
`./.playground/`, override with `--engagement DIR`):

- `scope.json` — authorized targets
- `audit.log` — a timestamped, append-only JSON-lines record of every command run
- `findings.json` — structured results from every run
- `report.md` — a human-readable Markdown summary, regenerated on each run

```powershell
./playground.ps1 scope init --engagement ./engagements/acme
./playground.ps1 scope add example.com --engagement ./engagements/acme
./playground.ps1 scope add 10.0.0.0/24 --engagement ./engagements/acme
./playground.ps1 scope list --engagement ./engagements/acme

./playground.ps1 scan 10.0.0.5 --engagement ./engagements/acme   # allowed
./playground.ps1 scan evil.com --engagement ./engagements/acme   # refused, exit code 1
```

## Using it as a module

Every function is also importable directly, if you'd rather script
against it than use the CLI:

```powershell
Import-Module ./Playground.psd1
$engagement = New-PlaygroundEngagement -Root './.playground'
Invoke-ScanAction -Engagement $engagement -TargetHost '127.0.0.1' -AsJson
```

## Tests

Pester tests live in `tests/*.Tests.ps1` (mirroring the Python port's
pytest suite) and run against a local `System.Net.HttpListener` test
server (`tests/TestServer.ps1`) — no external network access required.

```powershell
Install-Module Pester -Force -Scope CurrentUser  # if not already installed
Invoke-Pester ./tests
```
