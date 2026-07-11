BeforeAll {
    . "$PSScriptRoot/../Public/Invoke-PortScan.ps1"
}

Describe 'Invoke-PlaygroundPortScan' {
    It 'detects an open port' {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
        $listener.Start()
        try {
            $port = $listener.LocalEndpoint.Port
            $results = Invoke-PlaygroundPortScan -TargetHost '127.0.0.1' -Port @($port) -TimeoutSeconds 1.0
            $results.Count | Should -Be 1
            $results[0].open | Should -BeTrue
        } finally {
            $listener.Stop()
        }
    }

    It 'detects a closed port' {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
        $listener.Start()
        $closedPort = $listener.LocalEndpoint.Port
        $listener.Stop()

        $results = Invoke-PlaygroundPortScan -TargetHost '127.0.0.1' -Port @($closedPort) -TimeoutSeconds 1.0
        $results[0].open | Should -BeFalse
    }

    It 'reports "no open ports found" when nothing is open' {
        $text = Format-PlaygroundScanResults -TargetHost '127.0.0.1' -Results @([PSCustomObject]@{ port = 9999; open = $false; banner = $null })
        $text | Should -Match 'no open ports found'
    }
}
