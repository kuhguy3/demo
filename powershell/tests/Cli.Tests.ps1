BeforeAll {
    . "$PSScriptRoot/TestServer.ps1"
    $script:PlaygroundScript = "$PSScriptRoot/../playground.ps1"
    $script:Server = Start-PlaygroundTestServer
    Start-Sleep -Milliseconds 300
}

AfterAll {
    Stop-PlaygroundTestServer -Server $script:Server
}

Describe 'playground.ps1 CLI' {
    It 'records a finding and prints JSON for the headers command' {
        $engagementDir = Join-Path $TestDrive 'eng1'
        $out = & $script:PlaygroundScript headers ($script:Server.BaseUrl + '/') --engagement $engagementDir --json --no-interactive
        $LASTEXITCODE | Should -Be 0

        $payload = ($out -join "`n") | ConvertFrom-Json
        $payload.StatusCode | Should -Be 200

        $findings = Get-Content (Join-Path $engagementDir 'findings.json') -Raw | ConvertFrom-Json
        $findings[0].tool | Should -Be 'headers'
        Test-Path (Join-Path $engagementDir 'report.md') | Should -BeTrue
        Test-Path (Join-Path $engagementDir 'audit.log') | Should -BeTrue
    }

    It 'blocks an out-of-scope target with exit code 1' {
        $engagementDir = Join-Path $TestDrive 'eng2'
        & $script:PlaygroundScript scope init --engagement $engagementDir | Out-Null
        & $script:PlaygroundScript scope add 'only-this-domain.example' --engagement $engagementDir | Out-Null

        & $script:PlaygroundScript headers ($script:Server.BaseUrl + '/') --engagement $engagementDir --json --no-interactive 2>$null
        $LASTEXITCODE | Should -Be 1
    }

    It 'lists authorized targets after scope add' {
        $engagementDir = Join-Path $TestDrive 'eng3'
        & $script:PlaygroundScript scope init --engagement $engagementDir | Out-Null
        & $script:PlaygroundScript scope add 'example.com' --engagement $engagementDir | Out-Null
        $out = & $script:PlaygroundScript scope list --engagement $engagementDir
        ($out -join "`n") | Should -Match 'example.com'
    }
}
