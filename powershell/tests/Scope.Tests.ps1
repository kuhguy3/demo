BeforeAll {
    . "$PSScriptRoot/../Private/Scope.ps1"
}

Describe 'PlaygroundScope' {
    It 'authorizes everything when unenforced' {
        $scope = New-PlaygroundScope
        Test-ScopeAuthorized -Scope $scope -Target 'anything.example.com' | Should -BeTrue
        Test-ScopeAuthorized -Scope $scope -Target '10.0.0.1' | Should -BeTrue
    }

    It 'authorizes nothing once enforced with an empty entry list' {
        $path = Join-Path $TestDrive 'scope.json'
        Export-PlaygroundScope -Scope (New-PlaygroundScope) -Path $path
        $scope = Import-PlaygroundScope -Path $path
        $scope.Enforced | Should -BeTrue
        Test-ScopeAuthorized -Scope $scope -Target 'example.com' | Should -BeFalse
    }

    It 'matches a domain and its subdomains' {
        $path = Join-Path $TestDrive 'scope.json'
        $scope = New-PlaygroundScope
        Add-PlaygroundScopeEntry -Scope $scope -Target 'example.com'
        Export-PlaygroundScope -Scope $scope -Path $path
        $loaded = Import-PlaygroundScope -Path $path

        Test-ScopeAuthorized -Scope $loaded -Target 'example.com' | Should -BeTrue
        Test-ScopeAuthorized -Scope $loaded -Target 'www.example.com' | Should -BeTrue
        Test-ScopeAuthorized -Scope $loaded -Target 'https://api.example.com/path' | Should -BeTrue
        Test-ScopeAuthorized -Scope $loaded -Target 'evil.com' | Should -BeFalse
    }

    It 'matches bare IPs and CIDR ranges' {
        $scope = New-PlaygroundScope
        Add-PlaygroundScopeEntry -Scope $scope -Target '10.0.0.0/24'
        Add-PlaygroundScopeEntry -Scope $scope -Target '192.168.1.1'
        $scope.Enforced = $true

        Test-ScopeAuthorized -Scope $scope -Target '10.0.0.5' | Should -BeTrue
        Test-ScopeAuthorized -Scope $scope -Target '10.0.1.5' | Should -BeFalse
        Test-ScopeAuthorized -Scope $scope -Target '192.168.1.1' | Should -BeTrue
        Test-ScopeAuthorized -Scope $scope -Target '192.168.1.2' | Should -BeFalse
    }

    It 'does not add duplicate entries' {
        $scope = New-PlaygroundScope
        Add-PlaygroundScopeEntry -Scope $scope -Target 'example.com'
        Add-PlaygroundScopeEntry -Scope $scope -Target 'example.com'
        @($scope.Entries).Count | Should -Be 1
    }

    It 'requires a CIDR target to be fully contained, not just share a network address' {
        $scope = New-PlaygroundScope
        Add-PlaygroundScopeEntry -Scope $scope -Target '10.0.0.0/28'
        $scope.Enforced = $true

        # equal or narrower ranges (and single hosts) inside the /28 are allowed
        Test-ScopeAuthorized -Scope $scope -Target '10.0.0.0/28' | Should -BeTrue
        Test-ScopeAuthorized -Scope $scope -Target '10.0.0.0/29' | Should -BeTrue
        Test-ScopeAuthorized -Scope $scope -Target '10.0.0.5'    | Should -BeTrue

        # broader ranges sharing the network address are refused
        Test-ScopeAuthorized -Scope $scope -Target '10.0.0.0/24' | Should -BeFalse
        Test-ScopeAuthorized -Scope $scope -Target '10.0.0.0/8'  | Should -BeFalse

        # a same-size range in a different network is refused
        Test-ScopeAuthorized -Scope $scope -Target '10.0.1.0/28' | Should -BeFalse
    }
}
