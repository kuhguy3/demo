# Host discovery via ICMP ping sweep.
#
# For use only against networks you own or are explicitly authorized to test.

function Get-CidrHosts {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Cidr)

    $parts = $Cidr -split '/'
    $baseAddress = [System.Net.IPAddress]::Parse($parts[0])
    $prefixLength = if ($parts.Count -gt 1) { [int]$parts[1] } else { 32 }

    $baseBytes = $baseAddress.GetAddressBytes()
    if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($baseBytes) }
    $baseInt = [BitConverter]::ToUInt32($baseBytes, 0)

    $hostBits = 32 - $prefixLength
    if ($hostBits -le 0) { return @($baseAddress.ToString()) }

    $networkInt = $baseInt -band (0xFFFFFFFF -shl $hostBits)
    $count = [Math]::Pow(2, $hostBits)

    $addresses = [System.Collections.Generic.List[string]]::new()
    $first = 1
    $last = [uint32]($count - 2)
    if ($count -le 2) { $first = 0; $last = [uint32]($count - 1) }

    for ($i = $first; $i -le $last; $i++) {
        $hostInt = $networkInt + [uint32]$i
        $bytes = [BitConverter]::GetBytes([uint32]$hostInt)
        if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($bytes) }
        $addresses.Add(([System.Net.IPAddress]::new($bytes)).ToString())
    }
    return $addresses
}

function Invoke-PlaygroundHostDiscovery {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Cidr,
        [int]$TimeoutMs = 1000,
        [int]$Workers = 8,
        [double]$Delay = 0.0
    )

    $hosts = @(Get-CidrHosts -Cidr $Cidr)

    $alive = $hosts | ForEach-Object -ThrottleLimit $Workers -Parallel {
        $targetHost = $_
        $timeoutMs = $using:TimeoutMs
        $delay = $using:Delay

        if ($delay -gt 0) {
            $jitter = Get-Random -Minimum 0.0 -Maximum $delay
            Start-Sleep -Milliseconds ([int](($delay + $jitter) * 1000))
        }

        try {
            $ping = [System.Net.NetworkInformation.Ping]::new()
            $reply = $ping.Send($targetHost, $timeoutMs)
            if ($reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success) {
                $targetHost
            }
        } catch {
            # host unreachable / no route -- not alive
        }
    }

    $result = @($alive | Where-Object { $_ })
    return @($result | Sort-Object { [Version]("{0}.{1}.{2}.{3}" -f ($_ -split '\.')) })
}

function Format-PlaygroundDiscoveryResults {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Cidr, [Parameter(Mandatory)][AllowEmptyCollection()][array]$Hosts)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("Live hosts in ${Cidr}:")
    if ($Hosts.Count -eq 0) {
        $lines.Add('  none responded')
    } else {
        foreach ($h in $Hosts) { $lines.Add("  $h") }
    }
    return ($lines -join "`n")
}
