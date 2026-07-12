# Entry-point mapping: HTML forms/inputs on a page, and hidden content
# surfaced by robots.txt / sitemap.xml.
#
# HTML is parsed with regular expressions rather than a full parser (no
# HtmlAgilityPack dependency) -- good enough for well-formed pages, may miss
# unusual markup that a real DOM parser would catch.
#
# For use only against sites you own or are explicitly authorized to test.

function Find-PlaygroundForms {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Uri, [double]$TimeoutSeconds = 10.0)

    $resp = Invoke-PlaygroundHttpRequest -Uri $Uri -TimeoutSeconds $TimeoutSeconds
    $html = $resp.Body

    $forms = [System.Collections.Generic.List[PSCustomObject]]::new()
    foreach ($formMatch in [regex]::Matches($html, '(?is)<form\b([^>]*)>(.*?)</form>')) {
        $attrs = $formMatch.Groups[1].Value
        $body = $formMatch.Groups[2].Value

        $actionMatch = [regex]::Match($attrs, "action\s*=\s*[""']?([^""'>\s]*)")
        $methodMatch = [regex]::Match($attrs, "method\s*=\s*[""']?([^""'>\s]*)")

        $actionRaw = if ($actionMatch.Success) { $actionMatch.Groups[1].Value } else { '' }
        $method = if ($methodMatch.Success -and $methodMatch.Groups[1].Value) { $methodMatch.Groups[1].Value.ToUpperInvariant() } else { 'GET' }
        $action = if ($actionRaw) { ([Uri]::new([Uri]$resp.Uri, $actionRaw)).ToString() } else { $resp.Uri }

        $inputNames = [System.Collections.Generic.List[string]]::new()
        foreach ($tagMatch in [regex]::Matches($body, '(?is)<(?:input|textarea|select)\b([^>]*)>')) {
            $tagAttrs = $tagMatch.Groups[1].Value
            $nameMatch = [regex]::Match($tagAttrs, "name\s*=\s*[""']?([^""'>\s]*)")
            if ($nameMatch.Success -and $nameMatch.Groups[1].Value) {
                $inputNames.Add($nameMatch.Groups[1].Value)
            }
        }

        $forms.Add([PSCustomObject]@{ action = $action; method = $method; inputs = @($inputNames) })
    }
    return @($forms)
}

function Get-PlaygroundHiddenContent {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$SiteRoot, [double]$TimeoutSeconds = 10.0)

    $siteRoot = $SiteRoot.TrimEnd('/')
    $paths = [System.Collections.Generic.HashSet[string]]::new()

    try {
        $resp = Invoke-PlaygroundHttpRequest -Uri "$siteRoot/robots.txt" -TimeoutSeconds $TimeoutSeconds
        if ($resp.StatusCode -eq 200) {
            foreach ($line in ($resp.Body -split "`n")) {
                $trimmed = $line.Trim()
                if ($trimmed -imatch '^(disallow|allow):\s*(.+)$') {
                    $value = $Matches[2].Trim()
                    if ($value -and $value -ne '/') { [void]$paths.Add($value) }
                }
            }
        }
    } catch {
        # robots.txt unreachable -- skip
    }

    try {
        $resp = Invoke-PlaygroundHttpRequest -Uri "$siteRoot/sitemap.xml" -TimeoutSeconds $TimeoutSeconds
        if ($resp.StatusCode -eq 200) {
            try {
                [xml]$xml = $resp.Body
                foreach ($node in $xml.GetElementsByTagName('loc')) {
                    if ($node.InnerText) { [void]$paths.Add($node.InnerText.Trim()) }
                }
            } catch {
                # not valid XML -- skip
            }
        }
    } catch {
        # sitemap.xml unreachable -- skip
    }

    return @($paths | Sort-Object)
}

function Format-PlaygroundForms {
    [CmdletBinding()]
    param([Parameter(Mandatory)][AllowEmptyCollection()][array]$Forms)

    if ($Forms.Count -eq 0) { return '  no forms found' }
    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($form in $Forms) {
        $inputsText = if ($form.inputs.Count -gt 0) { $form.inputs -join ', ' } else { 'none' }
        $lines.Add("  $($form.method) $($form.action)  inputs: $inputsText")
    }
    return ($lines -join "`n")
}
