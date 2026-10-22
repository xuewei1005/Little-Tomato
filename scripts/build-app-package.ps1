param(
  [string]$ReleaseExe = '',
  [string]$WindowsKitBin = '',
  [string]$OutputDirectory = '',
  [string]$StageDirectory = '',
  [switch]$SkipInstructions
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$releasePath = if ($ReleaseExe) { (Resolve-Path -LiteralPath $ReleaseExe).Path } else { Join-Path $root 'src-tauri\target\release\xiaofanqie.exe' }
$stage = if ($StageDirectory) { [System.IO.Path]::GetFullPath($StageDirectory) } else { Join-Path $root 'work\app-package' }
$assets = Join-Path $stage 'Assets'
$outputs = if ($OutputDirectory) { [System.IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $root 'outputs' }
$manifestSource = Join-Path $root 'src-tauri\manifest\Package.appxmanifest'
$msixPath = Join-Path $outputs '小番茄-应用.msix'
$cerPath = Join-Path $outputs '小番茄-应用.cer'
$instructionsPath = Join-Path $outputs '小番茄-应用-安装说明.txt'
$kitBin = if ($WindowsKitBin) {
  (Resolve-Path -LiteralPath $WindowsKitBin).Path
} else {
  $latestKit = Get-ChildItem -LiteralPath 'C:\Program Files (x86)\Windows Kits\10\bin' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $latestKit) { throw '找不到 Windows 10 SDK bin 目录，请通过 -WindowsKitBin 指定。' }
  Join-Path $latestKit.FullName 'x64'
}
$makeAppx = Join-Path $kitBin 'makeappx.exe'
$signtool = Join-Path $kitBin 'signtool.exe'

if (-not (Test-Path -LiteralPath $releasePath -PathType Leaf)) { throw "找不到 release EXE：$releasePath，请先执行 pnpm tauri build" }
if (-not (Test-Path -LiteralPath $makeAppx -PathType Leaf)) { throw "找不到 Windows SDK makeappx.exe：$makeAppx" }
if (-not (Test-Path -LiteralPath $signtool -PathType Leaf)) { throw "找不到 Windows SDK signtool.exe：$signtool" }

$resolvedStage = [System.IO.Path]::GetFullPath($stage)
$workPrefix = [System.IO.Path]::GetFullPath((Join-Path $root 'work')).TrimEnd('\') + '\'
if (-not $resolvedStage.StartsWith($workPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw '打包临时目录不在工作目录内，停止清理。' }
if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
New-Item -ItemType Directory -Path $assets -Force | Out-Null
New-Item -ItemType Directory -Path $outputs -Force | Out-Null

Copy-Item -LiteralPath $releasePath -Destination (Join-Path $stage 'xiaofanqie.exe') -Force
Copy-Item -LiteralPath (Join-Path $root 'src-tauri\icons\icon.ico') -Destination (Join-Path $assets 'AppIcon.ico') -Force
foreach ($logo in @('StoreLogo.png', 'Square44x44Logo.png', 'Square150x150Logo.png', 'Square44x44Logo.targetsize-48_altform-unplated.png')) {
  $sourceLogo = Join-Path $root "src-tauri\icons\$logo"
  if (-not (Test-Path -LiteralPath $sourceLogo -PathType Leaf)) { throw "找不到应用图标：$sourceLogo" }
  Copy-Item -LiteralPath $sourceLogo -Destination (Join-Path $assets $logo) -Force
}
# Include all scale/targetsize and unplated variants, not just the manifest's
# fallback images. They must be named relative to Square44x44Logo.png.
Get-ChildItem -LiteralPath (Join-Path $root 'src-tauri\icons') -File | Where-Object {
  $_.Name -match '^(StoreLogo|Square44x44Logo|Square150x150Logo)\..+\.png$'
} | Copy-Item -Destination $assets -Force

$utf8Encoding = New-Object -TypeName System.Text.UTF8Encoding
$manifest = [System.IO.File]::ReadAllText($manifestSource, $utf8Encoding)
$token = [char]36 + 'targetnametoken' + [char]36
$manifest = $manifest.Replace($token + '.exe', 'xiaofanqie.exe')
if ($manifest.Contains($token)) { throw 'staging manifest 仍然包含 AppX executable token，停止打包' }
[System.IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'), $manifest, $utf8Encoding)

# Filename qualifiers alone are insufficient: index them so the shell can
# resolve targetsize/altform candidates rather than applying an orange plate.
& (Join-Path $PSScriptRoot 'new-package-resource-index.ps1') -PackageDirectory $stage -WindowsKitBin $kitBin

if (Test-Path -LiteralPath $msixPath) { Remove-Item -LiteralPath $msixPath -Force }
& $makeAppx pack /d $stage /p $msixPath /o
if ($LASTEXITCODE -ne 0) { throw "makeappx pack 失败，退出码：$LASTEXITCODE" }

# Keep the non-exportable signing key in the Windows personal store so app updates keep one identity.
$certificate = Get-ChildItem -Path 'Cert:\CurrentUser\My' | Where-Object {
  $_.Subject -eq 'CN=XiaoFanQie' -and $_.FriendlyName -eq '小番茄应用签名' -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddMonths(3)
} | Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $certificate) {
  $certificate = New-SelfSignedCertificate -Type Custom -KeyUsage DigitalSignature -Subject 'CN=XiaoFanQie' -FriendlyName '小番茄应用签名' -CertStoreLocation 'Cert:\CurrentUser\My' -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}') -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears(3)
}
& $signtool sign /fd SHA256 /sha1 $certificate.Thumbprint /tr http://timestamp.digicert.com /td SHA256 $msixPath
if ($LASTEXITCODE -ne 0) { throw "signtool sign 失败，退出码：$LASTEXITCODE" }
Export-Certificate -Cert $certificate -FilePath $cerPath -Type CERT | Out-Null

$instructions = @"
小番茄安装说明

安装器会自动处理应用包和签名证书。如果直接双击 MSIX，Windows 可能会显示证书错误，因此建议使用随包提供的“小番茄-安装.exe”。

图形界面安装步骤：
1. 确认“小番茄-应用.cer”和“小番茄-应用.msix”来自同一个压缩包/同一个输出目录。
2. 右键“小番茄-应用.cer”，选择“安装证书”。
3. 选择“本地计算机”，在 Windows 管理员提示中确认。
4. 选择“将所有的证书都放入下列存储”，点击“浏览”，选择“受信任的人”，完成导入。
5. 关闭已经打开的 MSIX 安装窗口，再重新双击“小番茄-应用.msix”安装；发布者应显示为 CN=XiaoFanQie。
6. 安装完成后，可从开始菜单或桌面快捷方式打开“小番茄”。

如果图形界面仍然提示证书错误，先在管理员 PowerShell 中执行（先切换到交付文件夹）：
Import-Certificate -FilePath '.\小番茄-应用.cer' -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople'

然后关闭管理员 PowerShell，在原登录用户的普通 PowerShell 中执行（不要以其他管理员账户部署）：
Add-AppxPackage -Path '.\小番茄-应用.msix'

注意：证书要放在“本地计算机 > 受信任的人”，只导入“当前用户”可能仍不能安装。证书是本地自签名证书；换一台电脑时，需要在那台电脑上重新导入随包的 .cer。若导入过旧证书，请使用本次输出目录中的 .cer 与 .msix 配对安装。
本次证书指纹：$($certificate.Thumbprint)
微软安装说明：https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide#testing-distribute-to-testers-with-a-self-signed-certificate

安全说明：
- 证书文件只含公钥；签名私钥不会放入交付目录。
- 应用只在本地保存 Todo、设置和宠物状态，不读取聊天记录或系统通知。

卸载命令（可选）：
Get-AppxPackage -Name com.xiaofanqie.desktop | Remove-AppxPackage
"@
if (-not $SkipInstructions) { Set-Content -LiteralPath $instructionsPath -Value $instructions -Encoding UTF8 }

Write-Host "应用包已生成：$msixPath"
Write-Host "证书已导出：$cerPath"
if (-not $SkipInstructions) { Write-Host "安装说明已生成：$instructionsPath" }
