BeforeAll {
    . "$PSScriptRoot/../Private/Http.ps1"
    . "$PSScriptRoot/../Public/Invoke-HeaderInspection.ps1"
    . "$PSScriptRoot/../Public/Invoke-Fingerprint.ps1"
    . "$PSScriptRoot/../Public/Invoke-EntryPointMap.ps1"
    . "$PSScriptRoot/../Public/Invoke-Fuzz.ps1"
    . "$PSScriptRoot/../Public/Invoke-Crawl.ps1"
    . "$PSScriptRoot/TestServer.ps1"

    $script:Server = Start-PlaygroundTestServer
    Start-Sleep -Milliseconds 300
}

AfterAll {
    Stop-PlaygroundTestServer -Server $script:Server
}

Describe 'Invoke-PlaygroundInspection' {
    It 'reports status, headers, and cookies' {
        $result = Invoke-PlaygroundInspection -Uri ($script:Server.BaseUrl + '/')
        $result.StatusCode | Should -Be 200
        $result.Cookies['session'] | Should -Be 'abc123'
    }

    It 'reports 404 for a missing page' {
        $result = Invoke-PlaygroundInspection -Uri ($script:Server.BaseUrl + '/missing')
        $result.StatusCode | Should -Be 404
    }
}

Describe 'Invoke-PlaygroundFingerprint' {
    It 'flags all missing security headers on the bare test server' {
        $result = Invoke-PlaygroundFingerprint -Uri ($script:Server.BaseUrl + '/')
        @($result.missing_security_headers).Count | Should -Be 6
        $result.cookies_seen | Should -Contain 'session'
    }
}

Describe 'Invoke-EntryPointMap' {
    It 'finds the login form and its inputs' {
        $forms = Find-PlaygroundForms -Uri ($script:Server.BaseUrl + '/login')
        $forms.Count | Should -Be 1
        $forms[0].method | Should -Be 'POST'
        $forms[0].inputs | Should -Contain 'username'
        $forms[0].inputs | Should -Contain 'password'
    }

    It 'parses robots.txt and sitemap.xml for hidden content' {
        $hidden = Get-PlaygroundHiddenContent -SiteRoot $script:Server.BaseUrl
        $hidden | Should -Contain '/admin'
        $hidden | Should -Contain '/backup'
        $hidden | Should -Contain 'http://example.com/page1'
    }
}

Describe 'Invoke-PlaygroundFuzz' {
    It 'finds a known path and skips 404s in the formatted summary' {
        $results = Invoke-PlaygroundFuzz -BaseUrl $script:Server.BaseUrl -Wordlist @('secret', 'nope') -Delay 0 -Workers 2
        ($results | Where-Object { $_.path -eq 'secret' }).status_code | Should -Be 200
        ($results | Where-Object { $_.path -eq 'nope' }).status_code | Should -Be 404

        $text = Format-PlaygroundFuzzResults -Results $results
        $text | Should -Match 'secret'
        $text | Should -Not -Match 'nope'
    }
}

Describe 'Invoke-PlaygroundCrawl' {
    It 'discovers linked pages on the same domain' {
        $pages = Invoke-PlaygroundCrawl -StartUrl ($script:Server.BaseUrl + '/') -MaxPages 10 -Delay 0
        $pages | Should -Contain ($script:Server.BaseUrl + '/')
        $pages | Should -Contain ($script:Server.BaseUrl + '/about')
    }
}
