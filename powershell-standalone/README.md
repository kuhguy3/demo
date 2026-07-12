# playground — standalone PowerShell edition (Windows PowerShell 5.1)

A single-file, dependency-free reconnaissance and web-testing assistant for
**authorized** red-team engagements, penetration tests, and CTFs. It packages
the same toolkit as the [Python port](../README.md) and the
[PowerShell 7 module](../powershell/README.md) into one `.ps1` that runs on a
stock Windows box — no module install, no `pip`, no PowerShell 7.

> **Authorized use only.** Every tool here is for systems you own or have
> explicit, written permission to test. The engagement workspace enforces a
> scope allow-list precisely so that operators stay inside their rules of
> engagement — keep it that way. This is a recon/enumeration toolkit, not an
> exploitation framework: it discovers and describes attack surface, it does
> not attack it.

## Why a standalone 5.1 script

For an operator, the deployment story is the point:

- **Runs on the target's own tooling.** Windows PowerShell 5.1 ships in-box on
  every Windows 10/11 and Server 2016+ host. No installer, no dependency to
  drop, nothing that a change-control ticket has to approve. Copy one file and
  run it.
- **TLS 1.2 is forced on startup**, so HTTPS targets work on older .NET
  Framework defaults that would otherwise negotiate down and fail.
- **Native parameter binding** (`-Action`, `-Target`, `-Ports`, …) with a
  `ValidateSet` on the action — tab-completion and validation come for free.
- **Fails soft on per-request errors.** A dead host or a proxy rejection prints
  an inline error and the run continues, instead of aborting a whole pipeline
  on the first failure — the behavior you want when sweeping a range where some
  hosts are down.

The trade-off vs. the PowerShell 7 module: concurrency here is
`Start-Job`-based (a separate process per worker), which is heavier and slower
than the module's runspace approach. For quiet, paced recon that's usually
fine; for large sweeps, prefer the PS7 module.

## Capabilities (recon & enumeration)

Methodology follows the recon phase of *The Hacker Playbook 3* (network
enumeration) and *The Web Application Hacker's Handbook* (mapping the
application):

| Action | Purpose |
| --- | --- |
| `scan` | TCP connect port scan (optional banner grab) |
| `discover` | ICMP ping sweep across a CIDR |
| `subdomains` | DNS-based subdomain enumeration |
| `headers` | Response status / headers / cookies / redirect chain |
| `fingerprint` | Passive tech fingerprint + missing security-header report |
| `map` | Form/input discovery + hidden content (`robots.txt`, `sitemap.xml`) |
| `fuzz` | Wordlist path discovery |
| `crawl` | Same-domain link crawl |
| `recon` | Pipeline: `subdomains → scan → fingerprint/map` any web ports |
| `webrecon` | Pipeline: `fingerprint → map → crawl → fuzz` |
| `scope-init` / `scope-add` / `scope-list` | Manage the engagement scope allow-list |

Every run is quiet-by-default (low concurrency, jittered pacing) and is
recorded into an **engagement workspace** — `scope.json`, `audit.log`,
`findings.json`, and a regenerated `report.md` — so an operator has a
defensible, timestamped record of exactly what was run against what.

Run with no `-Action` for a guided interactive menu; run with an action for a
scriptable one-shot. Add `-Json` for machine-readable output, `-NoInteractive`
to suppress the post-run drill-down.

## Usage

```powershell
# Establish rules of engagement first
.\playground.ps1 -Action scope-init -EngagementDir .\engagements\acme
.\playground.ps1 -Action scope-add -Target acme.example.com -EngagementDir .\engagements\acme

# Then work inside it
.\playground.ps1 -Action recon      -Target acme.example.com -EngagementDir .\engagements\acme
.\playground.ps1 -Action scan       -Target 10.0.0.5 -Ports 22,80,443 -Banners -EngagementDir .\engagements\acme
.\playground.ps1 -Action webrecon   -Target https://acme.example.com -EngagementDir .\engagements\acme

.\playground.ps1 -Help              # usage
.\playground.ps1                    # interactive menu
```

## Known issues (as of this drop)

This script is the operator's verbatim version and has **not** yet had the
fixes below applied. They were found by running it end-to-end; a couple matter
for correctness of the safety and evidence trail, so read before relying on it:

1. **Scope enforcement is too permissive for CIDR targets.** Authorizing a
   narrow range (e.g. `10.0.0.0/28`) currently also authorizes any *broader*
   range sharing the same network address — `discover -Target 10.0.0.0/8`
   passes the scope check. The single-host and URL checks are correct; only
   range-vs-range containment is wrong. **Treat scope as a reminder, not a
   guarantee, until this is fixed** — this same bug is present in the Python
   and PS7 ports too.
2. **`-Json` prints nothing.** JSON output is emitted to a swallowed pipeline;
   the data is still written to `findings.json`, but nothing reaches stdout.
3. **`audit.log` records `"args":[]` for every command.** The `$Args`
   parameter name collides with PowerShell's automatic `$args`, so command
   arguments are lost from the audit trail (the command name and timestamp are
   still recorded).
4. **Two interactive menu titles render blank** ("What next for ?") because
   `"$Url?"` / `"$host_?"` interpolate a nonexistent `Url?`/`host_?` variable —
   cosmetic only.
5. **`findings.json` stores `data: null` instead of `[]`** for runs with zero
   results — a fidelity gap for anything parsing findings programmatically.

Ask and these can be fixed in a follow-up commit.

## Relationship to the other ports

| Port | Location | Runtime | Layout |
| --- | --- | --- | --- |
| Python | [repo root](../README.md) | CPython 3.9+ | package + CLI |
| PowerShell 7 module | [`powershell/`](../powershell/README.md) | PowerShell 7 | multi-file module |
| Standalone 5.1 | this directory | Windows PowerShell 5.1 | single file |

All three implement the same toolkit, engagement model, and pipelines.
