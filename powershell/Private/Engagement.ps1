# Engagement workspace: scope enforcement, audit logging, and findings/report
# tracking. Mirrors playground.engagement.Engagement from the Python port.

class PlaygroundScopeViolation : System.Exception {
    PlaygroundScopeViolation([string]$message) : base($message) {}
}

function New-PlaygroundEngagement {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Root)

    if (-not (Test-Path -LiteralPath $Root)) {
        New-Item -ItemType Directory -Path $Root -Force | Out-Null
    }
    $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path

    $scopePath = Join-Path $resolvedRoot 'scope.json'

    [PSCustomObject]@{
        Root         = $resolvedRoot
        ScopePath    = $scopePath
        AuditPath    = Join-Path $resolvedRoot 'audit.log'
        FindingsPath = Join-Path $resolvedRoot 'findings.json'
        ReportPath   = Join-Path $resolvedRoot 'report.md'
        Scope        = (Import-PlaygroundScope -Path $scopePath)
    }
}

function Assert-PlaygroundAuthorized {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][string]$Target)

    if (-not (Test-ScopeAuthorized -Scope $Engagement.Scope -Target $Target)) {
        throw [PlaygroundScopeViolation]::new(
            "'$Target' is not authorized in this engagement's scope ($($Engagement.ScopePath)). Run ``scope add $Target`` to authorize it first."
        )
    }
}

function Write-PlaygroundAudit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][hashtable]$CommandArgs
    )
    $entry = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
        command   = $Command
        args      = $CommandArgs
    }
    ($entry | ConvertTo-Json -Compress -Depth 6) | Add-Content -LiteralPath $Engagement.AuditPath
}

function Add-PlaygroundFinding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Engagement,
        [Parameter(Mandatory)][string]$Tool,
        [Parameter(Mandatory)][string]$Target,
        [Parameter(Mandatory)][AllowNull()]$Data,
        [Parameter(Mandatory)][string]$Summary
    )
    $findings = @()
    if (Test-Path -LiteralPath $Engagement.FindingsPath) {
        $raw = Get-Content -LiteralPath $Engagement.FindingsPath -Raw
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            $findings = @(ConvertFrom-Json -InputObject $raw)
            # ConvertFrom-Json silently parses ISO-8601-looking strings into
            # [datetime], which then re-renders in local/culture format
            # instead of ISO-8601. Normalize back to a plain string.
            foreach ($existing in $findings) {
                if ($existing.timestamp -is [datetime]) {
                    $existing.timestamp = $existing.timestamp.ToUniversalTime().ToString('o')
                }
            }
        }
    }
    $entry = [PSCustomObject][ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
        tool      = $Tool
        target    = $Target
        data      = $Data
        summary   = $Summary
    }
    $findings = @($findings) + $entry
    ($findings | ConvertTo-Json -Depth 12) | Set-Content -LiteralPath $Engagement.FindingsPath
    (ConvertTo-MarkdownReport -Findings $findings) | Set-Content -LiteralPath $Engagement.ReportPath
}
