param([Parameter(Mandatory = $true)][int]$ProcessId)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class PetWindowProbe {
  public delegate bool Callback(IntPtr hwnd, IntPtr lparam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left, top, right, bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x, y; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback, IntPtr lparam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  public static List<IntPtr> WindowsFor(uint processId) {
    var result = new List<IntPtr>();
    EnumWindows((hwnd, unused) => { uint pid; GetWindowThreadProcessId(hwnd, out pid); if (pid == processId && IsWindowVisible(hwnd)) result.Add(hwnd); return true; }, IntPtr.Zero);
    return result;
  }
}
'@
[void][PetWindowProbe]::SetProcessDpiAwarenessContext([IntPtr](-4))
$windows = [PetWindowProbe]::WindowsFor([uint32]$ProcessId)
$candidates = @()
foreach ($handle in $windows) {
  $rect = New-Object PetWindowProbe+RECT
  if ([PetWindowProbe]::GetWindowRect($handle, [ref]$rect)) {
    $width = $rect.right - $rect.left
    $height = $rect.bottom - $rect.top
    if ($width -ge 200 -and $width -le 600 -and $height -ge 200 -and $height -le 600) { $candidates += [pscustomobject]@{ Handle = $handle; Rect = $rect; Width = $width; Height = $height } }
  }
}
if ($candidates.Count -ne 1) { throw "Expected one visible pet window, found $($candidates.Count)." }
$pet = $candidates[0]
$original = New-Object PetWindowProbe+POINT
if (-not [PetWindowProbe]::GetCursorPos([ref]$original)) { throw 'Cannot read cursor position.' }
try {
  $point = New-Object PetWindowProbe+POINT
  $point.x = $pet.Rect.left + [int]($pet.Width * 0.05)
  $point.y = $pet.Rect.top + [int]($pet.Height * 0.50)
  [void][PetWindowProbe]::SetCursorPos($point.x, $point.y)
  Start-Sleep -Milliseconds 800
  $actual = New-Object PetWindowProbe+POINT
  [void][PetWindowProbe]::GetCursorPos([ref]$actual)
  if ($actual.x -ne $point.x -or $actual.y -ne $point.y) { throw 'Cursor moved during the test.' }
  $target = [PetWindowProbe]::GetAncestor([PetWindowProbe]::WindowFromPoint($point), 2)
  if ($target -eq $pet.Handle) { throw 'Transparent area intercepted the click target.' }
  $point.x = $pet.Rect.left + [int]($pet.Width * 0.50)
  $point.y = $pet.Rect.top + [int]($pet.Height * 0.70)
  [void][PetWindowProbe]::SetCursorPos($point.x, $point.y)
  Start-Sleep -Milliseconds 800
  [void][PetWindowProbe]::GetCursorPos([ref]$actual)
  if ($actual.x -ne $point.x -or $actual.y -ne $point.y) { throw 'Cursor moved during the test.' }
  $target = [PetWindowProbe]::GetAncestor([PetWindowProbe]::WindowFromPoint($point), 2)
  if ($target -ne $pet.Handle) { throw 'Pet body did not receive the click target.' }
  Write-Output 'PASS: transparent area passes through and pet body remains interactive.'
} finally { [void][PetWindowProbe]::SetCursorPos($original.x, $original.y) }
