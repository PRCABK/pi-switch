param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
node "$PSScriptRoot/release.mjs" $Version
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
