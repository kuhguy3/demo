# Shared HTTP request helper: follows redirects manually so the full chain,
# final headers, and cookies are all inspectable (mirrors Python's
# `requests.get(..., allow_redirects=True)` + `response.history`).

function Invoke-PlaygroundHttpRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Uri,
        [string]$Method = 'GET',
        [double]$TimeoutSeconds = 10.0,
        [int]$MaxRedirects = 10
    )

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $cookieContainer = [System.Net.CookieContainer]::new()
    $handler.CookieContainer = $cookieContainer
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)

    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $currentUri = [Uri]$Uri
        $redirectChain = [System.Collections.Generic.List[string]]::new()
        $response = $null

        for ($i = 0; $i -le $MaxRedirects; $i++) {
            $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $currentUri)
            $response = $client.SendAsync($request).GetAwaiter().GetResult()

            $statusInt = [int]$response.StatusCode
            if ($statusInt -ge 300 -and $statusInt -lt 400 -and $response.Headers.Location) {
                $redirectChain.Add($currentUri.ToString())
                $location = $response.Headers.Location
                $currentUri = if ($location.IsAbsoluteUri) { $location } else { [Uri]::new($currentUri, $location) }
                continue
            }
            break
        }
        $stopwatch.Stop()

        $headers = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::OrdinalIgnoreCase)
        foreach ($h in $response.Headers) { $headers[$h.Key] = ($h.Value -join ', ') }
        foreach ($h in $response.Content.Headers) { $headers[$h.Key] = ($h.Value -join ', ') }

        $cookies = [ordered]@{}
        foreach ($c in $cookieContainer.GetCookies($currentUri)) { $cookies[$c.Name] = $c.Value }

        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

        return [PSCustomObject]@{
            Uri           = $currentUri.ToString()
            StatusCode    = [int]$response.StatusCode
            ElapsedMs     = [Math]::Round($stopwatch.Elapsed.TotalMilliseconds, 1)
            Headers       = $headers
            Cookies       = $cookies
            RedirectChain = @($redirectChain)
            Body          = $body
        }
    } finally {
        $client.Dispose()
        $handler.Dispose()
    }
}
