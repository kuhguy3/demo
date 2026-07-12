<#
.SYNOPSIS
    security playground (PowerShell edition) - authorized recon & web-testing toolkit.

.DESCRIPTION
    A single-file Windows PowerShell 5.1 port of the "security playground" toolkit:
    threaded-via-background-jobs recon (port scan, ping sweep, subdomain enum) and
    web testing (headers, fingerprint, entry-point mapping, fuzzing, crawling), all
    routed through an engagement workspace that enforces scope, keeps an audit log,
    and accumulates findings into a Markdown report.

    Only run these tools against systems you own or are explicitly authorized to test.

.PARAMETER Action
    Which tool/command to run. One of:
    scan, discover, subdomains, headers, fingerprint, fuzz, crawl, map,
    recon, webrecon, scope-init, scope-add, scope-list
    If omitted, an interactive menu is shown instead.

.PARAMETER Target
    The target for the action: a host (scan), CIDR (discover), domain (subdomains,
    recon, scope-add), or URL (headers, fingerprint, fuzz, crawl, map, webrecon).

.PARAMETER Ports
    Comma-separated port list for -Action scan, e.g. "22,80,443". Defaults to a
    common-services list if omitted.

.PARAMETER Timeout
    Per-probe timeout in seconds. Default varies by action (0.5 for scan, 1.0 for
    discover, 10.0 for HTTP-based tools).

.PARAMETER Workers
    Max concurrent background jobs. Default varies by action.

.PARAMETER Delay
    Base pacing delay (seconds) between probes; each probe additionally sleeps a
    random jitter in [0, Delay) on top of this, to keep traffic quiet rather than
    bursty.

.PARAMETER Banners
    For -Action scan: attempt banner grabbing on open ports.

.PARAMETER Wordlist
    Path to a newline-delimited wordlist file, used by subdomains/fuzz.

.PARAMETER MaxPages
    For -Action crawl: max pages to visit. Default 25.

.PARAMETER EngagementDir
    Engagement workspace directory (scope.json / audit.log / findings.json /
    report.md). Default: .\.playground

.PARAMETER Json
    Print machine-readable JSON instead of formatted text.

.PARAMETER NoInteractive
    Skip the post-run drill-down menu.

.PARAMETER Help
    Show this help text and exit.

.EXAMPLE
    .\playground.ps1 -Action scan -Target 127.0.0.1 -Ports 22,80,443 -Banners

.EXAMPLE
    .\playground.ps1 -Action scope-init -EngagementDir .\engagements\acme
    .\playground.ps1 -Action scope-add -Target example.com -EngagementDir .\engagements\acme
    .\playground.ps1 -Action scan -Target 10.0.0.5 -EngagementDir .\engagements\acme

.EXAMPLE
    .\playground.ps1
    (no -Action -> interactive menu)
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet(
        'scan', 'discover', 'subdomains', 'headers', 'fingerprint', 'fuzz', 'crawl', 'map',
        'recon', 'webrecon', 'scope-init', 'scope-add', 'scope-list'
    )]
    [string]$Action,

    [string]$Target,
    [string]$Ports,
    [double]$Timeout,
    [int]$Workers,
    [double]$Delay,
    [switch]$Banners,
    [string]$Wordlist,
    [int]$MaxPages,
    [string]$EngagementDir = ".\.playground",
    [switch]$Json,
    [switch]$NoInteractive,
    [switch]$Help
)

# Force modern TLS for HTTPS targets on older Windows/.NET defaults.
try {
    [System.Net.ServicePointManager]::SecurityProtocol = `
        [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12
} catch { }

$script:Disclaimer = "Only run these tools against systems you own or are explicitly authorized to test."
$script:UserAgent = "playground-recon/1.0"

# ---------------------------------------------------------------------------
# Defaults / wordlists
# ---------------------------------------------------------------------------

$script:CommonPorts = @(21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 8080, 8443)

$script:DefaultSubdomains = @(
    "www", "mail", "ftp", "api", "dev", "staging", "test", "admin",
    "portal", "vpn", "remote", "webmail", "ns1", "ns2", "smtp", "cpanel",
    "blog", "shop", "m", "app", "cdn", "static", "beta", "internal"
)

$script:DefaultFuzzWords = @(
    "admin", "login", "api", "backup", "config", "dashboard", "debug", "test",
    ".env", "robots.txt", "sitemap.xml", ".git/HEAD", "uploads", "wp-admin"
)

$script:SecurityHeaders = @(
    "Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options",
    "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"
)

$script:HeaderHints = @(
    @{ Header = "Server";        Needle = "nginx";         Tech = "nginx" },
    @{ Header = "Server";        Needle = "apache";        Tech = "Apache" },
    @{ Header = "Server";        Needle = "cloudflare";    Tech = "Cloudflare" },
    @{ Header = "Server";        Needle = "microsoft-iis"; Tech = "IIS" },
    @{ Header = "X-Powered-By";  Needle = "php";           Tech = "PHP" },
    @{ Header = "X-Powered-By";  Needle = "asp.net";       Tech = "ASP.NET" },
    @{ Header = "X-Powered-By";  Needle = "express";       Tech = "Express/Node.js" }
)

$script:CookieHints = @(
    @{ Needle = "phpsessid";        Tech = "PHP" },
    @{ Needle = "jsessionid";       Tech = "Java/JSP" },
    @{ Needle = "asp.net_sessionid"; Tech = "ASP.NET" },
    @{ Needle = "laravel_session";  Tech = "Laravel" },
    @{ Needle = "django";           Tech = "Django" },
    @{ Needle = "_rails";           Tech = "Ruby on Rails" }
)

$script:WebPorts = @(80, 443, 8080, 8443)

# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------

function Get-NowIso {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
}

function ConvertTo-HostOnly {
    param([string]$TargetStr)
    if ($TargetStr -match '^[a-zA-Z][a-zA-Z0-9+.-]*://') {
        try { return ([uri]$TargetStr).Host } catch { return $TargetStr }
    }
    $noPort = $TargetStr.Split('/')[0]
    $noPort = $noPort.Split(':')[0]
    return $noPort
}

function ConvertTo-WebUrl {
    param([string]$TargetHost, [int]$Port)
    $scheme = "http"
    if ($Port -eq 443 -or $Port -eq 8443) { $scheme = "https" }
    if ($Port -eq 80 -or $Port -eq 443) { return "$scheme`://$TargetHost" }
    return "$scheme`://$TargetHost`:$Port"
}

function Import-WordList {
    param([string]$Path)
    if (-not $Path) { return $null }
    if (-not (Test-Path $Path)) {
        Write-Error "Wordlist file not found: $Path"
        exit 1
    }
    $lines = Get-Content -Path $Path | Where-Object { $_.Trim() -ne "" } | ForEach-Object { $_.Trim() }
    return @($lines)
}

function Write-Emit {
    param($Data, [string]$Summary, [bool]$AsJson)
    if ($AsJson) {
        $Data | ConvertTo-Json -Depth 10
    } else {
        Write-Host $Summary
    }
}

function Test-IsInteractive {
    param([bool]$NoInteractiveFlag, [bool]$AsJsonFlag)
    if ($NoInteractiveFlag -or $AsJsonFlag) { return $false }
    try {
        return (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected)
    } catch {
        return $false
    }
}

function Show-Menu {
    param([string]$Title, [string[]]$Options)
    Write-Host ""
    Write-Host $Title
    for ($i = 0; $i -lt $Options.Count; $i++) {
        Write-Host "  $($i + 1)) $($Options[$i])"
    }
    Write-Host "  0) done"
    $choice = Read-Host ">"
    if ([string]::IsNullOrWhiteSpace($choice) -or $choice -eq "0") { return $null }
    if ($choice -notmatch '^\d+$') { return $null }
    $idx = [int]$choice
    if ($idx -ge 1 -and $idx -le $Options.Count) { return ($idx - 1) }
    return $null
}

# ---------------------------------------------------------------------------
# Scope: restrict tools to explicitly authorized targets.
#
# If no scope file exists, scope is unenforced (matches original behavior).
# Once a scope file exists -- even an empty one -- enforcement is fail-closed:
# only listed targets (host/domain suffix, exact IP, or CIDR) are authorized.
# ---------------------------------------------------------------------------

function New-EmptyScope {
    return [PSCustomObject]@{ Entries = @(); Enforced = $false }
}

function Import-Scope {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return New-EmptyScope }
    $raw = Get-Content -Path $Path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) { return [PSCustomObject]@{ Entries = @(); Enforced = $true } }
    $data = $raw | ConvertFrom-Json
    $entries = @()
    if ($null -ne $data.authorized) { $entries = @($data.authorized) }
    return [PSCustomObject]@{ Entries = $entries; Enforced = $true }
}

function Save-Scope {
    param($Scope, [string]$Path)
    $dir = Split-Path -Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $obj = [PSCustomObject]@{ authorized = @($Scope.Entries) }
    ($obj | ConvertTo-Json) | Set-Content -Path $Path
    $Scope.Enforced = $true
}

function Add-ScopeTarget {
    param($Scope, [string]$TargetStr)
    if ($Scope.Entries -notcontains $TargetStr) {
        $Scope.Entries = @($Scope.Entries) + $TargetStr
    }
    return $Scope
}

function Test-IpInCidr {
    param([string]$IPAddress, [string]$Cidr)
    try {
        $parts = $Cidr -split '/'
        if ($parts.Count -ne 2) { return $false }
        $networkIp = [System.Net.IPAddress]::Parse($parts[0])
        $prefixLen = [int]$parts[1]
        $ip = [System.Net.IPAddress]::Parse($IPAddress)
        if ($ip.AddressFamily -ne $networkIp.AddressFamily) { return $false }

        $ipBytes = $ip.GetAddressBytes()
        $netBytes = $networkIp.GetAddressBytes()
        $totalBits = $ipBytes.Length * 8
        if ($prefixLen -lt 0 -or $prefixLen -gt $totalBits) { return $false }

        $fullBytes = [math]::Floor($prefixLen / 8)
        $remainderBits = $prefixLen % 8

        for ($i = 0; $i -lt $fullBytes; $i++) {
            if ($ipBytes[$i] -ne $netBytes[$i]) { return $false }
        }
        if ($remainderBits -gt 0) {
            $mask = (0xFF -shl (8 - $remainderBits)) -band 0xFF
            if (($ipBytes[$fullBytes] -band $mask) -ne ($netBytes[$fullBytes] -band $mask)) { return $false }
        }
        return $true
    } catch {
        return $false
    }
}

function Test-ScopeEntryMatch {
    param([string]$HostName, [string]$Entry)
    $entryHost = ConvertTo-HostOnly $Entry

    $ipParsed = $null
    try { $ipParsed = [System.Net.IPAddress]::Parse($HostName) } catch { $ipParsed = $null }

    if ($null -ne $ipParsed) {
        if ($Entry -match '/') {
            return Test-IpInCidr -IPAddress $HostName -Cidr $Entry
        }
        try {
            [void][System.Net.IPAddress]::Parse($entryHost)
            return $HostName -eq $entryHost
        } catch {
            return $false
        }
    }

    if ($HostName -eq $entryHost) { return $true }
    if ($HostName.EndsWith("." + $entryHost)) { return $true }
    return $false
}

function Test-Authorized {
    param($Scope, [string]$TargetStr)
    if (-not $Scope.Enforced) { return $true }
    $h = ConvertTo-HostOnly $TargetStr
    foreach ($entry in $Scope.Entries) {
        if (Test-ScopeEntryMatch -HostName $h -Entry $entry) { return $true }
    }
    return $false
}

function Assert-Authorized {
    param($Engagement, [string]$TargetStr)
    if (-not (Test-Authorized -Scope $Engagement.Scope -TargetStr $TargetStr)) {
        Write-Host "error: '$TargetStr' is not authorized in this engagement's scope ($($Engagement.ScopePath)). Run '-Action scope-add -Target $TargetStr -EngagementDir $($Engagement.Root)' to authorize it first." -ForegroundColor Red
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Engagement workspace: scope + audit log + findings/report.
# ---------------------------------------------------------------------------

function Initialize-Engagement {
    param([string]$Root)
    if (-not (Test-Path $Root)) { New-Item -ItemType Directory -Path $Root -Force | Out-Null }
    $scopePath = Join-Path $Root "scope.json"
    $auditPath = Join-Path $Root "audit.log"
    $findingsPath = Join-Path $Root "findings.json"
    $reportPath = Join-Path $Root "report.md"
    $scope = Import-Scope -Path $scopePath
    return [PSCustomObject]@{
        Root         = $Root
        ScopePath    = $scopePath
        AuditPath    = $auditPath
        FindingsPath = $findingsPath
        ReportPath   = $reportPath
        Scope        = $scope
    }
}

function Write-Audit {
    param($Engagement, [string]$Command, $Args)
    $entry = [PSCustomObject]@{ timestamp = (Get-NowIso); command = $Command; args = $Args }
    ($entry | ConvertTo-Json -Compress -Depth 10) | Add-Content -Path $Engagement.AuditPath
}

function Get-Findings {
    param($Engagement)
    if (Test-Path $Engagement.FindingsPath) {
        $raw = Get-Content -Path $Engagement.FindingsPath -Raw
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            $parsed = $raw | ConvertFrom-Json
            return @($parsed)
        }
    }
    return @()
}

function New-MarkdownReport {
    param([array]$Findings)
    $lines = @("# Engagement Report", "", "Total findings recorded: $($Findings.Count)", "")

    $byTarget = [ordered]@{}
    foreach ($f in $Findings) {
        if (-not $byTarget.Contains($f.target)) { $byTarget[$f.target] = @() }
        $byTarget[$f.target] += , $f
    }

    foreach ($t in ($byTarget.Keys | Sort-Object)) {
        $lines += "## $t"
        $lines += ""
        foreach ($f in $byTarget[$t]) {
            $lines += "### $($f.tool) - $($f.timestamp)"
            $lines += ""
            $lines += '```'
            $lines += $f.summary
            $lines += '```'
            $lines += ""
        }
    }

    return ($lines -join "`n")
}

function Add-Finding {
    param($Engagement, [string]$Tool, [string]$TargetStr, $Data, [string]$Summary)
    $findings = @(Get-Findings -Engagement $Engagement)
    $entry = [PSCustomObject]@{
        timestamp = (Get-NowIso)
        tool      = $Tool
        target    = $TargetStr
        data      = $Data
        summary   = $Summary
    }
    $findings += , $entry
    ($findings | ConvertTo-Json -Depth 12) | Set-Content -Path $Engagement.FindingsPath
    $report = New-MarkdownReport -Findings $findings
    Set-Content -Path $Engagement.ReportPath -Value $report
}

# ---------------------------------------------------------------------------
# Recon: TCP connect port scanner (background-job concurrency).
# ---------------------------------------------------------------------------

$script:PortWorkerInit = {
    function Test-PortWorker {
        param($TargetHost, $Port, $TimeoutMs, $GrabBanner, $DelayMs)
        if ($DelayMs -gt 0) {
            $jitter = Get-Random -Minimum 0 -Maximum ([math]::Max(1, $DelayMs))
            Start-Sleep -Milliseconds ($DelayMs + $jitter)
        }
        $res = [PSCustomObject]@{ Port = $Port; Open = $false; Banner = $null }
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $iar = $tcp.BeginConnect($TargetHost, $Port, $null, $null)
            $ok = $iar.AsyncWaitHandle.WaitOne([int]$TimeoutMs)
            if ($ok -and $tcp.Connected) {
                $res.Open = $true
                if ($GrabBanner) {
                    try {
                        $stream = $tcp.GetStream()
                        $stream.ReadTimeout = [int]$TimeoutMs
                        $buf = New-Object byte[] 128
                        $read = $stream.Read($buf, 0, $buf.Length)
                        if ($read -gt 0) {
                            $res.Banner = [System.Text.Encoding]::ASCII.GetString($buf, 0, $read).Trim()
                        }
                    } catch { }
                }
            }
            $tcp.Close()
        } catch { }
        return $res
    }
}

function Invoke-PortScan {
    param([string]$TargetHost, $PortList, [double]$TimeoutSec = 0.5, [int]$MaxWorkers = 10, [double]$DelaySec = 0.0, [bool]$GrabBanners = $false)
    if (-not $PortList) { $PortList = $script:CommonPorts }
    $timeoutMs = [int]($TimeoutSec * 1000)
    $delayMs = [int]($DelaySec * 1000)

    $jobs = @()
    foreach ($p in $PortList) {
        while (@(Get-Job -State Running).Count -ge $MaxWorkers) { Start-Sleep -Milliseconds 50 }
        $jobs += Start-Job -InitializationScript $script:PortWorkerInit -ScriptBlock {
            param($h, $pt, $to, $gb, $dm)
            Test-PortWorker -TargetHost $h -Port $pt -TimeoutMs $to -GrabBanner $gb -DelayMs $dm
        } -ArgumentList $TargetHost, $p, $timeoutMs, $GrabBanners, $delayMs
    }
    if ($jobs.Count -gt 0) { $null = Wait-Job -Job $jobs }
    $results = @()
    foreach ($j in $jobs) {
        $results += Receive-Job -Job $j
        Remove-Job -Job $j
    }
    return @($results | Sort-Object Port)
}

function Format-ScanResults {
    param([string]$TargetHost, [array]$Results)
    $lines = @("Scan results for $TargetHost`:")
    $openResults = @($Results | Where-Object { $_.Open })
    if ($openResults.Count -eq 0) {
        $lines += "  no open ports found"
    }
    foreach ($r in $openResults) {
        $b = ""
        if ($r.Banner) { $b = " ($($r.Banner))" }
        $lines += "  $($r.Port)/tcp open$b"
    }
    return ($lines -join "`n")
}

# ---------------------------------------------------------------------------
# Recon: ICMP ping sweep over a CIDR (background-job concurrency).
# ---------------------------------------------------------------------------

function ConvertFrom-UInt32ToIP {
    param([uint32]$UintVal)
    $bytes = [BitConverter]::GetBytes($UintVal)
    [Array]::Reverse($bytes)
    return ([System.Net.IPAddress]$bytes).ToString()
}

function Get-HostsInCidr {
    param([string]$Cidr)
    $parts = $Cidr -split '/'
    if ($parts.Count -ne 2) { throw "Invalid CIDR: $Cidr" }
    $ip = [System.Net.IPAddress]::Parse($parts[0])
    if ($ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
        throw "Only IPv4 CIDRs are supported: $Cidr"
    }
    $prefix = [int]$parts[1]

    # Do all the bit math in [int64] to sidestep uint32 shift/NOT type-promotion
    # pitfalls in PowerShell; mask everything back to 32 bits with -band 0xFFFFFFFF.
    $allOnes = [int64]4294967295

    $ipBytes = $ip.GetAddressBytes()
    [Array]::Reverse($ipBytes)
    $ipVal = [int64]([BitConverter]::ToUInt32($ipBytes, 0))

    if ($prefix -le 0) {
        $maskVal = [int64]0
    } else {
        $maskVal = ($allOnes -shl (32 - $prefix)) -band $allOnes
    }
    $networkVal = $ipVal -band $maskVal
    $inverseMaskVal = $maskVal -bxor $allOnes
    $broadcastVal = ($networkVal -bor $inverseMaskVal) -band $allOnes

    $hosts = @()
    if ($prefix -ge 31) {
        for ($cur = $networkVal; $cur -le $broadcastVal; $cur++) {
            $hosts += ConvertFrom-UInt32ToIP -UintVal ([uint32]$cur)
        }
    } else {
        for ($cur = ($networkVal + 1); $cur -lt $broadcastVal; $cur++) {
            $hosts += ConvertFrom-UInt32ToIP -UintVal ([uint32]$cur)
        }
    }
    return $hosts
}

$script:PingWorkerInit = {
    function Test-HostAliveWorker {
        param($TargetHost, $TimeoutMs, $DelayMs)
        if ($DelayMs -gt 0) {
            $jitter = Get-Random -Minimum 0 -Maximum ([math]::Max(1, $DelayMs))
            Start-Sleep -Milliseconds ($DelayMs + $jitter)
        }
        try {
            $ping = New-Object System.Net.NetworkInformation.Ping
            $reply = $ping.Send($TargetHost, [int]$TimeoutMs)
            return ($reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success)
        } catch {
            return $false
        }
    }
}

function Invoke-HostDiscovery {
    param([string]$Cidr, [double]$TimeoutSec = 1.0, [int]$MaxWorkers = 8, [double]$DelaySec = 0.0)
    $hosts = Get-HostsInCidr -Cidr $Cidr
    $timeoutMs = [int]([math]::Max($TimeoutSec, 0.1) * 1000)
    $delayMs = [int]($DelaySec * 1000)

    $jobs = @()
    foreach ($h in $hosts) {
        while (@(Get-Job -State Running).Count -ge $MaxWorkers) { Start-Sleep -Milliseconds 50 }
        $jobs += Start-Job -InitializationScript $script:PingWorkerInit -ScriptBlock {
            param($hh, $to, $dm)
            [PSCustomObject]@{ HostAddr = $hh; Alive = (Test-HostAliveWorker -TargetHost $hh -TimeoutMs $to -DelayMs $dm) }
        } -ArgumentList $h, $timeoutMs, $delayMs
    }
    if ($jobs.Count -gt 0) { $null = Wait-Job -Job $jobs }
    $alive = @()
    foreach ($j in $jobs) {
        $r = Receive-Job -Job $j
        if ($r.Alive) { $alive += $r.HostAddr }
        Remove-Job -Job $j
    }
    return @($alive | Sort-Object -Property @{ Expression = { ConvertTo-IPSortKey -IPAddress $_ } })
}

function ConvertTo-IPSortKey {
    param([string]$IPAddress)
    $bytes = ([System.Net.IPAddress]$IPAddress).GetAddressBytes()
    [Array]::Reverse($bytes)
    return [BitConverter]::ToUInt32($bytes, 0)
}

function Format-DiscoverResults {
    param([string]$Cidr, [array]$Alive)
    $lines = @("Live hosts in $Cidr`:")
    if ($Alive.Count -eq 0) {
        $lines += "  none responded"
    } else {
        foreach ($h in $Alive) { $lines += "  $h" }
    }
    return ($lines -join "`n")
}

# ---------------------------------------------------------------------------
# Recon: DNS-based subdomain enumeration (background-job concurrency).
# ---------------------------------------------------------------------------

$script:DnsWorkerInit = {
    function Resolve-SubdomainWorker {
        param($Word, $Domain, $DelayMs)
        if ($DelayMs -gt 0) {
            $jitter = Get-Random -Minimum 0 -Maximum ([math]::Max(1, $DelayMs))
            Start-Sleep -Milliseconds ($DelayMs + $jitter)
        }
        $h = "$Word.$Domain"
        try {
            $addrs = [System.Net.Dns]::GetHostAddresses($h)
            if ($addrs -and $addrs.Count -gt 0) {
                return [PSCustomObject]@{ HostName = $h; IP = $addrs[0].ToString() }
            }
        } catch { }
        return $null
    }
}

function Invoke-SubdomainEnum {
    param([string]$Domain, $Words, [int]$MaxWorkers = 8, [double]$DelaySec = 0.0)
    if (-not $Words) { $Words = $script:DefaultSubdomains }
    $delayMs = [int]($DelaySec * 1000)

    $jobs = @()
    foreach ($w in $Words) {
        while (@(Get-Job -State Running).Count -ge $MaxWorkers) { Start-Sleep -Milliseconds 50 }
        $jobs += Start-Job -InitializationScript $script:DnsWorkerInit -ScriptBlock {
            param($ww, $dd, $dm)
            Resolve-SubdomainWorker -Word $ww -Domain $dd -DelayMs $dm
        } -ArgumentList $w, $Domain, $delayMs
    }
    if ($jobs.Count -gt 0) { $null = Wait-Job -Job $jobs }
    $found = @()
    foreach ($j in $jobs) {
        $r = Receive-Job -Job $j
        if ($r) { $found += , $r }
        Remove-Job -Job $j
    }
    return @($found | Sort-Object HostName)
}

function Format-SubdomainResults {
    param([string]$Domain, [array]$Results)
    $lines = @("Subdomains of $Domain`:")
    if ($Results.Count -eq 0) {
        $lines += "  none found"
    } else {
        foreach ($r in $Results) { $lines += "  $($r.HostName) -> $($r.IP)" }
    }
    return ($lines -join "`n")
}

# ---------------------------------------------------------------------------
# Shared HTTP helper: manual redirect-following HttpWebRequest wrapper.
# Gives every web tool consistent status/headers/cookies/redirect-chain/timing
# without depending on Invoke-WebRequest's IE-based HTML parsing engine.
# ---------------------------------------------------------------------------

function Invoke-TrackedRequest {
    param(
        [string]$Url,
        [double]$TimeoutSec = 10.0,
        [string]$Method = "GET",
        [bool]$AllowRedirects = $true,
        [bool]$IncludeBody = $false,
        [int]$MaxRedirects = 10
    )
    $cookieContainer = New-Object System.Net.CookieContainer
    $redirectChain = @()
    $currentUrl = $Url
    $timeoutMs = [int]([math]::Max($TimeoutSec, 0.1) * 1000)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()

    $finalResponse = $null
    for ($i = 0; $i -le $MaxRedirects; $i++) {
        $req = [System.Net.HttpWebRequest]::Create($currentUrl)
        $req.Method = $Method
        $req.Timeout = $timeoutMs
        $req.AllowAutoRedirect = $false
        $req.CookieContainer = $cookieContainer
        $req.UserAgent = $script:UserAgent

        $resp = $null
        try {
            $resp = $req.GetResponse()
        } catch [System.Net.WebException] {
            if ($_.Exception.Response) {
                $resp = $_.Exception.Response
            } else {
                $sw.Stop()
                return [PSCustomObject]@{
                    Url            = $currentUrl
                    StatusCode     = $null
                    ElapsedMs      = $sw.Elapsed.TotalMilliseconds
                    Headers        = @{}
                    Cookies        = @{}
                    RedirectChain  = $redirectChain
                    Body           = $null
                    Error          = $_.Exception.Message
                }
            }
        }

        $status = [int]$resp.StatusCode
        $location = $resp.Headers["Location"]
        if ($AllowRedirects -and $status -ge 300 -and $status -lt 400 -and $location) {
            $redirectChain += $currentUrl
            try {
                $currentUrl = (New-Object System.Uri((New-Object System.Uri($currentUrl)), $location)).AbsoluteUri
            } catch {
                $currentUrl = $location
            }
            $resp.Close()
            continue
        } else {
            $finalResponse = $resp
            break
        }
    }
    $sw.Stop()

    if (-not $finalResponse) {
        return [PSCustomObject]@{
            Url = $currentUrl; StatusCode = $null; ElapsedMs = $sw.Elapsed.TotalMilliseconds
            Headers = @{}; Cookies = @{}; RedirectChain = $redirectChain; Body = $null; Error = "no response"
        }
    }

    $headers = [ordered]@{}
    foreach ($key in $finalResponse.Headers.AllKeys) { $headers[$key] = $finalResponse.Headers[$key] }

    $cookies = [ordered]@{}
    try {
        $finalUri = New-Object System.Uri($finalResponse.ResponseUri)
        foreach ($c in $cookieContainer.GetCookies($finalUri)) { $cookies[$c.Name] = $c.Value }
    } catch { }

    $body = $null
    if ($IncludeBody) {
        try {
            $stream = $finalResponse.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            $reader.Close()
        } catch { $body = "" }
    }

    $finalUrlStr = $finalResponse.ResponseUri.AbsoluteUri
    $statusCode = [int]$finalResponse.StatusCode
    $finalResponse.Close()

    return [PSCustomObject]@{
        Url           = $finalUrlStr
        StatusCode    = $statusCode
        ElapsedMs     = $sw.Elapsed.TotalMilliseconds
        Headers       = $headers
        Cookies       = $cookies
        RedirectChain = $redirectChain
        Body          = $body
        Error         = $null
    }
}

# ---------------------------------------------------------------------------
# Web testing: headers/cookies/redirect inspector
# ---------------------------------------------------------------------------

function Invoke-Inspector {
    param([string]$Url, [double]$TimeoutSec = 10.0)
    return Invoke-TrackedRequest -Url $Url -TimeoutSec $TimeoutSec -Method "GET" -AllowRedirects $true -IncludeBody $false
}

function Format-InspectResult {
    param($Result)
    $lines = @()
    if ($Result.Error) {
        $lines += "ERROR requesting $($Result.Url): $($Result.Error)"
        return ($lines -join "`n")
    }
    $lines += "$($Result.StatusCode) $($Result.Url)  ($([math]::Round($Result.ElapsedMs)) ms)"
    if ($Result.RedirectChain.Count -gt 0) {
        $chain = @($Result.RedirectChain) + @($Result.Url)
        $lines += "Redirects: " + ($chain -join " -> ")
    }
    $lines += "Headers:"
    foreach ($key in $Result.Headers.Keys) { $lines += "  $key`: $($Result.Headers[$key])" }
    if ($Result.Cookies.Count -gt 0) {
        $lines += "Cookies:"
        foreach ($key in $Result.Cookies.Keys) { $lines += "  $key=$($Result.Cookies[$key])" }
    }
    return ($lines -join "`n")
}

# ---------------------------------------------------------------------------
# Web testing: passive technology fingerprint + missing security headers
# ---------------------------------------------------------------------------

function Invoke-Fingerprint {
    param([string]$Url, [double]$TimeoutSec = 10.0)
    $resp = Invoke-TrackedRequest -Url $Url -TimeoutSec $TimeoutSec -Method "GET" -AllowRedirects $true -IncludeBody $false
    if ($resp.Error) {
        return [PSCustomObject]@{ Url = $Url; Technologies = @(); MissingSecurityHeaders = @(); CookiesSeen = @(); Error = $resp.Error }
    }

    $technologies = New-Object System.Collections.Generic.HashSet[string]
    foreach ($hint in $script:HeaderHints) {
        $value = ""
        if ($resp.Headers.Contains($hint.Header)) { $value = ([string]$resp.Headers[$hint.Header]).ToLower() }
        if ($value -and $value.Contains($hint.Needle)) { [void]$technologies.Add($hint.Tech) }
    }

    $cookieNames = @($resp.Cookies.Keys)
    foreach ($name in $cookieNames) {
        foreach ($hint in $script:CookieHints) {
            if ($name.ToLower().Contains($hint.Needle)) { [void]$technologies.Add($hint.Tech) }
        }
    }

    $missing = @()
    foreach ($h in $script:SecurityHeaders) {
        if (-not $resp.Headers.Contains($h)) { $missing += $h }
    }

    return [PSCustomObject]@{
        Url                     = $resp.Url
        Technologies            = @($technologies | Sort-Object)
        MissingSecurityHeaders  = $missing
        CookiesSeen             = $cookieNames
        Error                   = $null
    }
}

function Format-FingerprintResult {
    param($Result)
    $lines = @("Fingerprint for $($Result.Url):")
    if ($Result.Error) {
        $lines += "  ERROR: $($Result.Error)"
        return ($lines -join "`n")
    }
    $techStr = "none detected"
    if ($Result.Technologies.Count -gt 0) { $techStr = ($Result.Technologies -join ", ") }
    $lines += "Technologies: $techStr"
    if ($Result.CookiesSeen.Count -gt 0) {
        $lines += "Cookies seen: " + ($Result.CookiesSeen -join ", ")
    }
    $lines += "Missing security headers:"
    if ($Result.MissingSecurityHeaders.Count -gt 0) {
        foreach ($h in $Result.MissingSecurityHeaders) { $lines += "  $h" }
    } else {
        $lines += "  none - all checked headers present"
    }
    return ($lines -join "`n")
}

# ---------------------------------------------------------------------------
# Web testing: entry-point mapping (forms + robots.txt/sitemap.xml).
# Uses lightweight regex parsing rather than a full HTML parser -- fine for
# well-formed pages, but (unlike BeautifulSoup) may miss malformed markup.
# ---------------------------------------------------------------------------

function Get-Forms {
    param([string]$Url, [double]$TimeoutSec = 10.0)
    $resp = Invoke-TrackedRequest -Url $Url -TimeoutSec $TimeoutSec -Method "GET" -AllowRedirects $true -IncludeBody $true
    $forms = @()
    if ($resp.Error -or -not $resp.Body) { return $forms }

    $formMatches = [regex]::Matches($resp.Body, '<form\b[^>]*>(.*?)</form>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Singleline)
    foreach ($m in $formMatches) {
        $openTag = [regex]::Match($m.Value, '<form\b[^>]*>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase).Value

        $actionMatch = [regex]::Match($openTag, 'action\s*=\s*["'']([^"'']*)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $rawAction = ""
        if ($actionMatch.Success) { $rawAction = $actionMatch.Groups[1].Value }
        try { $action = (New-Object System.Uri((New-Object System.Uri($Url)), $rawAction)).AbsoluteUri } catch { $action = $rawAction }

        $methodMatch = [regex]::Match($openTag, 'method\s*=\s*["'']([^"'']*)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $method = "GET"
        if ($methodMatch.Success -and $methodMatch.Groups[1].Value) { $method = $methodMatch.Groups[1].Value.ToUpper() }

        $inputs = @()
        $inputMatches = [regex]::Matches($m.Groups[1].Value, '<(?:input|textarea|select)\b[^>]*\bname\s*=\s*["'']([^"'']*)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        foreach ($im in $inputMatches) {
            if ($im.Groups[1].Value) { $inputs += $im.Groups[1].Value }
        }

        $forms += [PSCustomObject]@{ Action = $action; Method = $method; Inputs = $inputs }
    }
    return $forms
}

function Get-HiddenContent {
    param([string]$BaseUrl, [double]$TimeoutSec = 10.0)
    $baseUrl = $BaseUrl.TrimEnd('/')
    $paths = New-Object System.Collections.Generic.HashSet[string]

    $robots = Invoke-TrackedRequest -Url "$baseUrl/robots.txt" -TimeoutSec $TimeoutSec -Method "GET" -AllowRedirects $true -IncludeBody $true
    if (-not $robots.Error -and $robots.StatusCode -eq 200 -and $robots.Body) {
        foreach ($line in ($robots.Body -split "`r?`n")) {
            $trimmed = $line.Trim()
            if ($trimmed -match '^(?i)(disallow|allow)\s*:\s*(.*)$') {
                $value = $Matches[2].Trim()
                if ($value -and $value -ne "/") { [void]$paths.Add($value) }
            }
        }
    }

    $sitemap = Invoke-TrackedRequest -Url "$baseUrl/sitemap.xml" -TimeoutSec $TimeoutSec -Method "GET" -AllowRedirects $true -IncludeBody $true
    if (-not $sitemap.Error -and $sitemap.StatusCode -eq 200 -and $sitemap.Body) {
        try {
            $xml = [xml]$sitemap.Body
            $locNodes = $xml.GetElementsByTagName("loc")
            foreach ($node in $locNodes) {
                if ($node.InnerText) { [void]$paths.Add($node.InnerText.Trim()) }
            }
        } catch { }
    }

    return @($paths | Sort-Object)
}

function Format-Forms {
    param([array]$Forms)
    if ($Forms.Count -eq 0) { return "  no forms found" }
    $lines = @()
    foreach ($f in $Forms) {
        $inputsStr = "none"
        if ($f.Inputs.Count -gt 0) { $inputsStr = ($f.Inputs -join ", ") }
        $lines += "  $($f.Method) $($f.Action)  inputs: $inputsStr"
    }
    return ($lines -join "`n")
}

# ---------------------------------------------------------------------------
# Web testing: wordlist-based path fuzzer (background-job concurrency).
# ---------------------------------------------------------------------------

$script:FuzzWorkerInit = {
    function Invoke-TrackedRequestLite {
        # Minimal single-hop, no-redirect GET for fuzzing -- avoids importing
        # the full Invoke-TrackedRequest closure into each job.
        param($TargetUrl, $TimeoutMs, $UserAgentStr)
        $req = [System.Net.HttpWebRequest]::Create($TargetUrl)
        $req.Method = "GET"
        $req.Timeout = $TimeoutMs
        $req.AllowAutoRedirect = $false
        $req.UserAgent = $UserAgentStr
        try {
            $resp = $req.GetResponse()
        } catch [System.Net.WebException] {
            if ($_.Exception.Response) { $resp = $_.Exception.Response } else { return $null }
        } catch {
            return $null
        }
        $status = [int]$resp.StatusCode
        $len = [int]$resp.ContentLength
        if ($len -lt 0) {
            try {
                $stream = $resp.GetResponseStream()
                $ms = New-Object System.IO.MemoryStream
                $stream.CopyTo($ms)
                $len = [int]$ms.Length
            } catch { $len = 0 }
        }
        $resp.Close()
        return [PSCustomObject]@{ StatusCode = $status; Length = $len }
    }

    function Invoke-FuzzWorker {
        param($BaseUrl, $Word, $TimeoutMs, $DelayMs, $UserAgentStr)
        if ($DelayMs -gt 0) {
            $jitter = Get-Random -Minimum 0 -Maximum ([math]::Max(1, $DelayMs))
            Start-Sleep -Milliseconds ($DelayMs + $jitter)
        }
        $url = "$BaseUrl/$Word"
        $result = Invoke-TrackedRequestLite -TargetUrl $url -TimeoutMs $TimeoutMs -UserAgentStr $UserAgentStr
        if ($null -eq $result) {
            return [PSCustomObject]@{ Path = $Word; Url = $url; StatusCode = $null; Length = $null }
        }
        return [PSCustomObject]@{ Path = $Word; Url = $url; StatusCode = $result.StatusCode; Length = $result.Length }
    }
}

function Invoke-Fuzzer {
    param([string]$BaseUrl, $Words, [double]$TimeoutSec = 5.0, [int]$MaxWorkers = 3, [double]$DelaySec = 0.3)
    if (-not $Words) { $Words = $script:DefaultFuzzWords }
    $baseUrl = $BaseUrl.TrimEnd('/')
    $timeoutMs = [int]([math]::Max($TimeoutSec, 0.1) * 1000)
    $delayMs = [int]($DelaySec * 1000)

    $jobs = @()
    foreach ($w in $Words) {
        while (@(Get-Job -State Running).Count -ge $MaxWorkers) { Start-Sleep -Milliseconds 50 }
        $jobs += Start-Job -InitializationScript $script:FuzzWorkerInit -ScriptBlock {
            param($bu, $ww, $to, $dm, $ua)
            Invoke-FuzzWorker -BaseUrl $bu -Word $ww -TimeoutMs $to -DelayMs $dm -UserAgentStr $ua
        } -ArgumentList $baseUrl, $w, $timeoutMs, $delayMs, $script:UserAgent
    }
    if ($jobs.Count -gt 0) { $null = Wait-Job -Job $jobs }
    $results = @()
    foreach ($j in $jobs) {
        $results += Receive-Job -Job $j
        Remove-Job -Job $j
    }
    return @($results | Sort-Object Path)
}

function Format-FuzzResults {
    param([array]$Results)
    $lines = @()
    foreach ($r in $Results) {
        if ($null -eq $r.StatusCode) {
            $lines += "  {0,-20} ERROR" -f $r.Path
        } elseif ($r.StatusCode -ne 404) {
            $lines += "  {0,-20} {1} ({2} bytes)" -f $r.Path, $r.StatusCode, $r.Length
        }
    }
    if ($lines.Count -eq 0) { return "  no interesting paths found" }
    return ($lines -join "`n")
}

# ---------------------------------------------------------------------------
# Web testing: same-domain link crawler.
# Sequential by design -- the visited-set/queue is shared BFS state, which
# doesn't parallelize cleanly across separate job processes.
# ---------------------------------------------------------------------------

function Invoke-Crawler {
    param([string]$StartUrl, [int]$MaxPages = 25, [double]$TimeoutSec = 5.0, [double]$DelaySec = 0.2)
    $domain = ([uri]$StartUrl).Host
    $visited = New-Object System.Collections.Generic.HashSet[string]
    $queue = New-Object System.Collections.Generic.Queue[string]
    $queue.Enqueue($StartUrl)
    $discovered = @()

    while ($queue.Count -gt 0 -and $visited.Count -lt $MaxPages) {
        $url = $queue.Dequeue()
        if ($visited.Contains($url)) { continue }
        [void]$visited.Add($url)

        if ($DelaySec -gt 0 -and $discovered.Count -gt 0) { Start-Sleep -Milliseconds ([int]($DelaySec * 1000)) }

        $resp = Invoke-TrackedRequest -Url $url -TimeoutSec $TimeoutSec -Method "GET" -AllowRedirects $true -IncludeBody $true
        if ($resp.Error) { continue }

        $discovered += $url
        $contentType = ""
        if ($resp.Headers.Contains("Content-Type")) { $contentType = $resp.Headers["Content-Type"] }
        if ($contentType -notmatch "text/html") { continue }
        if (-not $resp.Body) { continue }

        $linkMatches = [regex]::Matches($resp.Body, '<a\b[^>]*\bhref\s*=\s*["'']([^"'']*)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        foreach ($lm in $linkMatches) {
            $href = $lm.Groups[1].Value
            if (-not $href) { continue }
            try {
                $linkUri = New-Object System.Uri((New-Object System.Uri($url)), $href)
                $clean = (New-Object System.UriBuilder($linkUri))
                $clean.Fragment = ""
                $cleanUrl = $clean.Uri.AbsoluteUri
                if ($linkUri.Host -eq $domain -and -not $visited.Contains($cleanUrl)) {
                    $queue.Enqueue($cleanUrl)
                }
            } catch { }
        }
    }
    return $discovered
}

# ---------------------------------------------------------------------------
# Actions: scope check -> audit -> run tool -> record finding -> print.
# Shared by CLI dispatch, pipelines, and interactive menus.
# ---------------------------------------------------------------------------

function Invoke-ScanAction {
    param($Engagement, [string]$TargetHost, $PortList, [double]$TimeoutSec, [int]$MaxWorkers, [double]$DelaySec, [bool]$GrabBanners, [bool]$AsJson)
    Assert-Authorized -Engagement $Engagement -TargetStr $TargetHost
    Write-Audit -Engagement $Engagement -Command "scan" -Args @{ host = $TargetHost; ports = $PortList; timeout = $TimeoutSec; workers = $MaxWorkers; delay = $DelaySec; banners = $GrabBanners }
    $results = Invoke-PortScan -TargetHost $TargetHost -PortList $PortList -TimeoutSec $TimeoutSec -MaxWorkers $MaxWorkers -DelaySec $DelaySec -GrabBanners $GrabBanners
    $summary = Format-ScanResults -TargetHost $TargetHost -Results $results
    Add-Finding -Engagement $Engagement -Tool "scan" -TargetStr $TargetHost -Data $results -Summary $summary
    Write-Emit -Data $results -Summary $summary -AsJson $AsJson
    return $results
}

function Invoke-DiscoverAction {
    param($Engagement, [string]$Cidr, [double]$TimeoutSec, [int]$MaxWorkers, [double]$DelaySec, [bool]$AsJson)
    Assert-Authorized -Engagement $Engagement -TargetStr $Cidr
    Write-Audit -Engagement $Engagement -Command "discover" -Args @{ cidr = $Cidr; timeout = $TimeoutSec; workers = $MaxWorkers; delay = $DelaySec }
    $alive = Invoke-HostDiscovery -Cidr $Cidr -TimeoutSec $TimeoutSec -MaxWorkers $MaxWorkers -DelaySec $DelaySec
    $summary = Format-DiscoverResults -Cidr $Cidr -Alive $alive
    Add-Finding -Engagement $Engagement -Tool "discover" -TargetStr $Cidr -Data $alive -Summary $summary
    Write-Emit -Data $alive -Summary $summary -AsJson $AsJson
    return $alive
}

function Invoke-SubdomainsAction {
    param($Engagement, [string]$Domain, $Words, [int]$MaxWorkers, [double]$DelaySec, [bool]$AsJson)
    Assert-Authorized -Engagement $Engagement -TargetStr $Domain
    Write-Audit -Engagement $Engagement -Command "subdomains" -Args @{ domain = $Domain; workers = $MaxWorkers; delay = $DelaySec }
    $results = Invoke-SubdomainEnum -Domain $Domain -Words $Words -MaxWorkers $MaxWorkers -DelaySec $DelaySec
    $summary = Format-SubdomainResults -Domain $Domain -Results $results
    Add-Finding -Engagement $Engagement -Tool "subdomains" -TargetStr $Domain -Data $results -Summary $summary
    Write-Emit -Data $results -Summary $summary -AsJson $AsJson
    return $results
}

function Invoke-HeadersAction {
    param($Engagement, [string]$Url, [bool]$AsJson)
    Assert-Authorized -Engagement $Engagement -TargetStr $Url
    Write-Audit -Engagement $Engagement -Command "headers" -Args @{ url = $Url }
    $result = Invoke-Inspector -Url $Url
    $summary = Format-InspectResult -Result $result
    Add-Finding -Engagement $Engagement -Tool "headers" -TargetStr $Url -Data $result -Summary $summary
    Write-Emit -Data $result -Summary $summary -AsJson $AsJson
    return $result
}

function Invoke-FingerprintAction {
    param($Engagement, [string]$Url, [bool]$AsJson)
    Assert-Authorized -Engagement $Engagement -TargetStr $Url
    Write-Audit -Engagement $Engagement -Command "fingerprint" -Args @{ url = $Url }
    $result = Invoke-Fingerprint -Url $Url
    $summary = Format-FingerprintResult -Result $result
    Add-Finding -Engagement $Engagement -Tool "fingerprint" -TargetStr $Url -Data $result -Summary $summary
    Write-Emit -Data $result -Summary $summary -AsJson $AsJson
    return $result
}

function Invoke-FuzzAction {
    param($Engagement, [string]$Url, $Words, [int]$MaxWorkers, [double]$DelaySec, [bool]$AsJson)
    Assert-Authorized -Engagement $Engagement -TargetStr $Url
    Write-Audit -Engagement $Engagement -Command "fuzz" -Args @{ url = $Url; workers = $MaxWorkers; delay = $DelaySec }
    $results = Invoke-Fuzzer -BaseUrl $Url -Words $Words -MaxWorkers $MaxWorkers -DelaySec $DelaySec
    $summary = "Fuzz results for $Url`:`n" + (Format-FuzzResults -Results $results)
    Add-Finding -Engagement $Engagement -Tool "fuzz" -TargetStr $Url -Data $results -Summary $summary
    Write-Emit -Data $results -Summary $summary -AsJson $AsJson
    return $results
}

function Invoke-CrawlAction {
    param($Engagement, [string]$Url, [int]$MaxPages, [double]$DelaySec, [bool]$AsJson)
    Assert-Authorized -Engagement $Engagement -TargetStr $Url
    Write-Audit -Engagement $Engagement -Command "crawl" -Args @{ url = $Url; max_pages = $MaxPages; delay = $DelaySec }
    $pages = Invoke-Crawler -StartUrl $Url -MaxPages $MaxPages -DelaySec $DelaySec
    $lines = @("Discovered $($pages.Count) page(s):")
    foreach ($p in $pages) { $lines += "  $p" }
    $summary = ($lines -join "`n")
    Add-Finding -Engagement $Engagement -Tool "crawl" -TargetStr $Url -Data $pages -Summary $summary
    Write-Emit -Data $pages -Summary $summary -AsJson $AsJson
    return $pages
}

function Invoke-MapAction {
    param($Engagement, [string]$Url, [bool]$AsJson)
    Assert-Authorized -Engagement $Engagement -TargetStr $Url
    Write-Audit -Engagement $Engagement -Command "map" -Args @{ url = $Url }

    $forms = Get-Forms -Url $Url
    $uri = [uri]$Url
    $siteRoot = "$($uri.Scheme)://$($uri.Authority)"
    $hidden = Get-HiddenContent -BaseUrl $siteRoot

    $lines = @("Forms on $Url`:", (Format-Forms -Forms $forms))
    $lines += ""
    $lines += "Hidden content (robots.txt / sitemap.xml) for $siteRoot`:"
    if ($hidden.Count -gt 0) {
        foreach ($p in $hidden) { $lines += "  $p" }
    } else {
        $lines += "  none found"
    }
    $summary = ($lines -join "`n")

    $data = @{ forms = $forms; hidden_content = $hidden }
    Add-Finding -Engagement $Engagement -Tool "map" -TargetStr $Url -Data $data -Summary $summary
    Write-Emit -Data $data -Summary $summary -AsJson $AsJson
    return $data
}

# ---------------------------------------------------------------------------
# Pipelines: prebuilt chains of individual actions.
# ---------------------------------------------------------------------------

function Invoke-ReconPipeline {
    param($Engagement, [string]$Domain, [bool]$AsJson)
    Write-Host "=== recon: $Domain ==="
    $subResults = Invoke-SubdomainsAction -Engagement $Engagement -Domain $Domain -Words $null -MaxWorkers 8 -DelaySec 0.0 -AsJson $AsJson
    $hosts = @($Domain) + @($subResults | ForEach-Object { $_.HostName })

    foreach ($h in $hosts) {
        Write-Host "`n--- scanning $h ---"
        $scanResults = $null
        try {
            $scanResults = Invoke-ScanAction -Engagement $Engagement -TargetHost $h -PortList $null -TimeoutSec 0.5 -MaxWorkers 10 -DelaySec 0.0 -GrabBanners $false -AsJson $AsJson
        } catch {
            continue
        }
        foreach ($r in $scanResults) {
            if ($r.Open -and ($script:WebPorts -contains $r.Port)) {
                $url = ConvertTo-WebUrl -TargetHost $h -Port $r.Port
                Write-Host "`n--- fingerprinting $url ---"
                Invoke-FingerprintAction -Engagement $Engagement -Url $url -AsJson $AsJson | Out-Null
                Write-Host "`n--- mapping $url ---"
                Invoke-MapAction -Engagement $Engagement -Url $url -AsJson $AsJson | Out-Null
            }
        }
    }
    Write-Host "`n=== recon complete: see $($Engagement.ReportPath) ==="
}

function Invoke-WebReconPipeline {
    param($Engagement, [string]$Url, [bool]$AsJson)
    Write-Host "=== webrecon: $Url ==="
    Invoke-FingerprintAction -Engagement $Engagement -Url $Url -AsJson $AsJson | Out-Null
    Invoke-MapAction -Engagement $Engagement -Url $Url -AsJson $AsJson | Out-Null
    Invoke-CrawlAction -Engagement $Engagement -Url $Url -MaxPages 25 -DelaySec 0.2 -AsJson $AsJson | Out-Null
    Invoke-FuzzAction -Engagement $Engagement -Url $Url -Words $null -MaxWorkers 3 -DelaySec 0.3 -AsJson $AsJson | Out-Null
    Write-Host "`n=== webrecon complete: see $($Engagement.ReportPath) ==="
}

# ---------------------------------------------------------------------------
# Interactive drill-down menus: act on a specific finding right after a run.
# ---------------------------------------------------------------------------

function Show-UrlDrillDown {
    param($Engagement, [string]$Url, [bool]$AsJson)
    while ($true) {
        $choice = Show-Menu -Title "What next for $Url?" -Options @("fingerprint", "map (forms + hidden content)", "fuzz", "crawl")
        if ($null -eq $choice) { return }
        switch ($choice) {
            0 { Invoke-FingerprintAction -Engagement $Engagement -Url $Url -AsJson $AsJson | Out-Null }
            1 { Invoke-MapAction -Engagement $Engagement -Url $Url -AsJson $AsJson | Out-Null }
            2 { Invoke-FuzzAction -Engagement $Engagement -Url $Url -Words $null -MaxWorkers 3 -DelaySec 0.3 -AsJson $AsJson | Out-Null }
            3 { Invoke-CrawlAction -Engagement $Engagement -Url $Url -MaxPages 25 -DelaySec 0.2 -AsJson $AsJson | Out-Null }
        }
    }
}

function Show-ScanDrillDown {
    param($Engagement, [string]$TargetHost, [array]$Results, [bool]$AsJson)
    $openWeb = @($Results | Where-Object { $_.Open -and ($script:WebPorts -contains $_.Port) })
    if ($openWeb.Count -eq 0) { return }
    while ($true) {
        $labels = @($openWeb | ForEach-Object { "$($_.Port)/tcp - investigate as web service" })
        $choice = Show-Menu -Title "Open web ports on $TargetHost" -Options $labels
        if ($null -eq $choice) { return }
        $url = ConvertTo-WebUrl -TargetHost $TargetHost -Port $openWeb[$choice].Port
        Show-UrlDrillDown -Engagement $Engagement -Url $url -AsJson $AsJson
    }
}

function Show-DiscoverDrillDown {
    param($Engagement, [array]$HostsList, [bool]$AsJson)
    if ($HostsList.Count -eq 0) { return }
    while ($true) {
        $choice = Show-Menu -Title "Live hosts" -Options $HostsList
        if ($null -eq $choice) { return }
        Invoke-ScanAction -Engagement $Engagement -TargetHost $HostsList[$choice] -PortList $null -TimeoutSec 0.5 -MaxWorkers 10 -DelaySec 0.0 -GrabBanners $false -AsJson $AsJson | Out-Null
    }
}

function Show-SubdomainsDrillDown {
    param($Engagement, [array]$Results, [bool]$AsJson)
    if ($Results.Count -eq 0) { return }
    while ($true) {
        $labels = @($Results | ForEach-Object { "$($_.HostName) ($($_.IP))" })
        $choice = Show-Menu -Title "Resolved subdomains" -Options $labels
        if ($null -eq $choice) { return }
        $host_ = $Results[$choice].HostName
        $action = Show-Menu -Title "What next for $host_?" -Options @("scan ports", "fingerprint https://$host_")
        if ($action -eq 0) {
            Invoke-ScanAction -Engagement $Engagement -TargetHost $host_ -PortList $null -TimeoutSec 0.5 -MaxWorkers 10 -DelaySec 0.0 -GrabBanners $false -AsJson $AsJson | Out-Null
        } elseif ($action -eq 1) {
            Invoke-FingerprintAction -Engagement $Engagement -Url "https://$host_" -AsJson $AsJson | Out-Null
        }
    }
}

function Show-FuzzDrillDown {
    param($Engagement, [array]$Results, [bool]$AsJson)
    $hits = @($Results | Where-Object { $_.StatusCode -and $_.StatusCode -ne 404 })
    if ($hits.Count -eq 0) { return }
    while ($true) {
        $labels = @($hits | ForEach-Object { "$($_.Path) ($($_.StatusCode))" })
        $choice = Show-Menu -Title "Fuzz hits" -Options $labels
        if ($null -eq $choice) { return }
        Show-UrlDrillDown -Engagement $Engagement -Url $hits[$choice].Url -AsJson $AsJson
    }
}

function Show-CrawlDrillDown {
    param($Engagement, [array]$Pages, [bool]$AsJson)
    if ($Pages.Count -eq 0) { return }
    while ($true) {
        $choice = Show-Menu -Title "Discovered pages" -Options $Pages
        if ($null -eq $choice) { return }
        Show-UrlDrillDown -Engagement $Engagement -Url $Pages[$choice] -AsJson $AsJson
    }
}

# ---------------------------------------------------------------------------
# Scope management (interactive) + listing helper shared with CLI dispatch.
# ---------------------------------------------------------------------------

function Show-ScopeList {
    param($Engagement)
    if (-not $Engagement.Scope.Enforced) {
        Write-Host "Scope is not enforced (no scope.json found). Run scope-init to enable it."
        return
    }
    if (@($Engagement.Scope.Entries).Count -eq 0) {
        Write-Host "Scope enforced ($($Engagement.ScopePath)) but empty - nothing is authorized."
        return
    }
    Write-Host "Authorized targets ($($Engagement.ScopePath)):"
    foreach ($e in $Engagement.Scope.Entries) { Write-Host "  $e" }
}

function Show-ScopeMenu {
    param([string]$EngagementRoot)
    while ($true) {
        $choice = Show-Menu -Title "Scope management" -Options @(
            "init - create scope file, enable enforcement",
            "add - authorize a target",
            "list - list authorized targets"
        )
        if ($null -eq $choice) { return }
        $eng = Initialize-Engagement -Root $EngagementRoot
        switch ($choice) {
            0 {
                Save-Scope -Scope $eng.Scope -Path $eng.ScopePath
                Write-Host "Initialized scope at $($eng.ScopePath) (enforcement is now ON - nothing is authorized yet)."
            }
            1 {
                $t = Read-Host "Target (domain, IP, or CIDR)"
                $eng.Scope = Add-ScopeTarget -Scope $eng.Scope -TargetStr $t
                Save-Scope -Scope $eng.Scope -Path $eng.ScopePath
                Write-Host "Authorized '$t' in $($eng.ScopePath)"
            }
            2 { Show-ScopeList -Engagement $eng }
        }
    }
}

# ---------------------------------------------------------------------------
# Top-level interactive menu (shown when -Action is omitted).
# ---------------------------------------------------------------------------

function Show-MainMenu {
    param([string]$EngagementRoot)
    while ($true) {
        $choice = Show-Menu -Title "playground - choose a tool" -Options @(
            "scan - TCP connect port scan",
            "discover - ICMP ping sweep over a CIDR",
            "subdomains - DNS-based subdomain enumeration",
            "headers - Inspect a URL's response headers/cookies",
            "fingerprint - Passive tech fingerprint + missing security headers",
            "fuzz - Wordlist-based path fuzzing",
            "crawl - Same-domain link crawler",
            "map - Discover forms + hidden content",
            "recon - Pipeline: subdomains -> scan -> fingerprint/map",
            "webrecon - Pipeline: fingerprint -> map -> crawl -> fuzz",
            "scope - manage engagement scope"
        )
        if ($null -eq $choice) { return }
        $eng = Initialize-Engagement -Root $EngagementRoot
        $interactive = Test-IsInteractive -NoInteractiveFlag $false -AsJsonFlag $false
        switch ($choice) {
            0 {
                $t = Read-Host "Host"
                $r = Invoke-ScanAction -Engagement $eng -TargetHost $t -PortList $null -TimeoutSec 0.5 -MaxWorkers 10 -DelaySec 0.0 -GrabBanners $false -AsJson $false
                if ($interactive) { Show-ScanDrillDown -Engagement $eng -TargetHost $t -Results $r -AsJson $false }
            }
            1 {
                $t = Read-Host "CIDR"
                $r = Invoke-DiscoverAction -Engagement $eng -Cidr $t -TimeoutSec 1.0 -MaxWorkers 8 -DelaySec 0.0 -AsJson $false
                if ($interactive) { Show-DiscoverDrillDown -Engagement $eng -HostsList $r -AsJson $false }
            }
            2 {
                $t = Read-Host "Domain"
                $r = Invoke-SubdomainsAction -Engagement $eng -Domain $t -Words $null -MaxWorkers 8 -DelaySec 0.0 -AsJson $false
                if ($interactive) { Show-SubdomainsDrillDown -Engagement $eng -Results $r -AsJson $false }
            }
            3 {
                $t = Read-Host "URL"
                Invoke-HeadersAction -Engagement $eng -Url $t -AsJson $false | Out-Null
                if ($interactive) { Show-UrlDrillDown -Engagement $eng -Url $t -AsJson $false }
            }
            4 {
                $t = Read-Host "URL"
                Invoke-FingerprintAction -Engagement $eng -Url $t -AsJson $false | Out-Null
                if ($interactive) { Show-UrlDrillDown -Engagement $eng -Url $t -AsJson $false }
            }
            5 {
                $t = Read-Host "URL"
                $r = Invoke-FuzzAction -Engagement $eng -Url $t -Words $null -MaxWorkers 3 -DelaySec 0.3 -AsJson $false
                if ($interactive) { Show-FuzzDrillDown -Engagement $eng -Results $r -AsJson $false }
            }
            6 {
                $t = Read-Host "URL"
                $r = Invoke-CrawlAction -Engagement $eng -Url $t -MaxPages 25 -DelaySec 0.2 -AsJson $false
                if ($interactive) { Show-CrawlDrillDown -Engagement $eng -Pages $r -AsJson $false }
            }
            7 {
                $t = Read-Host "URL"
                Invoke-MapAction -Engagement $eng -Url $t -AsJson $false | Out-Null
                if ($interactive) { Show-UrlDrillDown -Engagement $eng -Url $t -AsJson $false }
            }
            8 {
                $t = Read-Host "Domain"
                Invoke-ReconPipeline -Engagement $eng -Domain $t -AsJson $false
            }
            9 {
                $t = Read-Host "URL"
                Invoke-WebReconPipeline -Engagement $eng -Url $t -AsJson $false
            }
            10 { Show-ScopeMenu -EngagementRoot $EngagementRoot }
        }
    }
}

# ---------------------------------------------------------------------------
# Help text
# ---------------------------------------------------------------------------

function Show-Help {
    @"
playground.ps1 - security playground (PowerShell edition)

$script:Disclaimer

USAGE
    .\playground.ps1 -Action <action> [-Target <target>] [options]
    .\playground.ps1                    (no -Action -> interactive menu)
    .\playground.ps1 -Help              (this text)
    Get-Help .\playground.ps1 -Full     (full comment-based help)

ACTIONS
    scan         -Target HOST   [-Ports "22,80,443"] [-Timeout 0.5] [-Workers 10] [-Delay 0.0] [-Banners]
    discover     -Target CIDR   [-Timeout 1.0] [-Workers 8] [-Delay 0.0]
    subdomains   -Target DOMAIN [-Wordlist FILE] [-Workers 8] [-Delay 0.0]
    headers      -Target URL
    fingerprint  -Target URL
    fuzz         -Target URL    [-Wordlist FILE] [-Workers 3] [-Delay 0.3]
    crawl        -Target URL    [-MaxPages 25] [-Delay 0.2]
    map          -Target URL
    recon        -Target DOMAIN   (pipeline: subdomains -> scan -> fingerprint/map)
    webrecon     -Target URL      (pipeline: fingerprint -> map -> crawl -> fuzz)
    scope-init                  create an (empty) scope file, enabling enforcement
    scope-add    -Target TARGET authorize a target (domain, IP, or CIDR)
    scope-list                  list authorized targets

COMMON OPTIONS
    -EngagementDir DIR   engagement workspace (default: .\.playground)
    -Json                machine-readable JSON output instead of formatted text
    -NoInteractive       skip the post-run drill-down menu

EXAMPLES
    .\playground.ps1 -Action scan -Target 127.0.0.1 -Ports 22,80,443 -Banners
    .\playground.ps1 -Action discover -Target 192.168.1.0/24
    .\playground.ps1 -Action subdomains -Target example.com
    .\playground.ps1 -Action headers -Target https://example.com
    .\playground.ps1 -Action recon -Target example.com
    .\playground.ps1 -Action scope-init -EngagementDir .\engagements\acme
    .\playground.ps1 -Action scope-add -Target example.com -EngagementDir .\engagements\acme
    .\playground.ps1 -Action scan -Target 10.0.0.5 -EngagementDir .\engagements\acme

Every action records into an engagement workspace: scope.json, audit.log,
findings.json, and report.md.
"@ | Write-Host
}

# ---------------------------------------------------------------------------
# CLI dispatch
# ---------------------------------------------------------------------------

if ($Help) {
    Show-Help
    exit 0
}

if (-not $Action) {
    Write-Host $script:Disclaimer
    Show-MainMenu -EngagementRoot $EngagementDir
    exit 0
}

$eng = Initialize-Engagement -Root $EngagementDir

$portList = $null
if ($Ports) { $portList = @($Ports -split ',' | ForEach-Object { [int]$_.Trim() }) }
$words = Import-WordList -Path $Wordlist

switch ($Action) {
    'scan' {
        if (-not $Target) { Write-Error "-Target (host) is required for -Action scan"; exit 1 }
        $t = 0.5; if ($PSBoundParameters.ContainsKey('Timeout')) { $t = $Timeout }
        $w = 10; if ($PSBoundParameters.ContainsKey('Workers')) { $w = $Workers }
        $d = 0.0; if ($PSBoundParameters.ContainsKey('Delay')) { $d = $Delay }
        $r = Invoke-ScanAction -Engagement $eng -TargetHost $Target -PortList $portList -TimeoutSec $t -MaxWorkers $w -DelaySec $d -GrabBanners:([bool]$Banners) -AsJson:([bool]$Json)
        if (Test-IsInteractive -NoInteractiveFlag ([bool]$NoInteractive) -AsJsonFlag ([bool]$Json)) {
            Show-ScanDrillDown -Engagement $eng -TargetHost $Target -Results $r -AsJson:([bool]$Json)
        }
    }
    'discover' {
        if (-not $Target) { Write-Error "-Target (CIDR) is required for -Action discover"; exit 1 }
        $t = 1.0; if ($PSBoundParameters.ContainsKey('Timeout')) { $t = $Timeout }
        $w = 8; if ($PSBoundParameters.ContainsKey('Workers')) { $w = $Workers }
        $d = 0.0; if ($PSBoundParameters.ContainsKey('Delay')) { $d = $Delay }
        $r = Invoke-DiscoverAction -Engagement $eng -Cidr $Target -TimeoutSec $t -MaxWorkers $w -DelaySec $d -AsJson:([bool]$Json)
        if (Test-IsInteractive -NoInteractiveFlag ([bool]$NoInteractive) -AsJsonFlag ([bool]$Json)) {
            Show-DiscoverDrillDown -Engagement $eng -HostsList $r -AsJson:([bool]$Json)
        }
    }
    'subdomains' {
        if (-not $Target) { Write-Error "-Target (domain) is required for -Action subdomains"; exit 1 }
        $w = 8; if ($PSBoundParameters.ContainsKey('Workers')) { $w = $Workers }
        $d = 0.0; if ($PSBoundParameters.ContainsKey('Delay')) { $d = $Delay }
        $r = Invoke-SubdomainsAction -Engagement $eng -Domain $Target -Words $words -MaxWorkers $w -DelaySec $d -AsJson:([bool]$Json)
        if (Test-IsInteractive -NoInteractiveFlag ([bool]$NoInteractive) -AsJsonFlag ([bool]$Json)) {
            Show-SubdomainsDrillDown -Engagement $eng -Results $r -AsJson:([bool]$Json)
        }
    }
    'headers' {
        if (-not $Target) { Write-Error "-Target (URL) is required for -Action headers"; exit 1 }
        Invoke-HeadersAction -Engagement $eng -Url $Target -AsJson:([bool]$Json) | Out-Null
        if (Test-IsInteractive -NoInteractiveFlag ([bool]$NoInteractive) -AsJsonFlag ([bool]$Json)) {
            Show-UrlDrillDown -Engagement $eng -Url $Target -AsJson:([bool]$Json)
        }
    }
    'fingerprint' {
        if (-not $Target) { Write-Error "-Target (URL) is required for -Action fingerprint"; exit 1 }
        Invoke-FingerprintAction -Engagement $eng -Url $Target -AsJson:([bool]$Json) | Out-Null
        if (Test-IsInteractive -NoInteractiveFlag ([bool]$NoInteractive) -AsJsonFlag ([bool]$Json)) {
            Show-UrlDrillDown -Engagement $eng -Url $Target -AsJson:([bool]$Json)
        }
    }
    'fuzz' {
        if (-not $Target) { Write-Error "-Target (URL) is required for -Action fuzz"; exit 1 }
        $w = 3; if ($PSBoundParameters.ContainsKey('Workers')) { $w = $Workers }
        $d = 0.3; if ($PSBoundParameters.ContainsKey('Delay')) { $d = $Delay }
        $r = Invoke-FuzzAction -Engagement $eng -Url $Target -Words $words -MaxWorkers $w -DelaySec $d -AsJson:([bool]$Json)
        if (Test-IsInteractive -NoInteractiveFlag ([bool]$NoInteractive) -AsJsonFlag ([bool]$Json)) {
            Show-FuzzDrillDown -Engagement $eng -Results $r -AsJson:([bool]$Json)
        }
    }
    'crawl' {
        if (-not $Target) { Write-Error "-Target (URL) is required for -Action crawl"; exit 1 }
        $mp = 25; if ($PSBoundParameters.ContainsKey('MaxPages')) { $mp = $MaxPages }
        $d = 0.2; if ($PSBoundParameters.ContainsKey('Delay')) { $d = $Delay }
        $r = Invoke-CrawlAction -Engagement $eng -Url $Target -MaxPages $mp -DelaySec $d -AsJson:([bool]$Json)
        if (Test-IsInteractive -NoInteractiveFlag ([bool]$NoInteractive) -AsJsonFlag ([bool]$Json)) {
            Show-CrawlDrillDown -Engagement $eng -Pages $r -AsJson:([bool]$Json)
        }
    }
    'map' {
        if (-not $Target) { Write-Error "-Target (URL) is required for -Action map"; exit 1 }
        Invoke-MapAction -Engagement $eng -Url $Target -AsJson:([bool]$Json) | Out-Null
        if (Test-IsInteractive -NoInteractiveFlag ([bool]$NoInteractive) -AsJsonFlag ([bool]$Json)) {
            Show-UrlDrillDown -Engagement $eng -Url $Target -AsJson:([bool]$Json)
        }
    }
    'recon' {
        if (-not $Target) { Write-Error "-Target (domain) is required for -Action recon"; exit 1 }
        Invoke-ReconPipeline -Engagement $eng -Domain $Target -AsJson:([bool]$Json)
    }
    'webrecon' {
        if (-not $Target) { Write-Error "-Target (URL) is required for -Action webrecon"; exit 1 }
        Invoke-WebReconPipeline -Engagement $eng -Url $Target -AsJson:([bool]$Json)
    }
    'scope-init' {
        Save-Scope -Scope $eng.Scope -Path $eng.ScopePath
        Write-Host "Initialized scope at $($eng.ScopePath) (enforcement is now ON - nothing is authorized yet)."
    }
    'scope-add' {
        if (-not $Target) { Write-Error "-Target is required for -Action scope-add"; exit 1 }
        $eng.Scope = Add-ScopeTarget -Scope $eng.Scope -TargetStr $Target
        Save-Scope -Scope $eng.Scope -Path $eng.ScopePath
        Write-Host "Authorized '$Target' in $($eng.ScopePath)"
    }
    'scope-list' {
        Show-ScopeList -Engagement $eng
    }
    default {
        Write-Error "Unknown action: $Action"
        exit 1
    }
}

exit 0
