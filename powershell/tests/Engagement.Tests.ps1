BeforeAll {
    . "$PSScriptRoot/../Private/Scope.ps1"
    . "$PSScriptRoot/../Private/Report.ps1"
    . "$PSScriptRoot/../Private/Engagement.ps1"
}

Describe 'PlaygroundEngagement' {
    It 'does not throw when scope is unenforced' {
        $engagement = New-PlaygroundEngagement -Root (Join-Path $TestDrive 'eng1')
        { Assert-PlaygroundAuthorized -Engagement $engagement -Target 'example.com' } | Should -Not -Throw
    }

    It 'throws once scope is enforced and the target is not listed' {
        $engagement = New-PlaygroundEngagement -Root (Join-Path $TestDrive 'eng2')
        Export-PlaygroundScope -Scope $engagement.Scope -Path $engagement.ScopePath
        { Assert-PlaygroundAuthorized -Engagement $engagement -Target 'example.com' } | Should -Throw
    }

    It 'appends JSON-lines audit entries' {
        $engagement = New-PlaygroundEngagement -Root (Join-Path $TestDrive 'eng3')
        Write-PlaygroundAudit -Engagement $engagement -Command 'scan' -CommandArgs @{ host = 'example.com' }
        Write-PlaygroundAudit -Engagement $engagement -Command 'headers' -CommandArgs @{ url = 'https://example.com' }

        $lines = Get-Content $engagement.AuditPath
        $lines.Count | Should -Be 2
        $first = $lines[0] | ConvertFrom-Json
        $first.command | Should -Be 'scan'
        $first.args.host | Should -Be 'example.com'
        $first.timestamp | Should -Not -BeNullOrEmpty
    }

    It 'writes findings.json and a report.md that includes the summary' {
        $engagement = New-PlaygroundEngagement -Root (Join-Path $TestDrive 'eng4')
        Add-PlaygroundFinding -Engagement $engagement -Tool 'scan' -Target 'example.com' -Data @(@{ port = 80; open = $true }) -Summary '80/tcp open'

        $findings = Get-Content $engagement.FindingsPath -Raw | ConvertFrom-Json
        @($findings).Count | Should -Be 1
        $findings[0].tool | Should -Be 'scan'
        $findings[0].target | Should -Be 'example.com'

        $report = Get-Content $engagement.ReportPath -Raw
        $report | Should -Match 'example.com'
        $report | Should -Match '80/tcp open'
    }

    It 'normalizes round-tripped timestamps back to ISO-8601 strings' {
        $engagement = New-PlaygroundEngagement -Root (Join-Path $TestDrive 'eng5')
        Add-PlaygroundFinding -Engagement $engagement -Tool 'scan' -Target 'a' -Data @() -Summary 'first'
        Add-PlaygroundFinding -Engagement $engagement -Tool 'headers' -Target 'b' -Data @{} -Summary 'second'

        $report = Get-Content $engagement.ReportPath -Raw
        $report | Should -Match '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
    }
}
