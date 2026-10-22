# Windows delivery builds

## Current portable delivery

The user-facing release is now a direct-launch portable executable:

```powershell
pnpm tauri build --no-bundle
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-portable.ps1
```

This produces `outputs\小番茄-安装（v2610-A）.exe`. It does not install an MSIX,
import a certificate, request UAC, or create shortcuts. `outputs\小番茄-Todo.csv`
is preserved as the optional Todo sync file. The old NSIS/MSIX path below is kept
for packaging regression checks only and is not part of the user-facing output.

## Historical single installer build

The SVG in `src-tauri/icons/icon.svg` is the icon source. The generator uses the
local Tauri CLI plus `sharp` (local package, `XIAOFANQIE_SHARP_MODULE`, or the
bundled Codex runtime). No image generation service is used.

```powershell
node scripts/generate-icons.mjs
# After the main app changes and all 0.2.0 version bumps are ready:
pnpm tauri build --no-bundle
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-single-installer.ps1
```

The packaging script **does not build the app**. It refuses an EXE whose file
version differs from the MSIX manifest (0.2.0.0). It packages/signs the existing
release EXE into a unique directory below `work/single-installer`, compiles the
bootstrap with `%LOCALAPPDATA%\tauri\NSIS\Bin\makensis.exe`, validates its
embedded payload and version, and copies only `小番茄-安装.exe` into `outputs`.
It does not remove earlier deliverables or any CSV/user data. The final release
handoff should contain that one EXE and the user's preserved CSV, after the main
owner verifies the new package and retires obsolete output files.

The bootstrap uses the NSIS Modern UI single install page. It starts installing
as soon as the EXE opens, hides the legacy detail/log pane, runs the PowerShell
payload without opening a second console or success dialog, and closes the
installer automatically after a successful deployment. A failure still shows a
short recovery message and keeps the detailed log under the user's local
`XiaoFanQie\Installer\Logs` directory.

Options: `-ReleaseExe`, `-WindowsKitBin`, `-MakeNsis`, `-OutputDirectory`;
`-StageOnly` leaves the reviewed EXE in `work` without publishing it to outputs.
To wrap an already signed package, provide both `-MsixPath` and
`-CertificatePath`; its identity, version, transparent manifest, unplated assets,
public certificate and embedded signature are checked before compilation.

The standalone `build-app-package.ps1` can build the signed application package
for inspection. Its `-OutputDirectory`, `-StageDirectory` (must be under
`work`), and `-SkipInstructions` options let this bootstrap keep MSIX/CER files
internal.
`new-package-resource-index.ps1` uses the SDK's MakePRI to include one
`resources.pri`, so Windows actually resolves scale/targetsize/altform candidates.

## Runtime identity and permissions

NSIS requests the normal user's token. The main PowerShell process records its
SID and refuses elevated/SYSTEM launches with an instruction to double-click
normally. A user who has already switched to a different administrator account
must return to the intended account before starting the installer. The script
never guesses an interactive user or deploys through administrator credentials.

Only when the exact public certificate is missing from
`LocalMachine\TrustedPeople` does it invoke `trust-certificate.ps1` using UAC.
That helper verifies the build-pinned SHA256, thumbprint, publisher and validity;
it imports only the bundled certificate into that one store. It never installs
an application, changes system policy, or removes existing certificates.
The original unelevated process waits, verifies the certificate and SID again,
then invokes `Add-AppxPackage` for the current user. UAC cancellation or deployment
errors stop installation with a visible message and a persistent log under
`%LOCALAPPDATA%\XiaoFanQie\Installer\Logs`.

MSIX registration supplies the native Start menu entry. Additional desktop and
Start menu links invoke `explorer.exe shell:AppsFolder\<PackageFamilyName>!App`
and use a packaged ICO. No shortcut launches the unpackaged executable.
The application package contains only the permissions required for the local
pet, window and Todo features. It does not request system notification access.

## Verification before release

Run `scripts/verify-installer.ps1` for parsing, icon alpha/asset checks and an
NSIS compilation smoke test in `work`. It does not build, trust or deploy the app.
After the main app is built, use `-StageOnly` for a real package validation and
installer compile. Test ordinary launch, existing certificate (no UAC), missing
certificate with same-account/alternate-admin UAC, UAC cancellation, manual
elevated launch, reinstallation, update and newer-version rejection in suitable
test accounts/VMs. Verify the package appears for the **original** user's SID,
both shortcuts activate its AUMID. Actual account/UAC/deployment tests are not
replaced by compilation.

Windows references: [icon asset naming](https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-construction),
[per-user Add-AppxPackage](https://learn.microsoft.com/en-us/powershell/module/appx/add-appxpackage),
[MSIX signing](https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide).
