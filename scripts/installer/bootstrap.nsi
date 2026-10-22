Unicode true
!include "LogicLib.nsh"
!include "x64.nsh"

!define MUI_ICON "${APP_ICON}"
!define MUI_BGCOLOR "FFF8F5"
!define MUI_TEXTCOLOR "302A2A"
!define MUI_INSTFILESPAGE_COLORS "302A2A FFF8F5"
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "小番茄已经准备好了"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "专注、休息和 Todo 都会在桌面陪着你。"
!include "MUI2.nsh"

!ifndef PAYLOAD_DIR
  !error "PAYLOAD_DIR is required"
!endif
!ifndef INSTALLER_OUT
  !error "INSTALLER_OUT is required"
!endif
!ifndef APP_ICON
  !error "APP_ICON is required"
!endif
!ifndef APP_VERSION
  !define APP_VERSION "0.2.0.0"
!endif

Name "小番茄"
OutFile "${INSTALLER_OUT}"
Icon "${APP_ICON}"
RequestExecutionLevel user
ManifestDPIAware true
SetCompressor /SOLID lzma
VIProductVersion "${APP_VERSION}"
VIAddVersionKey /LANG=2052 "ProductName" "小番茄"
VIAddVersionKey /LANG=2052 "FileDescription" "小番茄应用安装器"
VIAddVersionKey /LANG=2052 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=2052 "LegalCopyright" "小番茄"
ShowInstDetails nevershow
AutoCloseWindow true

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Install"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "${PAYLOAD_DIR}\payload.msix"
  File "${PAYLOAD_DIR}\publisher.cer"
  File "${PAYLOAD_DIR}\install-package.ps1"
  File "${PAYLOAD_DIR}\trust-certificate.ps1"
  ; Native 64-bit Windows PowerShell provides the Appx deployment module.
  ${If} ${RunningX64}
    StrCpy $0 "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  ${Else}
    StrCpy $0 "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
  ${EndIf}
  ClearErrors
  ExecWait '"$0" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "$PLUGINSDIR\install-package.ps1" -SilentUi' $1
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "无法启动 Windows PowerShell，安装未完成。"
    SetErrorLevel 1
    Abort
  ${EndIf}
  ${If} $1 != 0
    MessageBox MB_OK|MB_ICONSTOP "小番茄没有安装完成。`r`n`r`n可以重新双击安装器再试一次；详细日志保存在：`r`n%LOCALAPPDATA%\XiaoFanQie\Installer\Logs"
    SetErrorLevel $1
    Abort
  ${EndIf}
  SetErrorLevel 0
SectionEnd
