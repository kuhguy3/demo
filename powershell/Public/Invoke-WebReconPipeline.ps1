# Prebuilt web-app recon pipeline: fingerprint -> map -> crawl -> fuzz.
# Mirrors playground.pipelines.run_webrecon from the Python port.

function Invoke-WebReconPipeline {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][string]$Uri, [switch]$AsJson)

    Write-Host "=== webrecon: $Uri ==="
    Invoke-FingerprintAction -Engagement $Engagement -Uri $Uri -AsJson:$AsJson | Out-Null
    Invoke-MapAction -Engagement $Engagement -Uri $Uri -AsJson:$AsJson | Out-Null
    Invoke-CrawlAction -Engagement $Engagement -Uri $Uri -AsJson:$AsJson | Out-Null
    Invoke-FuzzAction -Engagement $Engagement -Uri $Uri -AsJson:$AsJson | Out-Null
    Write-Host "`n=== webrecon complete: see $($Engagement.ReportPath) ==="
}
