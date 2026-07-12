# DNS-based subdomain enumeration.
#
# For use only against domains you own or are explicitly authorized to test.

$script:DefaultSubdomains = @(
    'www', 'mail', 'ftp', 'api', 'dev', 'staging', 'test', 'admin',
    'portal', 'vpn', 'remote', 'webmail', 'ns1', 'ns2', 'smtp', 'cpanel',
    'blog', 'shop', 'm', 'app', 'cdn', 'static', 'beta', 'internal'
)

function Invoke-PlaygroundSubdomainEnum {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Domain,
        [string[]]$Wordlist = $script:DefaultSubdomains,
        [int]$Workers = 8,
        [double]$Delay = 0.0
    )

    $results = $Wordlist | ForEach-Object -ThrottleLimit $Workers -Parallel {
        $word = $_
        $domain = $using:Domain
        $delay = $using:Delay

        if ($delay -gt 0) {
            $jitter = Get-Random -Minimum 0.0 -Maximum $delay
            Start-Sleep -Milliseconds ([int](($delay + $jitter) * 1000))
        }

        $candidate = "$word.$domain"
        try {
            $addresses = [System.Net.Dns]::GetHostAddresses($candidate)
            if ($addresses.Count -gt 0) {
                [PSCustomObject]@{ host = $candidate; ip = $addresses[0].ToString() }
            }
        } catch {
            # does not resolve -- not a live subdomain
        }
    }

    $found = @($results | Where-Object { $_ })
    return @($found | Sort-Object host)
}

function Format-PlaygroundSubdomainResults {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Domain, [Parameter(Mandatory)][AllowEmptyCollection()][array]$Results)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("Subdomains of ${Domain}:")
    if ($Results.Count -eq 0) {
        $lines.Add('  none found')
    } else {
        foreach ($r in $Results) { $lines.Add("  $($r.host) -> $($r.ip)") }
    }
    return ($lines -join "`n")
}
