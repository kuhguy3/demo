# Simple wordlist-based path fuzzer.
#
# For use only against sites you own or are explicitly authorized to test.
# Requests are paced with a jittered delay by default to avoid hammering
# the target; tune -Delay/-Workers deliberately.

$script:DefaultFuzzWordlist = @(
    'admin', 'login', 'api', 'backup', 'config', 'dashboard', 'debug',
    'test', '.env', 'robots.txt', 'sitemap.xml', '.git/HEAD', 'uploads', 'wp-admin'
)

function Invoke-PlaygroundFuzz {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [string[]]$Wordlist = $script:DefaultFuzzWordlist,
        [double]$TimeoutSeconds = 5.0,
        [int]$Workers = 3,
        [double]$Delay = 0.3
    )

    $trimmedBase = $BaseUrl.TrimEnd('/')

    $results = $Wordlist | ForEach-Object -ThrottleLimit $Workers -Parallel {
        $word = $_
        $base = $using:trimmedBase
        $timeoutSeconds = $using:TimeoutSeconds
        $delay = $using:Delay

        if ($delay -gt 0) {
            $jitter = Get-Random -Minimum 0.0 -Maximum $delay
            Start-Sleep -Milliseconds ([int](($delay + $jitter) * 1000))
        }

        $url = "$base/$word"
        $statusCode = $null
        $length = $null
        $handler = [System.Net.Http.HttpClientHandler]::new()
        $handler.AllowAutoRedirect = $false
        $client = [System.Net.Http.HttpClient]::new($handler)
        $client.Timeout = [TimeSpan]::FromSeconds($timeoutSeconds)
        try {
            $resp = $client.GetAsync($url).GetAwaiter().GetResult()
            $statusCode = [int]$resp.StatusCode
            $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
            $length = $bytes.Length
        } catch {
            # request failed -- leave status/length null
        } finally {
            $client.Dispose()
            $handler.Dispose()
        }

        [PSCustomObject]@{ path = $word; url = $url; status_code = $statusCode; length = $length }
    }

    return @($results | Sort-Object path)
}

function Format-PlaygroundFuzzResults {
    [CmdletBinding()]
    param([Parameter(Mandatory)][AllowEmptyCollection()][array]$Results)

    $interesting = @($Results | Where-Object { $null -eq $_.status_code -or $_.status_code -ne 404 })
    if ($interesting.Count -eq 0) { return '  no interesting paths found' }

    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($r in $interesting) {
        if ($null -eq $r.status_code) {
            $lines.Add("  $($r.path.PadRight(20)) ERROR")
        } else {
            $lines.Add("  $($r.path.PadRight(20)) $($r.status_code) ($($r.length) bytes)")
        }
    }
    return ($lines -join "`n")
}
