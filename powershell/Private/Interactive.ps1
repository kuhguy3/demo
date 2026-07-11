# Post-run drill-down menus: act on specific findings interactively.
# Mirrors playground.interactive from the Python port.

function Test-PlaygroundInteractive {
    [CmdletBinding()]
    param([switch]$NoInteractive, [switch]$AsJson)

    if ($NoInteractive -or $AsJson) { return $false }
    return (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected)
}

function Show-PlaygroundMenu {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Title, [Parameter(Mandatory)][string[]]$Options)

    Write-Host ''
    Write-Host $Title
    for ($i = 0; $i -lt $Options.Count; $i++) {
        Write-Host "  $($i + 1)) $($Options[$i])"
    }
    Write-Host '  0) done'
    $choice = Read-Host '>'
    if ([string]::IsNullOrWhiteSpace($choice) -or $choice -eq '0') { return $null }
    $index = 0
    if (-not [int]::TryParse($choice, [ref]$index)) { return $null }
    if ($index -ge 1 -and $index -le $Options.Count) { return $index - 1 }
    return $null
}

function Show-PlaygroundUrlDrillDown {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][string]$Uri, [switch]$AsJson)

    while ($true) {
        $choice = Show-PlaygroundMenu -Title "What next for ${Uri}?" -Options @('fingerprint', 'map (forms + hidden content)', 'fuzz', 'crawl')
        if ($null -eq $choice) { return }
        switch ($choice) {
            0 { Invoke-FingerprintAction -Engagement $Engagement -Uri $Uri -AsJson:$AsJson | Out-Null }
            1 { Invoke-MapAction -Engagement $Engagement -Uri $Uri -AsJson:$AsJson | Out-Null }
            2 { Invoke-FuzzAction -Engagement $Engagement -Uri $Uri -AsJson:$AsJson | Out-Null }
            3 { Invoke-CrawlAction -Engagement $Engagement -Uri $Uri -AsJson:$AsJson | Out-Null }
        }
    }
}

function Show-PlaygroundScanDrillDown {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][string]$TargetHost, [Parameter(Mandatory)][array]$Results, [switch]$AsJson)

    $openWeb = @($Results | Where-Object { $_.open -and $_.port -in $script:WebPorts })
    if ($openWeb.Count -eq 0) { return }
    while ($true) {
        $labels = @($openWeb | ForEach-Object { "$($_.port)/tcp — investigate as web service" })
        $choice = Show-PlaygroundMenu -Title "Open web ports on ${TargetHost}" -Options $labels
        if ($null -eq $choice) { return }
        $url = Get-PlaygroundWebUrl -TargetHost $TargetHost -Port $openWeb[$choice].port
        Show-PlaygroundUrlDrillDown -Engagement $Engagement -Uri $url -AsJson:$AsJson
    }
}

function Show-PlaygroundDiscoverDrillDown {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][array]$DiscoveredHosts, [switch]$AsJson)

    if ($DiscoveredHosts.Count -eq 0) { return }
    while ($true) {
        $choice = Show-PlaygroundMenu -Title 'Live hosts' -Options $DiscoveredHosts
        if ($null -eq $choice) { return }
        Invoke-ScanAction -Engagement $Engagement -TargetHost $DiscoveredHosts[$choice] -AsJson:$AsJson | Out-Null
    }
}

function Show-PlaygroundSubdomainsDrillDown {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][array]$Results, [switch]$AsJson)

    if ($Results.Count -eq 0) { return }
    while ($true) {
        $labels = @($Results | ForEach-Object { "$($_.host) ($($_.ip))" })
        $choice = Show-PlaygroundMenu -Title 'Resolved subdomains' -Options $labels
        if ($null -eq $choice) { return }
        $entry = $Results[$choice]
        $action = Show-PlaygroundMenu -Title "What next for $($entry.host)?" -Options @('scan ports', "fingerprint https://$($entry.host)")
        if ($action -eq 0) {
            Invoke-ScanAction -Engagement $Engagement -TargetHost $entry.host -AsJson:$AsJson | Out-Null
        } elseif ($action -eq 1) {
            Invoke-FingerprintAction -Engagement $Engagement -Uri "https://$($entry.host)" -AsJson:$AsJson | Out-Null
        }
    }
}

function Show-PlaygroundFuzzDrillDown {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][array]$Results, [switch]$AsJson)

    $hits = @($Results | Where-Object { $_.status_code -and $_.status_code -ne 404 })
    if ($hits.Count -eq 0) { return }
    while ($true) {
        $labels = @($hits | ForEach-Object { "$($_.path) ($($_.status_code))" })
        $choice = Show-PlaygroundMenu -Title 'Fuzz hits' -Options $labels
        if ($null -eq $choice) { return }
        Show-PlaygroundUrlDrillDown -Engagement $Engagement -Uri $hits[$choice].url -AsJson:$AsJson
    }
}

function Show-PlaygroundCrawlDrillDown {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][array]$Pages, [switch]$AsJson)

    if ($Pages.Count -eq 0) { return }
    while ($true) {
        $choice = Show-PlaygroundMenu -Title 'Discovered pages' -Options $Pages
        if ($null -eq $choice) { return }
        Show-PlaygroundUrlDrillDown -Engagement $Engagement -Uri $Pages[$choice] -AsJson:$AsJson
    }
}
