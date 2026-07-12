# Passive technology fingerprinting and security-header review.
#
# For use only against sites you own or are explicitly authorized to test.

$script:SecurityHeaders = @(
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy'
)

$script:HeaderHints = @(
    @{ Header = 'Server'; Needle = 'nginx'; Tech = 'nginx' },
    @{ Header = 'Server'; Needle = 'apache'; Tech = 'Apache' },
    @{ Header = 'Server'; Needle = 'cloudflare'; Tech = 'Cloudflare' },
    @{ Header = 'Server'; Needle = 'microsoft-iis'; Tech = 'IIS' },
    @{ Header = 'X-Powered-By'; Needle = 'php'; Tech = 'PHP' },
    @{ Header = 'X-Powered-By'; Needle = 'asp.net'; Tech = 'ASP.NET' },
    @{ Header = 'X-Powered-By'; Needle = 'express'; Tech = 'Express/Node.js' }
)

$script:CookieHints = @(
    @{ Needle = 'phpsessid'; Tech = 'PHP' },
    @{ Needle = 'jsessionid'; Tech = 'Java/JSP' },
    @{ Needle = 'asp.net_sessionid'; Tech = 'ASP.NET' },
    @{ Needle = 'laravel_session'; Tech = 'Laravel' },
    @{ Needle = 'django'; Tech = 'Django' },
    @{ Needle = '_rails'; Tech = 'Ruby on Rails' }
)

function Invoke-PlaygroundFingerprint {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Uri, [double]$TimeoutSeconds = 10.0)

    $resp = Invoke-PlaygroundHttpRequest -Uri $Uri -TimeoutSeconds $TimeoutSeconds

    $technologies = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($hint in $script:HeaderHints) {
        if ($resp.Headers.Contains($hint.Header)) {
            $value = [string]$resp.Headers[$hint.Header]
            if ($value.ToLowerInvariant().Contains($hint.Needle)) { [void]$technologies.Add($hint.Tech) }
        }
    }
    foreach ($name in $resp.Cookies.Keys) {
        foreach ($hint in $script:CookieHints) {
            if ($name.ToLowerInvariant().Contains($hint.Needle)) { [void]$technologies.Add($hint.Tech) }
        }
    }

    $missing = @($script:SecurityHeaders | Where-Object { -not $resp.Headers.Contains($_) })

    return [PSCustomObject]@{
        uri                     = $resp.Uri
        technologies            = @($technologies | Sort-Object)
        missing_security_headers = $missing
        cookies_seen             = @($resp.Cookies.Keys)
    }
}

function Format-PlaygroundFingerprintResult {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Result)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("Fingerprint for $($Result.uri):")

    $techText = if ($Result.technologies.Count -gt 0) { $Result.technologies -join ', ' } else { 'none detected' }
    $lines.Add("Technologies: $techText")

    if ($Result.cookies_seen.Count -gt 0) {
        $lines.Add('Cookies seen: ' + ($Result.cookies_seen -join ', '))
    }

    $lines.Add('Missing security headers:')
    if ($Result.missing_security_headers.Count -gt 0) {
        foreach ($header in $Result.missing_security_headers) { $lines.Add("  $header") }
    } else {
        $lines.Add('  none — all checked headers present')
    }

    return ($lines -join "`n")
}
