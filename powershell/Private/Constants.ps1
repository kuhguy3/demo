# Shared constants used by the interactive drill-down menu and pipelines.

$script:WebPorts = @(80, 443, 8080, 8443)

function Get-PlaygroundWebUrl {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$TargetHost, [Parameter(Mandatory)][int]$Port)

    $scheme = if ($Port -in @(443, 8443)) { 'https' } else { 'http' }
    if ($Port -in @(80, 443)) { return "${scheme}://${TargetHost}" }
    return "${scheme}://${TargetHost}:${Port}"
}
