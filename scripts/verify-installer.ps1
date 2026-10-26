[CmdletBinding()]
param(
  [string]$MakeNsis = '',
  [string]$CertificatePath = '',
  [string]$WindowsKitBin = 'C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
$encoding = New-Object Text.UTF8Encoding($true)
$testDirectory = Join-Path $root ('work\installer-check\' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDirectory -Force | Out-Null
$tokens = $null; $parseErrors = $null
foreach ($source in @(Get-ChildItem -LiteralPath $PSScriptRoot -Recurse -File | Where-Object { $_.Name -match '\.ps1(\.in)?$' })) {
  # Read source as UTF8 explicitly, then parse a BOM copy with Windows PS 5.1.
  $text = [IO.File]::ReadAllText($source.FullName)
  $copy = Join-Path $testDirectory ($source.Name + '.ps1')
  [IO.File]::WriteAllText($copy, $text, $encoding)
  [Management.Automation.Language.Parser]::ParseFile($copy, [ref]$tokens, [ref]$parseErrors) | Out-Null
  if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
}
Write-Host 'PASS: all PowerShell scripts/templates parse.'
& node (Join-Path $PSScriptRoot 'verify-icons.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Icon validation failed.' }

# This is a compilation fixture, NOT a usable package or release installer.
# Never execute the generated EXE or the elevated helper.
$fixture = Join-Path $testDirectory 'fixture'
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
[IO.File]::WriteAllBytes((Join-Path $fixture 'payload.msix'), [Text.Encoding]::ASCII.GetBytes('NSIS compilation fixture - not an MSIX'))
$publicCertificateSource = if ($CertificatePath) { (Resolve-Path -LiteralPath $CertificatePath).Path } else { Join-Path $root 'outputs\小番茄-应用.cer' }
if (Test-Path -LiteralPath $publicCertificateSource) {
  $certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($publicCertificateSource)
} else {
  # After release cleanup only the installer remains in outputs. The existing
  # signing store can supply public bytes without adding/changing certificates.
  $certificate = Get-ChildItem -LiteralPath 'Cert:\CurrentUser\My' | Where-Object {
    $_.Subject -eq 'CN=XiaoFanQie' -and $_.NotAfter -gt (Get-Date)
  } | Sort-Object NotAfter -Descending | Select-Object -First 1
  if (-not $certificate) { throw 'Provide -CertificatePath to an existing public CER for the no-install smoke test.' }
}
[IO.File]::WriteAllBytes((Join-Path $fixture 'publisher.cer'), $certificate.RawData)
$values = @{
  '@@CERT_SHA256@@' = (Get-FileHash -LiteralPath (Join-Path $fixture 'publisher.cer') -Algorithm SHA256).Hash
  '@@CERT_THUMBPRINT@@' = $certificate.Thumbprint
  '@@PACKAGE_SHA256@@' = (Get-FileHash -LiteralPath (Join-Path $fixture 'payload.msix') -Algorithm SHA256).Hash
  '@@PACKAGE_VERSION@@' = '0.2.1.0'
}
foreach ($name in @('trust-certificate', 'install-package')) {
  $content = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "installer\$name.ps1.in"))
  foreach ($token in $values.Keys) { $content = $content.Replace($token, $values[$token]) }
  if ($content -match '@@[A-Z_0-9]+@@') { throw "Unresolved token in $name" }
  $destination = Join-Path $fixture "$name.ps1"
  [IO.File]::WriteAllText($destination, $content, $encoding)
  if ($name -eq 'trust-certificate') { $values['@@HELPER_SHA256@@'] = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash }
}
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
& $powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $fixture 'install-package.ps1') -ValidateOnly
if ($LASTEXITCODE -ne 0) { throw 'Read-only fixture hash validation failed.' }
Write-Host 'PASS: generated payload validates under Windows PowerShell without trust/deployment.'
# Verify that changed certificate bytes are rejected before any trust/deploy
# step, and without a message box that would stall automated build checks.
[IO.File]::WriteAllBytes((Join-Path $fixture 'publisher.cer'), [byte[]]@(0, 1, 2, 3))
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  & $powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $fixture 'install-package.ps1') -ValidateOnly 2>&1 | Out-Null
  $tamperedExit = $LASTEXITCODE
} finally { $ErrorActionPreference = $previousPreference }
if ($tamperedExit -eq 0) { throw 'Tampered certificate was accepted.' }
[IO.File]::WriteAllBytes((Join-Path $fixture 'publisher.cer'), $certificate.RawData)
Write-Host 'PASS: tampered certificate is rejected before elevation/deployment.'

$nsis = if ($MakeNsis) { $MakeNsis } else { Join-Path $env:LOCALAPPDATA 'tauri\NSIS\Bin\makensis.exe' }
& $nsis /V2 "/DPAYLOAD_DIR=$fixture" "/DINSTALLER_OUT=$(Join-Path $testDirectory 'compile-only-do-not-install.exe')" "/DAPP_ICON=$(Join-Path $root 'src-tauri\icons\icon.ico')" /DAPP_VERSION=0.2.1.0 (Join-Path $PSScriptRoot 'installer\bootstrap.nsi')
if ($LASTEXITCODE -ne 0) { throw "NSIS smoke compile failed: $LASTEXITCODE" }
if ((Get-Item -LiteralPath (Join-Path $testDirectory 'compile-only-do-not-install.exe')).VersionInfo.FileVersion -ne '0.2.1.0') {
  throw 'NSIS smoke executable has the wrong version.'
}
Write-Host 'PASS: NSIS bootstrap compiles.'

# Index the actual assets against a staging manifest; this does not build or
# package the app. Dump the PRI to prove altform candidates were recognized.
$resourceStage = Join-Path $testDirectory 'resource-stage'
$assets = Join-Path $resourceStage 'Assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $root 'src-tauri\icons') -File | Where-Object {
  $_.Name -match '^(StoreLogo|Square44x44Logo|Square150x150Logo).*\.png$'
} | Copy-Item -Destination $assets
$manifest = [IO.File]::ReadAllText((Join-Path $root 'src-tauri\manifest\Package.appxmanifest'))
$manifest = $manifest.Replace('$targetnametoken$.exe', 'xiaofanqie.exe')
[IO.File]::WriteAllText((Join-Path $resourceStage 'AppxManifest.xml'), $manifest, $encoding)
& (Join-Path $PSScriptRoot 'new-package-resource-index.ps1') -PackageDirectory $resourceStage -WindowsKitBin $WindowsKitBin
$dump = Join-Path $testDirectory 'resources-pri.xml'
& (Join-Path $WindowsKitBin 'makepri.exe') dump /if (Join-Path $resourceStage 'resources.pri') /of $dump /dt detailed /o | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'PRI dump failed.' }
$dumpText = [IO.File]::ReadAllText($dump)
if ($dumpText -notmatch 'altform-unplated' -or $dumpText -notmatch 'altform-lightunplated' -or $dumpText -notmatch 'targetsize-48') {
  throw 'PRI did not index the expected taskbar icon candidates.'
}
Write-Host 'PASS: MakePRI indexes transparent targetsize/unplated assets.'
Write-Host "Verification artifacts (not a release): $testDirectory"
