#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Playground: a PowerShell security-testing playground for authorized
    recon and web-app testing (port scan, ping sweep, subdomain enum,
    header inspection, tech fingerprinting, entry-point mapping, fuzzing,
    crawling), with engagement scope enforcement, audit logging, and
    findings/report tracking.

.DESCRIPTION
    Only run these tools against systems you own or are explicitly
    authorized to test.

    Usage:
      playground.ps1 scan HOST [--ports 22,80,443] [--timeout 0.5] [--workers 10] [--delay 0] [--banners]
      playground.ps1 discover CIDR [--timeout-ms 1000] [--workers 8] [--delay 0]
      playground.ps1 subdomains DOMAIN [--wordlist FILE] [--workers 8] [--delay 0]
      playground.ps1 headers URL
      playground.ps1 fingerprint URL
      playground.ps1 fuzz URL [--wordlist FILE] [--workers 3] [--delay 0.3]
      playground.ps1 crawl URL [--max-pages 25] [--delay 0.2]
      playground.ps1 map URL
      playground.ps1 recon DOMAIN       (pipeline: subdomains -> scan -> fingerprint/map)
      playground.ps1 webrecon URL       (pipeline: fingerprint -> map -> crawl -> fuzz)
      playground.ps1 scope init|add TARGET|list

    Every command accepts --engagement DIR (default ./.playground),
    --json (machine-readable output), and --no-interactive (skip the
    post-run drill-down menu). Every run is recorded into the engagement's
    scope.json / audit.log / findings.json / report.md.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory)]
    [string]$Command,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest = @()
)

Import-Module (Join-Path $PSScriptRoot 'Playground.psd1') -Force

function Get-FlagValue {
    param([string[]]$Tokens, [string]$Name, [string]$Default = $null)
    $idx = [Array]::IndexOf($Tokens, "--$Name")
    if ($idx -ge 0 -and $idx + 1 -lt $Tokens.Count) { return $Tokens[$idx + 1] }
    return $Default
}

function Test-FlagSwitch {
    param([string[]]$Tokens, [string]$Name)
    return $Tokens -contains "--$Name"
}

function Get-Wordlist {
    param([string]$Path)
    if (-not $Path) { return $null }
    return @(Get-Content -LiteralPath $Path | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() })
}

$exitCode = 0

try {
    switch ($Command) {
        { $_ -in @('help', '--help', '-h') } {
            @'
Playground: a PowerShell security-testing playground for authorized
recon and web-app testing. Only run these tools against systems you
own or are explicitly authorized to test.

Usage:
  playground.ps1 scan HOST [--ports 22,80,443] [--timeout 0.5] [--workers 10] [--delay 0] [--banners]
  playground.ps1 discover CIDR [--timeout-ms 1000] [--workers 8] [--delay 0]
  playground.ps1 subdomains DOMAIN [--wordlist FILE] [--workers 8] [--delay 0]
  playground.ps1 headers URL
  playground.ps1 fingerprint URL
  playground.ps1 fuzz URL [--wordlist FILE] [--workers 3] [--delay 0.3]
  playground.ps1 crawl URL [--max-pages 25] [--delay 0.2]
  playground.ps1 map URL
  playground.ps1 recon DOMAIN       (pipeline: subdomains -> scan -> fingerprint/map)
  playground.ps1 webrecon URL       (pipeline: fingerprint -> map -> crawl -> fuzz)
  playground.ps1 scope init|add TARGET|list

Every command accepts --engagement DIR (default ./.playground),
--json (machine-readable output), and --no-interactive (skip the
post-run drill-down menu). Every run is recorded into the engagement's
scope.json / audit.log / findings.json / report.md.
'@ | Write-Host
        }
        'scope' {
            $subCommand = $Rest[0]
            $subRest = @(if ($Rest.Count -gt 1) { $Rest[1..($Rest.Count - 1)] } else { @() })
            $engagementDir = Get-FlagValue -Tokens $subRest -Name 'engagement' -Default '.playground'
            $engagement = New-PlaygroundEngagement -Root $engagementDir

            switch ($subCommand) {
                'init' { Initialize-PlaygroundEngagementScope -Engagement $engagement }
                'add' {
                    $target = $subRest | Where-Object { -not $_.StartsWith('--') -and $_ -ne $engagementDir } | Select-Object -First 1
                    Add-PlaygroundEngagementScopeTarget -Engagement $engagement -Target $target
                }
                'list' { Show-PlaygroundEngagementScope -Engagement $engagement }
                default { throw "Unknown scope subcommand: $subCommand (expected init, add, or list)" }
            }
        }

        default {
            # Every non-scope command follows: <command> <positional> [--flags]
            $target = $Rest[0]
            $flags = @(if ($Rest.Count -gt 1) { $Rest[1..($Rest.Count - 1)] } else { @() })

            $engagementDir = Get-FlagValue -Tokens $flags -Name 'engagement' -Default '.playground'
            $asJson = Test-FlagSwitch -Tokens $flags -Name 'json'
            $noInteractive = Test-FlagSwitch -Tokens $flags -Name 'no-interactive'
            $engagement = New-PlaygroundEngagement -Root $engagementDir
            $interactive = Test-PlaygroundInteractive -NoInteractive:$noInteractive -AsJson:$asJson

            switch ($Command) {
                'scan' {
                    $portsRaw = Get-FlagValue -Tokens $flags -Name 'ports'
                    $params = @{
                        Engagement     = $engagement
                        TargetHost     = $target
                        TimeoutSeconds = [double](Get-FlagValue -Tokens $flags -Name 'timeout' -Default '0.5')
                        Workers        = [int](Get-FlagValue -Tokens $flags -Name 'workers' -Default '10')
                        Delay          = [double](Get-FlagValue -Tokens $flags -Name 'delay' -Default '0.0')
                        AsJson         = $asJson
                    }
                    if ($portsRaw) { $params.Port = @($portsRaw -split ',' | ForEach-Object { [int]$_ }) }
                    if (Test-FlagSwitch -Tokens $flags -Name 'banners') { $params.GrabBanner = $true }
                    $results = @(Invoke-ScanAction @params)
                    if ($interactive) { Show-PlaygroundScanDrillDown -Engagement $engagement -TargetHost $target -Results $results -AsJson:$asJson }
                }
                'discover' {
                    $results = @(Invoke-DiscoverAction -Engagement $engagement -Cidr $target `
                        -TimeoutMs ([int](Get-FlagValue -Tokens $flags -Name 'timeout-ms' -Default '1000')) `
                        -Workers ([int](Get-FlagValue -Tokens $flags -Name 'workers' -Default '8')) `
                        -Delay ([double](Get-FlagValue -Tokens $flags -Name 'delay' -Default '0.0')) `
                        -AsJson:$asJson)
                    if ($interactive) { Show-PlaygroundDiscoverDrillDown -Engagement $engagement -DiscoveredHosts $results -AsJson:$asJson }
                }
                'subdomains' {
                    $wordlist = Get-Wordlist -Path (Get-FlagValue -Tokens $flags -Name 'wordlist')
                    $params = @{
                        Engagement = $engagement
                        Domain     = $target
                        Workers    = [int](Get-FlagValue -Tokens $flags -Name 'workers' -Default '8')
                        Delay      = [double](Get-FlagValue -Tokens $flags -Name 'delay' -Default '0.0')
                        AsJson     = $asJson
                    }
                    if ($wordlist) { $params.Wordlist = $wordlist }
                    $results = @(Invoke-SubdomainsAction @params)
                    if ($interactive) { Show-PlaygroundSubdomainsDrillDown -Engagement $engagement -Results $results -AsJson:$asJson }
                }
                'headers' {
                    Invoke-HeadersAction -Engagement $engagement -Uri $target -AsJson:$asJson | Out-Null
                    if ($interactive) { Show-PlaygroundUrlDrillDown -Engagement $engagement -Uri $target -AsJson:$asJson }
                }
                'fingerprint' {
                    Invoke-FingerprintAction -Engagement $engagement -Uri $target -AsJson:$asJson | Out-Null
                    if ($interactive) { Show-PlaygroundUrlDrillDown -Engagement $engagement -Uri $target -AsJson:$asJson }
                }
                'fuzz' {
                    $wordlist = Get-Wordlist -Path (Get-FlagValue -Tokens $flags -Name 'wordlist')
                    $params = @{
                        Engagement = $engagement
                        Uri        = $target
                        Workers    = [int](Get-FlagValue -Tokens $flags -Name 'workers' -Default '3')
                        Delay      = [double](Get-FlagValue -Tokens $flags -Name 'delay' -Default '0.3')
                        AsJson     = $asJson
                    }
                    if ($wordlist) { $params.Wordlist = $wordlist }
                    $results = @(Invoke-FuzzAction @params)
                    if ($interactive) { Show-PlaygroundFuzzDrillDown -Engagement $engagement -Results $results -AsJson:$asJson }
                }
                'crawl' {
                    $results = @(Invoke-CrawlAction -Engagement $engagement -Uri $target `
                        -MaxPages ([int](Get-FlagValue -Tokens $flags -Name 'max-pages' -Default '25')) `
                        -Delay ([double](Get-FlagValue -Tokens $flags -Name 'delay' -Default '0.2')) `
                        -AsJson:$asJson)
                    if ($interactive) { Show-PlaygroundCrawlDrillDown -Engagement $engagement -Pages $results -AsJson:$asJson }
                }
                'map' {
                    Invoke-MapAction -Engagement $engagement -Uri $target -AsJson:$asJson | Out-Null
                    if ($interactive) { Show-PlaygroundUrlDrillDown -Engagement $engagement -Uri $target -AsJson:$asJson }
                }
                'recon' {
                    Invoke-ReconPipeline -Engagement $engagement -Domain $target -AsJson:$asJson
                }
                'webrecon' {
                    Invoke-WebReconPipeline -Engagement $engagement -Uri $target -AsJson:$asJson
                }
                default {
                    throw "Unknown command: $Command (expected scan, discover, subdomains, headers, fingerprint, fuzz, crawl, map, recon, webrecon, or scope)"
                }
            }
        }
    }
} catch {
    # Includes PlaygroundScopeViolation -- its type isn't visible here as a
    # literal (classes dot-sourced inside a module aren't exported the way
    # functions are), so all failures are handled the same way: report and
    # exit non-zero.
    Write-Error "error: $($_.Exception.Message)"
    $exitCode = 1
}

exit $exitCode
