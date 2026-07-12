# Root module: dot-sources every Private/Public function so they share one
# session state (needed for cross-function calls like Actions.ps1 calling
# the Public tool functions), then exports the Public ones.

$privateFiles = Get-ChildItem -Path (Join-Path $PSScriptRoot 'Private') -Filter '*.ps1' -File
$publicFiles = Get-ChildItem -Path (Join-Path $PSScriptRoot 'Public') -Filter '*.ps1' -File

foreach ($file in $privateFiles) { . $file.FullName }
foreach ($file in $publicFiles) { . $file.FullName }

# Each Public/*.ps1 file may define more than one function (e.g. a tool
# function plus its Format-* helper), so export everything rather than
# trying to derive names from filenames.
Export-ModuleMember -Function *
