# Render an engagement's accumulated findings into a Markdown report.

function ConvertTo-MarkdownReport {
    [CmdletBinding()]
    param([Parameter(Mandatory)][AllowEmptyCollection()][array]$Findings)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add('# Engagement Report')
    $lines.Add('')
    $lines.Add("Total findings recorded: $($Findings.Count)")
    $lines.Add('')

    $byTarget = [ordered]@{}
    foreach ($finding in $Findings) {
        if (-not $byTarget.Contains($finding.target)) { $byTarget[$finding.target] = [System.Collections.Generic.List[object]]::new() }
        $byTarget[$finding.target].Add($finding)
    }

    foreach ($target in ($byTarget.Keys | Sort-Object)) {
        $lines.Add("## $target")
        $lines.Add('')
        foreach ($finding in $byTarget[$target]) {
            $lines.Add("### $($finding.tool) — $($finding.timestamp)")
            $lines.Add('')
            $lines.Add('```')
            $lines.Add($finding.summary)
            $lines.Add('```')
            $lines.Add('')
        }
    }

    return ($lines -join "`n")
}
