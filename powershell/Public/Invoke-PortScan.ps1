# TCP connect port scanner.
#
# For use only against hosts you own or are explicitly authorized to test.

$script:DefaultPorts = @(21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 8080, 8443)

function Invoke-PlaygroundPortScan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$TargetHost,
        [int[]]$Port = $script:DefaultPorts,
        [double]$TimeoutSeconds = 0.5,
        [int]$Workers = 10,
        [double]$Delay = 0.0,
        [switch]$GrabBanner
    )

    $grabBannerBool = [bool]$GrabBanner
    $results = $Port | ForEach-Object -ThrottleLimit $Workers -Parallel {
        $targetPort = $_
        $targetHost = $using:TargetHost
        $timeoutMs = [Math]::Max([int]($using:TimeoutSeconds * 1000), 1)
        $delay = $using:Delay
        $grabBanner = $using:grabBannerBool

        if ($delay -gt 0) {
            $jitter = Get-Random -Minimum 0.0 -Maximum $delay
            Start-Sleep -Milliseconds ([int](($delay + $jitter) * 1000))
        }

        $client = [System.Net.Sockets.TcpClient]::new()
        $isOpen = $false
        $banner = $null
        try {
            $connectTask = $client.ConnectAsync($targetHost, $targetPort)
            if ($connectTask.Wait($timeoutMs) -and $client.Connected) {
                $isOpen = $true
                if ($grabBanner) {
                    try {
                        $stream = $client.GetStream()
                        $stream.ReadTimeout = $timeoutMs
                        $buffer = New-Object byte[] 128
                        $read = $stream.Read($buffer, 0, $buffer.Length)
                        if ($read -gt 0) {
                            $banner = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $read).Trim()
                        }
                    } catch {
                        # no banner offered / read timed out -- not fatal
                    }
                }
            }
        } catch {
            # connection refused / timed out -- port is simply closed
        } finally {
            $client.Close()
        }

        [PSCustomObject]@{
            port   = $targetPort
            open   = $isOpen
            banner = $banner
        }
    }

    return @($results | Sort-Object port)
}

function Format-PlaygroundScanResults {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$TargetHost, [Parameter(Mandatory)][AllowEmptyCollection()][array]$Results)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("Scan results for ${TargetHost}:")
    $open = @($Results | Where-Object { $_.open })
    if ($open.Count -eq 0) {
        $lines.Add('  no open ports found')
    } else {
        foreach ($r in ($open | Sort-Object port)) {
            $bannerText = if ($r.banner) { " ($($r.banner))" } else { '' }
            $lines.Add("  $($r.port)/tcp open$bannerText")
        }
    }
    return ($lines -join "`n")
}
