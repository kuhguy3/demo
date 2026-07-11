BeforeAll {
    . "$PSScriptRoot/../Private/Constants.ps1"
    . "$PSScriptRoot/../Private/Scope.ps1"
    . "$PSScriptRoot/../Private/Report.ps1"
    . "$PSScriptRoot/../Private/Engagement.ps1"
    . "$PSScriptRoot/../Private/Http.ps1"
    . "$PSScriptRoot/../Public/Invoke-HeaderInspection.ps1"
    . "$PSScriptRoot/../Public/Invoke-Fingerprint.ps1"
    . "$PSScriptRoot/../Public/Invoke-EntryPointMap.ps1"
    . "$PSScriptRoot/../Public/Invoke-Fuzz.ps1"
    . "$PSScriptRoot/../Public/Invoke-Crawl.ps1"
    . "$PSScriptRoot/../Public/Invoke-PortScan.ps1"
    . "$PSScriptRoot/../Public/Invoke-HostDiscovery.ps1"
    . "$PSScriptRoot/../Public/Invoke-SubdomainEnum.ps1"
    . "$PSScriptRoot/../Private/Actions.ps1"
    . "$PSScriptRoot/../Private/Interactive.ps1"
    . "$PSScriptRoot/TestServer.ps1"

    $script:Server = Start-PlaygroundTestServer
    Start-Sleep -Milliseconds 300
}

AfterAll {
    Stop-PlaygroundTestServer -Server $script:Server
}

Describe 'Show-PlaygroundMenu' {
    It 'returns the selected zero-based index' {
        Mock Read-Host { '2' }
        Show-PlaygroundMenu -Title 'pick one' -Options @('a', 'b', 'c') | Should -Be 1
    }

    It 'returns $null on "0"' {
        Mock Read-Host { '0' }
        Show-PlaygroundMenu -Title 'pick one' -Options @('a', 'b') | Should -BeNullOrEmpty
    }

    It 'returns $null on blank input' {
        Mock Read-Host { '' }
        Show-PlaygroundMenu -Title 'pick one' -Options @('a', 'b') | Should -BeNullOrEmpty
    }

    It 'returns $null when the choice is out of range' {
        Mock Read-Host { '99' }
        Show-PlaygroundMenu -Title 'pick one' -Options @('a', 'b') | Should -BeNullOrEmpty
    }
}

Describe 'Test-PlaygroundInteractive' {
    It 'is false when -NoInteractive is set' {
        Test-PlaygroundInteractive -NoInteractive -AsJson:$false | Should -BeFalse
    }

    It 'is false when -AsJson is set' {
        Test-PlaygroundInteractive -NoInteractive:$false -AsJson | Should -BeFalse
    }
}

Describe 'Show-PlaygroundUrlDrillDown' {
    It 'dispatches to fingerprint and records a finding' {
        $engagement = New-PlaygroundEngagement -Root (Join-Path $TestDrive 'eng')
        $script:responses = [System.Collections.Generic.Queue[string]]::new(@('1', '0'))
        Mock Read-Host { $script:responses.Dequeue() }

        Show-PlaygroundUrlDrillDown -Engagement $engagement -Uri ($script:Server.BaseUrl + '/') -AsJson:$true

        $findings = Get-Content $engagement.FindingsPath -Raw | ConvertFrom-Json
        ($findings | Where-Object { $_.tool -eq 'fingerprint' }) | Should -Not -BeNullOrEmpty
    }
}
