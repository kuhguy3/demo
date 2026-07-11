# Prebuilt recon pipeline: subdomains -> scan -> fingerprint + map any web
# ports found. Mirrors playground.pipelines.run_recon from the Python port.

function Invoke-ReconPipeline {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][string]$Domain, [switch]$AsJson)

    Write-Host "=== recon: $Domain ==="
    $subResults = @(Invoke-SubdomainsAction -Engagement $Engagement -Domain $Domain -AsJson:$AsJson)
    $hosts = @($Domain) + @($subResults | ForEach-Object { $_.host })

    foreach ($h in $hosts) {
        Write-Host "`n--- scanning $h ---"
        try {
            $scanResults = @(Invoke-ScanAction -Engagement $Engagement -TargetHost $h -AsJson:$AsJson)
        } catch {
            continue
        }
        foreach ($r in $scanResults) {
            if ($r.open -and $r.port -in $script:WebPorts) {
                $url = Get-PlaygroundWebUrl -TargetHost $h -Port $r.port
                Write-Host "`n--- fingerprinting $url ---"
                Invoke-FingerprintAction -Engagement $Engagement -Uri $url -AsJson:$AsJson | Out-Null
                Write-Host "`n--- mapping $url ---"
                Invoke-MapAction -Engagement $Engagement -Uri $url -AsJson:$AsJson | Out-Null
            }
        }
    }

    Write-Host "`n=== recon complete: see $($Engagement.ReportPath) ==="
}
