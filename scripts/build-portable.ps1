[CmdletBinding()]
param(
  [string]$ReleaseExe = '',
  [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$source = if ($ReleaseExe) {
  (Resolve-Path -LiteralPath $ReleaseExe).Path
} else {
  Join-Path $root 'src-tauri\target\release\xiaofanqie.exe'
}
$destinationDirectory = if ($OutputDirectory) {
  [IO.Path]::GetFullPath($OutputDirectory)
} else {
  Join-Path $root 'outputs'
}
$appName = '' + [char]0x5C0F + [char]0x756A + [char]0x8304
$installWord = '' + [char]0x5B89 + [char]0x88C5
$portableName = "$appName-$installWord$([char]0xFF08)v2610-B$([char]0xFF09).exe"
$destination = Join-Path $destinationDirectory $portableName
$manifestPath = Join-Path $root 'src-tauri\manifest\Package.appxmanifest'

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "Release EXE was not found: $source. Run pnpm tauri build --no-bundle first."
}
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Application manifest was not found: $manifestPath"
}

$manifest = [xml][IO.File]::ReadAllText($manifestPath)
$expectedVersion = [version][string]$manifest.Package.Identity.Version
$sourceVersion = [version](Get-Item -LiteralPath $source).VersionInfo.FileVersion
if ($sourceVersion.Revision -lt 0) {
  $sourceVersion = [version]('{0}.{1}.{2}.0' -f $sourceVersion.Major, $sourceVersion.Minor, $sourceVersion.Build)
}
if ($sourceVersion -ne $expectedVersion) {
  throw "Release EXE version $sourceVersion does not match app version $expectedVersion."
}
if ((Get-Item -LiteralPath $source).Length -lt 1024 * 1024) {
  throw 'Release EXE is unexpectedly small; portable packaging stopped.'
}

New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $destination -Force

$obsoleteNames = @(
  "$appName-$installWord$([char]0xFF08)v2610-A$([char]0xFF09).exe",
  "$appName-$installWord.exe",
  "$appName-$([char]0x4FBF)$([char]0x643A).exe",
  "$appName-$([char]0x901A)$([char]0x77E5)$([char]0x7248).msix",
  "$appName-$([char]0x901A)$([char]0x77E5)$([char]0x7248).cer",
  "$appName-$([char]0x901A)$([char]0x77E5)$([char]0x7248)-$([char]0x5B89)$([char]0x88C5)$([char]0x8BF4)$([char]0x660E).txt",
  "$appName-$([char]0x5E94)$([char]0x7528).msix",
  "$appName-$([char]0x5E94)$([char]0x7528).cer",
  "$appName-$([char]0x5E94)$([char]0x7528)-$([char]0x5B89)$([char]0x88C5)$([char]0x8BF4)$([char]0x660E).txt"
)
foreach ($name in $obsoleteNames) {
  $path = Join-Path $destinationDirectory $name
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    Remove-Item -LiteralPath $path -Force
  }
}

$final = Get-Item -LiteralPath $destination
if ($final.Length -ne (Get-Item -LiteralPath $source).Length) {
  throw 'Portable copy size validation failed.'
}
$finalVersion = [version]$final.VersionInfo.FileVersion
if ($finalVersion.Revision -lt 0) {
  $finalVersion = [version]('{0}.{1}.{2}.0' -f $finalVersion.Major, $finalVersion.Minor, $finalVersion.Build)
}
if ($finalVersion -ne $expectedVersion) {
  throw 'Portable file version validation failed.'
}

Write-Host "Portable executable: $destination"
Write-Host "SHA256: $((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash)"
Write-Host 'Old app delivery files were removed; the Todo CSV was preserved.'
