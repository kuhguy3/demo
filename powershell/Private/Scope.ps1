# Engagement scope: restrict tools to explicitly authorized targets.
#
# If no scope file exists for an engagement, scope is unenforced (tools run
# against anything, matching the tool's original behavior). Once a scope
# file exists -- even an empty one -- enforcement is fail-closed: only
# listed targets are authorized.

function New-PlaygroundScope {
    [CmdletBinding()]
    param()
    [PSCustomObject]@{
        Entries  = [System.Collections.Generic.List[string]]::new()
        Enforced = $false
    }
}

function Import-PlaygroundScope {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $scope = New-PlaygroundScope
    if (Test-Path -LiteralPath $Path) {
        $raw = Get-Content -LiteralPath $Path -Raw
        $data = if ([string]::IsNullOrWhiteSpace($raw)) { $null } else { $raw | ConvertFrom-Json }
        if ($data -and $data.authorized) {
            foreach ($entry in @($data.authorized)) { $scope.Entries.Add([string]$entry) }
        }
        $scope.Enforced = $true
    }
    return $scope
}

function Export-PlaygroundScope {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Scope,
        [Parameter(Mandatory)][string]$Path
    )
    $dir = Split-Path -Path $Path -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    @{ authorized = @($Scope.Entries) } | ConvertTo-Json | Set-Content -LiteralPath $Path
    $Scope.Enforced = $true
}

function Add-PlaygroundScopeEntry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCustomObject]$Scope,
        [Parameter(Mandatory)][string]$Target
    )
    if (-not $Scope.Entries.Contains($Target)) {
        $Scope.Entries.Add($Target)
    }
}

function Get-ScopeHost {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Target)

    if ($Target -match '^[a-zA-Z][a-zA-Z0-9+.-]*://') {
        return ([Uri]$Target).Host
    }
    $withoutPath = ($Target -split '/', 2)[0]
    return ($withoutPath -split ':', 2)[0]
}

function Test-IpInCidr {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$IpAddress, [Parameter(Mandatory)][string]$Cidr)

    $parts = $Cidr -split '/'
    if ($parts.Count -ne 2) { return $false }

    try {
        $network = [System.Net.IPAddress]::Parse($parts[0])
        $address = [System.Net.IPAddress]::Parse($IpAddress)
    } catch {
        return $false
    }
    $prefixLength = [int]$parts[1]

    $networkBytes = $network.GetAddressBytes()
    $addressBytes = $address.GetAddressBytes()
    if ($networkBytes.Length -ne $addressBytes.Length) { return $false }

    $fullBytes = [Math]::Floor($prefixLength / 8)
    $remainingBits = $prefixLength % 8

    for ($i = 0; $i -lt $fullBytes; $i++) {
        if ($networkBytes[$i] -ne $addressBytes[$i]) { return $false }
    }
    if ($remainingBits -gt 0 -and $fullBytes -lt $networkBytes.Length) {
        $mask = [byte](0xFF -shl (8 - $remainingBits) -band 0xFF)
        if (($networkBytes[$fullBytes] -band $mask) -ne ($addressBytes[$fullBytes] -band $mask)) {
            return $false
        }
    }
    return $true
}

function Test-CidrContainedInCidr {
    # True only if the ENTIRE target CIDR is contained within the entry CIDR.
    # CIDR blocks are aligned (nested or disjoint, never partially overlapping),
    # so target is a subset of entry iff the entry prefix is the same size or
    # larger (entryPrefix <= targetPrefix) AND the target base falls inside the
    # entry. The prefix-length check is what stops 10.0.0.0/28 from authorizing
    # the broader 10.0.0.0/8.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$TargetCidr, [Parameter(Mandatory)][string]$EntryCidr)

    $tParts = $TargetCidr -split '/'
    $eParts = $EntryCidr -split '/'
    if ($tParts.Count -ne 2 -or $eParts.Count -ne 2) { return $false }
    try {
        $tPrefix = [int]$tParts[1]
        $ePrefix = [int]$eParts[1]
    } catch {
        return $false
    }
    if ($ePrefix -gt $tPrefix) { return $false }
    return Test-IpInCidr -IpAddress $tParts[0] -Cidr $EntryCidr
}

function Test-ScopeEntryMatch {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$TargetHost, [Parameter(Mandatory)][string]$Entry)

    $entryHost = Get-ScopeHost -Target $Entry
    $parsedIp = $null
    $isIp = [System.Net.IPAddress]::TryParse($TargetHost, [ref]$parsedIp)

    if ($isIp) {
        if ($Entry -match '/') {
            return Test-IpInCidr -IpAddress $TargetHost -Cidr $Entry
        }
        return $TargetHost -eq $Entry
    }

    return ($TargetHost -eq $entryHost) -or $TargetHost.EndsWith(".$entryHost")
}

function Test-ScopeAuthorized {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Scope, [Parameter(Mandatory)][string]$Target)

    if (-not $Scope.Enforced) { return $true }

    # A CIDR target (e.g. discover 10.0.0.0/8) must have its WHOLE range fall
    # inside an authorized CIDR, not merely its network address -- otherwise a
    # narrow authorization would green-light a far broader sweep.
    if ($Target -match '^\s*[0-9]{1,3}(\.[0-9]{1,3}){3}\s*/\s*[0-9]{1,2}\s*$') {
        foreach ($entry in $Scope.Entries) {
            if ($entry -match '/' -and (Test-CidrContainedInCidr -TargetCidr $Target -EntryCidr $entry)) {
                return $true
            }
        }
        return $false
    }

    $targetHost = Get-ScopeHost -Target $Target
    foreach ($entry in $Scope.Entries) {
        if (Test-ScopeEntryMatch -TargetHost $targetHost -Entry $entry) { return $true }
    }
    return $false
}
