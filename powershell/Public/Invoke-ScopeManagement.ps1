# Engagement scope management: init/add/list authorized targets.

function Initialize-PlaygroundEngagementScope {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement)

    Export-PlaygroundScope -Scope $Engagement.Scope -Path $Engagement.ScopePath
    Write-Host "Initialized scope at $($Engagement.ScopePath) (enforcement is now ON — nothing is authorized yet)."
}

function Add-PlaygroundEngagementScopeTarget {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement, [Parameter(Mandatory)][string]$Target)

    Add-PlaygroundScopeEntry -Scope $Engagement.Scope -Target $Target
    Export-PlaygroundScope -Scope $Engagement.Scope -Path $Engagement.ScopePath
    Write-Host "Authorized '$Target' in $($Engagement.ScopePath)"
}

function Show-PlaygroundEngagementScope {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Engagement)

    if (-not $Engagement.Scope.Enforced) {
        Write-Host "Scope is not enforced (no scope.json found). Run 'scope init' to enable it."
        return
    }
    if ($Engagement.Scope.Entries.Count -eq 0) {
        Write-Host "Scope enforced ($($Engagement.ScopePath)) but empty — nothing is authorized."
        return
    }
    Write-Host "Authorized targets ($($Engagement.ScopePath)):"
    foreach ($entry in $Engagement.Scope.Entries) { Write-Host "  $entry" }
}
