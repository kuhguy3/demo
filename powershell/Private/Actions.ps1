# Core tool actions: run a tool, print its result, and record it against an
# engagement (scope check + audit log + findings/report). Shared by the CLI,
# the interactive drill-down menu, and the prebuilt pipelines so the
# authorization/audit/reporting behavior is identical no matter how a tool
# is invoked. Mirrors playground.actions from the Python port.

function Write-PlaygroundEmit {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Data, [Parameter(Mandatory)][string]$Summary, [switch]$AsJson)

    if ($AsJson) {
        Write-Host ($Data | ConvertTo-Json -Depth 12)
    } else {
        Write-Host $Summary
    }
}

function Invoke-ScanAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$TargetHost,
        [int[]]$Port,
        [double]$TimeoutSeconds = 0.5,
        [int]$Workers = 10,
        [double]$Delay = 0.0,
        [switch]$GrabBanner,
        [switch]$AsJson
    )
    Assert-PlaygroundAuthorized -Engagement $Engagement -Target $TargetHost
    Write-PlaygroundAudit -Engagement $Engagement -Command 'scan' -CommandArgs @{ host = $TargetHost; ports = $Port; timeout = $TimeoutSeconds; workers = $Workers; delay = $Delay; banners = [bool]$GrabBanner }

    $params = @{ TargetHost = $TargetHost; TimeoutSeconds = $TimeoutSeconds; Workers = $Workers; Delay = $Delay; GrabBanner = [bool]$GrabBanner }
    if ($Port) { $params.Port = $Port }
    $results = @(Invoke-PlaygroundPortScan @params)

    $summary = Format-PlaygroundScanResults -TargetHost $TargetHost -Results $results
    Add-PlaygroundFinding -Engagement $Engagement -Tool 'scan' -Target $TargetHost -Data $results -Summary $summary
    Write-PlaygroundEmit -Data $results -Summary $summary -AsJson:$AsJson
    return $results
}

function Invoke-DiscoverAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Cidr,
        [int]$TimeoutMs = 1000,
        [int]$Workers = 8,
        [double]$Delay = 0.0,
        [switch]$AsJson
    )
    Assert-PlaygroundAuthorized -Engagement $Engagement -Target $Cidr
    Write-PlaygroundAudit -Engagement $Engagement -Command 'discover' -CommandArgs @{ cidr = $Cidr; timeoutMs = $TimeoutMs; workers = $Workers; delay = $Delay }

    $hosts = @(Invoke-PlaygroundHostDiscovery -Cidr $Cidr -TimeoutMs $TimeoutMs -Workers $Workers -Delay $Delay)
    $summary = Format-PlaygroundDiscoveryResults -Cidr $Cidr -Hosts $hosts
    Add-PlaygroundFinding -Engagement $Engagement -Tool 'discover' -Target $Cidr -Data $hosts -Summary $summary
    Write-PlaygroundEmit -Data $hosts -Summary $summary -AsJson:$AsJson
    return $hosts
}

function Invoke-SubdomainsAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Domain,
        [string[]]$Wordlist,
        [int]$Workers = 8,
        [double]$Delay = 0.0,
        [switch]$AsJson
    )
    Assert-PlaygroundAuthorized -Engagement $Engagement -Target $Domain
    Write-PlaygroundAudit -Engagement $Engagement -Command 'subdomains' -CommandArgs @{ domain = $Domain; workers = $Workers; delay = $Delay }

    $params = @{ Domain = $Domain; Workers = $Workers; Delay = $Delay }
    if ($Wordlist) { $params.Wordlist = $Wordlist }
    $results = @(Invoke-PlaygroundSubdomainEnum @params)

    $summary = Format-PlaygroundSubdomainResults -Domain $Domain -Results $results
    Add-PlaygroundFinding -Engagement $Engagement -Tool 'subdomains' -Target $Domain -Data $results -Summary $summary
    Write-PlaygroundEmit -Data $results -Summary $summary -AsJson:$AsJson
    return $results
}

function Invoke-HeadersAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Uri,
        [switch]$AsJson
    )
    Assert-PlaygroundAuthorized -Engagement $Engagement -Target $Uri
    Write-PlaygroundAudit -Engagement $Engagement -Command 'headers' -CommandArgs @{ url = $Uri }

    $result = Invoke-PlaygroundInspection -Uri $Uri
    $summary = Format-PlaygroundInspectionResult -Result $result
    Add-PlaygroundFinding -Engagement $Engagement -Tool 'headers' -Target $Uri -Data $result -Summary $summary
    Write-PlaygroundEmit -Data $result -Summary $summary -AsJson:$AsJson
    return $result
}

function Invoke-FingerprintAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Uri,
        [switch]$AsJson
    )
    Assert-PlaygroundAuthorized -Engagement $Engagement -Target $Uri
    Write-PlaygroundAudit -Engagement $Engagement -Command 'fingerprint' -CommandArgs @{ url = $Uri }

    $result = Invoke-PlaygroundFingerprint -Uri $Uri
    $summary = Format-PlaygroundFingerprintResult -Result $result
    Add-PlaygroundFinding -Engagement $Engagement -Tool 'fingerprint' -Target $Uri -Data $result -Summary $summary
    Write-PlaygroundEmit -Data $result -Summary $summary -AsJson:$AsJson
    return $result
}

function Invoke-FuzzAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Uri,
        [string[]]$Wordlist,
        [int]$Workers = 3,
        [double]$Delay = 0.3,
        [switch]$AsJson
    )
    Assert-PlaygroundAuthorized -Engagement $Engagement -Target $Uri
    Write-PlaygroundAudit -Engagement $Engagement -Command 'fuzz' -CommandArgs @{ url = $Uri; workers = $Workers; delay = $Delay }

    $params = @{ BaseUrl = $Uri; Workers = $Workers; Delay = $Delay }
    if ($Wordlist) { $params.Wordlist = $Wordlist }
    $results = @(Invoke-PlaygroundFuzz @params)

    $summary = "Fuzz results for ${Uri}:`n" + (Format-PlaygroundFuzzResults -Results $results)
    Add-PlaygroundFinding -Engagement $Engagement -Tool 'fuzz' -Target $Uri -Data $results -Summary $summary
    Write-PlaygroundEmit -Data $results -Summary $summary -AsJson:$AsJson
    return $results
}

function Invoke-CrawlAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Uri,
        [int]$MaxPages = 25,
        [double]$Delay = 0.2,
        [switch]$AsJson
    )
    Assert-PlaygroundAuthorized -Engagement $Engagement -Target $Uri
    Write-PlaygroundAudit -Engagement $Engagement -Command 'crawl' -CommandArgs @{ url = $Uri; maxPages = $MaxPages; delay = $Delay }

    $pages = @(Invoke-PlaygroundCrawl -StartUrl $Uri -MaxPages $MaxPages -Delay $Delay)
    $summary = Format-PlaygroundCrawlResults -Pages $pages
    Add-PlaygroundFinding -Engagement $Engagement -Tool 'crawl' -Target $Uri -Data $pages -Summary $summary
    Write-PlaygroundEmit -Data $pages -Summary $summary -AsJson:$AsJson
    return $pages
}

function Invoke-MapAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Uri,
        [switch]$AsJson
    )
    Assert-PlaygroundAuthorized -Engagement $Engagement -Target $Uri
    Write-PlaygroundAudit -Engagement $Engagement -Command 'map' -CommandArgs @{ url = $Uri }

    $forms = @(Find-PlaygroundForms -Uri $Uri)
    $parsedUri = [Uri]$Uri
    $siteRoot = "$($parsedUri.Scheme)://$($parsedUri.Authority)"
    $hidden = @(Get-PlaygroundHiddenContent -SiteRoot $siteRoot)

    $summaryLines = [System.Collections.Generic.List[string]]::new()
    $summaryLines.Add("Forms on ${Uri}:")
    $summaryLines.Add((Format-PlaygroundForms -Forms $forms))
    $summaryLines.Add("`nHidden content (robots.txt / sitemap.xml) for ${siteRoot}:")
    if ($hidden.Count -gt 0) {
        foreach ($p in $hidden) { $summaryLines.Add("  $p") }
    } else {
        $summaryLines.Add('  none found')
    }
    $summary = $summaryLines -join "`n"

    $data = [PSCustomObject]@{ forms = $forms; hidden_content = $hidden }
    Add-PlaygroundFinding -Engagement $Engagement -Tool 'map' -Target $Uri -Data $data -Summary $summary
    Write-PlaygroundEmit -Data $data -Summary $summary -AsJson:$AsJson
    return $data
}
