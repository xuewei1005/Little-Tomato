[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$PackageDirectory,
  [Parameter(Mandatory = $true)][string]$WindowsKitBin
)
$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path -LiteralPath $PackageDirectory).Path
$makePri = Join-Path $WindowsKitBin 'makepri.exe'
if (-not (Test-Path -LiteralPath $makePri -PathType Leaf)) { throw "Windows SDK makepri.exe not found: $makePri" }
$configPath = Join-Path (Split-Path -Parent $packageRoot) ('priconfig-' + [Guid]::NewGuid().ToString('N') + '.xml')
& $makePri createconfig /cf $configPath /dq zh-CN /pv 10.0.0 /o | ForEach-Object { Write-Host ("$_".Replace([string][char]0, '')) }
if ($LASTEXITCODE -ne 0) { throw "makepri createconfig failed: $LASTEXITCODE" }
$config = [xml][IO.File]::ReadAllText($configPath)
# A single MSIX carries every scale/language candidate. Disable automatic
# resource package splitting, which otherwise requires separate deployments.
foreach ($packaging in @($config.SelectNodes('//packaging'))) { $packaging.ParentNode.RemoveChild($packaging) | Out-Null }
$config.Save($configPath)
& $makePri new /pr $packageRoot /cf $configPath /mn (Join-Path $packageRoot 'AppxManifest.xml') /of (Join-Path $packageRoot 'resources.pri') /o | ForEach-Object { Write-Host ("$_".Replace([string][char]0, '')) }
if ($LASTEXITCODE -ne 0) { throw "makepri new failed: $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath (Join-Path $packageRoot 'resources.pri') -PathType Leaf)) { throw 'MakePRI did not generate resources.pri.' }
