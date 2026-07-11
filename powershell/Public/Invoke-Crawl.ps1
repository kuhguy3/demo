# Minimal same-domain crawler for mapping a site's link graph.
#
# For use only against sites you own or are explicitly authorized to test.

function Get-PlaygroundLinks {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Html, [Parameter(Mandatory)][string]$BaseUri)

    $links = [System.Collections.Generic.List[string]]::new()
    foreach ($m in [regex]::Matches($Html, "(?is)<a\b[^>]*href\s*=\s*[""']?([^""'>\s]*)")) {
        $href = $m.Groups[1].Value
        if (-not $href) { continue }
        try {
            $resolved = [Uri]::new([Uri]$BaseUri, $href)
            $links.Add($resolved.ToString())
        } catch {
            # malformed href -- skip
        }
    }
    return @($links)
}

function Invoke-PlaygroundCrawl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$StartUrl,
        [int]$MaxPages = 25,
        [double]$TimeoutSeconds = 5.0,
        [double]$Delay = 0.2
    )

    $domain = ([Uri]$StartUrl).Host
    $visited = [System.Collections.Generic.HashSet[string]]::new()
    $queue = [System.Collections.Generic.List[string]]::new()
    $queue.Add($StartUrl)
    $discovered = [System.Collections.Generic.List[string]]::new()

    while ($queue.Count -gt 0 -and $visited.Count -lt $MaxPages) {
        $url = $queue[0]
        $queue.RemoveAt(0)
        if ($visited.Contains($url)) { continue }
        [void]$visited.Add($url)

        if ($Delay -gt 0 -and $discovered.Count -gt 0) {
            Start-Sleep -Milliseconds ([int]($Delay * 1000))
        }

        try {
            $resp = Invoke-PlaygroundHttpRequest -Uri $url -TimeoutSeconds $TimeoutSeconds
        } catch {
            continue
        }
        $discovered.Add($url)

        $contentType = if ($resp.Headers.Contains('Content-Type')) { [string]$resp.Headers['Content-Type'] } else { '' }
        if ($contentType -notmatch 'text/html') { continue }

        foreach ($link in (Get-PlaygroundLinks -Html $resp.Body -BaseUri $url)) {
            $parsed = [Uri]$link
            $builder = [UriBuilder]::new($parsed)
            $builder.Fragment = ''
            $cleanUrl = $builder.Uri.ToString().TrimEnd('#')

            if ($parsed.Host -eq $domain -and -not $visited.Contains($cleanUrl)) {
                $queue.Add($cleanUrl)
            }
        }
    }

    return @($discovered)
}

function Format-PlaygroundCrawlResults {
    [CmdletBinding()]
    param([Parameter(Mandatory)][AllowEmptyCollection()][array]$Pages)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("Discovered $($Pages.Count) page(s):")
    foreach ($p in $Pages) { $lines.Add("  $p") }
    return ($lines -join "`n")
}
