# Inspect a URL's response: status, headers, cookies, redirect chain, timing.
#
# For use only against sites you own or are explicitly authorized to test.

function Invoke-PlaygroundInspection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Uri,
        [double]$TimeoutSeconds = 10.0,
        [string]$Method = 'GET'
    )
    return Invoke-PlaygroundHttpRequest -Uri $Uri -TimeoutSeconds $TimeoutSeconds -Method $Method
}

function Format-PlaygroundInspectionResult {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Result)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("$($Result.StatusCode) $($Result.Uri)  ($($Result.ElapsedMs) ms)")

    if ($Result.RedirectChain.Count -gt 0) {
        $chain = @($Result.RedirectChain) + $Result.Uri
        $lines.Add('Redirects: ' + ($chain -join ' -> '))
    }

    $lines.Add('Headers:')
    foreach ($key in $Result.Headers.Keys) {
        $lines.Add("  ${key}: $($Result.Headers[$key])")
    }

    if ($Result.Cookies.Count -gt 0) {
        $lines.Add('Cookies:')
        foreach ($key in $Result.Cookies.Keys) {
            $lines.Add("  $key=$($Result.Cookies[$key])")
        }
    }

    return ($lines -join "`n")
}
