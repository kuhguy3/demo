# Minimal local HTTP test server used by manual smoke tests and Pester tests.
# Mirrors the routes used by the Python port's tests/conftest.py fixture.

function Start-PlaygroundTestServer {
    [CmdletBinding()]
    param()

    $listener = [System.Net.HttpListener]::new()
    $port = Get-Random -Minimum 20000 -Maximum 40000
    $prefix = "http://127.0.0.1:$port/"
    $listener.Prefixes.Add($prefix)
    $listener.Start()

    $routes = @{
        '/'            = @{ Status = 200; ContentType = 'text/html'; Body = '<html><body><a href="/about">About</a><a href="/secret">shh</a></body></html>' }
        '/about'       = @{ Status = 200; ContentType = 'text/html'; Body = '<html><body>About page</body></html>' }
        '/secret'      = @{ Status = 200; ContentType = 'text/plain'; Body = 'top secret' }
        '/login'       = @{ Status = 200; ContentType = 'text/html'; Body = '<html><body><form action="/do-login" method="post"><input name="username"><input name="password" type="password"></form></body></html>' }
        '/robots.txt'  = @{ Status = 200; ContentType = 'text/plain'; Body = "User-agent: *`nDisallow: /admin`nDisallow: /backup`n" }
        '/sitemap.xml' = @{ Status = 200; ContentType = 'application/xml'; Body = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://example.com/page1</loc></url></urlset>' }
    }

    $job = Start-ThreadJob -ScriptBlock {
        param($listener, $routes)
        while ($listener.IsListening) {
            try {
                $context = $listener.GetContext()
            } catch {
                break
            }
            $request = $context.Request
            $response = $context.Response
            $route = $routes[$request.Url.AbsolutePath]

            if ($route) {
                $response.StatusCode = $route.Status
                $response.ContentType = $route.ContentType
                $response.Headers.Add('Set-Cookie', 'session=abc123')
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($route.Body)
            } else {
                $response.StatusCode = 404
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('not found')
            }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.OutputStream.Close()
        }
    } -ArgumentList $listener, $routes

    return [PSCustomObject]@{
        BaseUrl  = "http://127.0.0.1:$port"
        Listener = $listener
        Job      = $job
    }
}

function Stop-PlaygroundTestServer {
    [CmdletBinding()]
    param([Parameter(Mandatory)][PSCustomObject]$Server)
    $Server.Listener.Stop()
    $Server.Listener.Close()
    Stop-Job -Job $Server.Job -ErrorAction SilentlyContinue
    Remove-Job -Job $Server.Job -Force -ErrorAction SilentlyContinue
}
