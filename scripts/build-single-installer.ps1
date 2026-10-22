[CmdletBinding()]
param(
  [string]$ReleaseExe = '',
  [string]$WindowsKitBin = '',
  [string]$MakeNsis = '',
  [string]$OutputDirectory = '',
  # Optional prebuilt pair. Both must be supplied; stale versions are rejected.
  [string]$MsixPath = '',
  [string]$CertificatePath = '',
  # Keeps all generated payloads and the compiled EXE under work for review.
  [switch]$StageOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
$encoding = New-Object System.Text.UTF8Encoding($true)
$sourceManifest = [xml][IO.File]::ReadAllText((Join-Path $root 'src-tauri\manifest\Package.appxmanifest'))
$identity = $sourceManifest.Package.Identity
$version = [string]$identity.Version
if ($identity.Name -ne 'com.xiaofanqie.desktop' -or $identity.Publisher -ne 'CN=XiaoFanQie' -or $version -notmatch '^\d+\.\d+\.\d+\.\d+$') {
  throw 'Unexpected MSIX identity or version in Package.appxmanifest.'
}
if ([bool]$MsixPath -ne [bool]$CertificatePath) { throw 'Supply both -MsixPath and -CertificatePath, or neither.' }
$nsis = if ($MakeNsis) { (Resolve-Path -LiteralPath $MakeNsis).Path } else {
  Join-Path $env:LOCALAPPDATA 'tauri\NSIS\Bin\makensis.exe'
}
if (-not (Test-Path -LiteralPath $nsis -PathType Leaf)) { throw "NSIS compiler not found: $nsis" }
$buildDirectory = Join-Path $root ('work\single-installer\' + [Guid]::NewGuid().ToString('N'))
$payloadDirectory = Join-Path $buildDirectory 'payload'
New-Item -ItemType Directory -Path $payloadDirectory -Force | Out-Null
$compiled = Join-Path $buildDirectory '小番茄-安装.exe'

if (-not $MsixPath) {
  # This packages an EXISTING release EXE; it never invokes cargo/tauri build.
  $releasePath = if ($ReleaseExe) { (Resolve-Path -LiteralPath $ReleaseExe).Path } else {
    Join-Path $root 'src-tauri\target\release\xiaofanqie.exe'
  }
  if (-not (Test-Path -LiteralPath $releasePath -PathType Leaf)) { throw "Build the release executable first: $releasePath" }
  $fileVersion = (Get-Item -LiteralPath $releasePath).VersionInfo.FileVersion
  # Tauri may expose FileVersion as 0.2.0 while MSIX requires 0.2.0.0.
  $normalizedFileVersion = [version]$fileVersion
  if ($normalizedFileVersion.Revision -lt 0) {
    $normalizedFileVersion = [version]('{0}.{1}.{2}.0' -f $normalizedFileVersion.Major, $normalizedFileVersion.Minor, $normalizedFileVersion.Build)
  }
  if ($normalizedFileVersion -ne [version]$version) {
    throw "Release executable version $fileVersion does not match MSIX $version. Rebuild the app before packaging."
  }
  $packageDirectory = Join-Path $buildDirectory 'signed-package'
  & (Join-Path $PSScriptRoot 'build-app-package.ps1') -ReleaseExe $releasePath -WindowsKitBin $WindowsKitBin -OutputDirectory $packageDirectory -StageDirectory (Join-Path $buildDirectory 'msix-stage') -SkipInstructions
  $MsixPath = Join-Path $packageDirectory '小番茄-应用.msix'
  $CertificatePath = Join-Path $packageDirectory '小番茄-应用.cer'
}
Copy-Item -LiteralPath (Resolve-Path -LiteralPath $MsixPath).Path -Destination (Join-Path $payloadDirectory 'payload.msix')
Copy-Item -LiteralPath (Resolve-Path -LiteralPath $CertificatePath).Path -Destination (Join-Path $payloadDirectory 'publisher.cer')
$payloadMsix = Join-Path $payloadDirectory 'payload.msix'
$payloadCert = Join-Path $payloadDirectory 'publisher.cer'
$certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($payloadCert)
if ($certificate.Subject -ne [string]$identity.Publisher -or $certificate.HasPrivateKey) { throw 'The bundled CER must contain only the publisher public certificate.' }
if ($certificate.NotBefore -gt (Get-Date) -or $certificate.NotAfter -le (Get-Date)) { throw 'The signing certificate is not currently valid.' }

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Security
$zip = [IO.Compression.ZipFile]::OpenRead($payloadMsix)
try {
  $entry = $zip.GetEntry('AppxManifest.xml')
  if (-not $entry) { throw 'Missing AppxManifest.xml.' }
  $reader = New-Object IO.StreamReader($entry.Open())
  try { $packageManifest = [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
  if ($packageManifest.Package.Identity.Name -ne $identity.Name -or $packageManifest.Package.Identity.Publisher -ne $identity.Publisher -or $packageManifest.Package.Identity.Version -ne $version) {
    throw 'Prebuilt MSIX identity/version does not match the source manifest; rebuild the MSIX.'
  }
  $application = $packageManifest.Package.Applications.Application
  if ($application.Id -ne 'App' -or $application.Executable -ne 'xiaofanqie.exe') { throw 'Unexpected packaged application ID/executable.' }
  $visuals = $application.SelectSingleNode('*[local-name()="VisualElements"]')
  if ($visuals.BackgroundColor -ne 'transparent' -or $visuals.Square44x44Logo -ne 'Assets\Square44x44Logo.png' -or $visuals.Square150x150Logo -ne 'Assets\Square150x150Logo.png') {
    throw 'The MSIX does not use the transparent icon manifest.'
  }
  foreach ($name in @('resources.pri', 'Assets/StoreLogo.png', 'Assets/Square44x44Logo.png', 'Assets/Square150x150Logo.png', 'Assets/AppIcon.ico')) {
    if (-not $zip.GetEntry($name)) { throw "MSIX is missing $name" }
  }
  foreach ($size in @(16, 20, 24, 30, 32, 36, 40, 44, 48, 60, 64, 72, 80, 96, 128, 256)) {
    foreach ($form in @('', '_altform-unplated', '_altform-lightunplated')) {
      $name = "Assets/Square44x44Logo.targetsize-$size$form.png"
      if (-not $zip.GetEntry($name)) { throw "MSIX is missing $name" }
    }
  }
  # Check the embedded PKCS#7 signature and the exact signing public key
  # without adding certificates to the build machine's trusted stores.
  $signatureEntry = $zip.GetEntry('AppxSignature.p7x')
  if (-not $signatureEntry) { throw 'The MSIX is unsigned.' }
  $signatureStream = $signatureEntry.Open()
  $memory = New-Object IO.MemoryStream
  try { $signatureStream.CopyTo($memory); $signatureBytes = $memory.ToArray() }
  finally { $signatureStream.Dispose(); $memory.Dispose() }
  if ([Text.Encoding]::ASCII.GetString($signatureBytes, 0, 4) -ne 'PKCX') { throw 'Invalid MSIX signature header.' }
  $cms = New-Object Security.Cryptography.Pkcs.SignedCms
  $cms.Decode([byte[]]$signatureBytes[4..($signatureBytes.Length - 1)])
  $cms.CheckSignature($true)
  if ($cms.SignerInfos.Count -ne 1 -or $cms.SignerInfos[0].Certificate.Thumbprint -ne $certificate.Thumbprint) {
    throw 'MSIX signer and bundled certificate do not match.'
  }
} finally { $zip.Dispose() }
# Windows checks the signed package content again when Add-AppxPackage runs.
# Reject digest failures now when the local trust provider reports one.
$authenticode = Get-AuthenticodeSignature -LiteralPath $payloadMsix
if ($authenticode.Status -in @('HashMismatch', 'NotSigned', 'NotSupported')) {
  throw "MSIX signature validation failed: $($authenticode.StatusMessage)"
}

$replacements = @{
  '@@CERT_SHA256@@' = (Get-FileHash -LiteralPath $payloadCert -Algorithm SHA256).Hash
  '@@CERT_THUMBPRINT@@' = $certificate.Thumbprint
  '@@PACKAGE_SHA256@@' = (Get-FileHash -LiteralPath $payloadMsix -Algorithm SHA256).Hash
  '@@PACKAGE_VERSION@@' = $version
}
function Write-InstallerTemplate([string]$Name, [string]$Destination) {
  $content = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "installer\$Name"))
  foreach ($token in $replacements.Keys) { $content = $content.Replace($token, $replacements[$token]) }
  if ($content -match '@@[A-Z_0-9]+@@') { throw "Unresolved template token in $Name" }
  # Windows PowerShell 5.1 needs a BOM for Chinese messages and paths.
  [IO.File]::WriteAllText($Destination, $content, $encoding)
  $tokens = $null; $parseErrors = $null
  [Management.Automation.Language.Parser]::ParseFile($Destination, [ref]$tokens, [ref]$parseErrors) | Out-Null
  if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
}
$helper = Join-Path $payloadDirectory 'trust-certificate.ps1'
Write-InstallerTemplate 'trust-certificate.ps1.in' $helper
$replacements['@@HELPER_SHA256@@'] = (Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash
$installScript = Join-Path $payloadDirectory 'install-package.ps1'
Write-InstallerTemplate 'install-package.ps1.in' $installScript
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
& $powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $installScript -ValidateOnly
if ($LASTEXITCODE -ne 0) { throw 'Generated installer payload validation failed.' }
& $nsis /V3 "/DPAYLOAD_DIR=$payloadDirectory" "/DINSTALLER_OUT=$compiled" "/DAPP_ICON=$(Join-Path $root 'src-tauri\icons\icon.ico')" "/DAPP_VERSION=$version" (Join-Path $PSScriptRoot 'installer\bootstrap.nsi')
if ($LASTEXITCODE -ne 0) { throw "NSIS compilation failed: $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $compiled -PathType Leaf) -or (Get-Item -LiteralPath $compiled).Length -lt 1024) { throw 'NSIS did not generate an installer.' }
if ((Get-Item -LiteralPath $compiled).VersionInfo.FileVersion -ne $version) { throw 'Compiled installer version mismatch.' }
$verifiedHash = (Get-FileHash -LiteralPath $compiled -Algorithm SHA256).Hash
Write-Host "Verified staged installer: $compiled"
Write-Host "SHA256: $verifiedHash"
if (-not $StageOnly) {
  $destinationDirectory = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $root 'outputs' }
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  $destination = Join-Path $destinationDirectory '小番茄-安装.exe'
  Copy-Item -LiteralPath $compiled -Destination $destination -Force
  if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $verifiedHash) { throw 'Final installer copy hash mismatch.' }
  Write-Host "Single-file installer: $destination"
  Write-Host 'Existing output files and user CSV files were preserved. Retire old deliverables only after acceptance testing.'
}
