#[tauri::command]
pub fn health_check() -> &'static str {
    "xiaofanqie-ready"
}

use std::{fs, path::PathBuf};

use tauri::{AppHandle, Manager};

const AUTOSTART_VALUE: &str = "XiaoFanQie";
const AUTOSTART_SUBKEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";

fn normalize_path(path: String) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("文件路径不能为空".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到小番茄主窗口".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn show_pet_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "找不到透明宠物窗口，请重启小番茄".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn hide_pet_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "找不到透明宠物窗口，请重启小番茄".to_string())?;
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn toggle_pet_window(app: AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "找不到透明宠物窗口，请重启小番茄".to_string())?;
    let visible = window.is_visible().map_err(|error| error.to_string())?;
    if visible {
        window.hide().map_err(|error| error.to_string())?;
    } else {
        window.show().map_err(|error| error.to_string())?;
        window.unminimize().map_err(|error| error.to_string())?;
    }
    Ok(!visible)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let path = normalize_path(path)?;
    fs::read_to_string(&path).map_err(|error| format!("读取同步文件失败：{}", error))
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let path = normalize_path(path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建同步文件夹失败：{}", error))?;
    }
    fs::write(&path, contents.as_bytes()).map_err(|error| format!("写入同步文件失败：{}", error))
}

#[tauri::command]
pub fn default_todo_sync_path(app: AppHandle) -> Result<String, String> {
    let document_dir = app
        .path()
        .document_dir()
        .map_err(|error| format!("找不到 Windows 文档目录：{}", error))?;
    Ok(document_dir.join("小番茄-Todo.csv").to_string_lossy().to_string())
}

#[cfg(windows)]
pub fn is_start_on_boot_enabled() -> bool {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(AUTOSTART_SUBKEY)
        .and_then(|key| key.get_value::<String, _>(AUTOSTART_VALUE))
        .is_ok()
}

#[cfg(not(windows))]
pub fn is_start_on_boot_enabled() -> bool {
    false
}

#[cfg(windows)]
pub fn set_start_on_boot(enabled: bool) -> Result<bool, String> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let (run_key, _) = current_user
        .create_subkey(AUTOSTART_SUBKEY)
        .map_err(|error| format!("打开 Windows 开机启动设置失败：{}", error))?;
    if enabled {
        let executable = std::env::current_exe().map_err(|error| format!("找不到小番茄程序路径：{}", error))?;
        let command = format!("\"{}\"", executable.to_string_lossy());
        run_key
            .set_value(AUTOSTART_VALUE, &command)
            .map_err(|error| format!("开启开机启动失败：{}", error))?;
    } else if let Err(error) = run_key.delete_value(AUTOSTART_VALUE) {
        if error.kind() != std::io::ErrorKind::NotFound {
            return Err(format!("关闭开机启动失败：{}", error));
        }
    }
    Ok(enabled)
}

#[cfg(not(windows))]
pub fn set_start_on_boot(_enabled: bool) -> Result<bool, String> {
    Err("开机启动只支持 Windows".to_string())
}

#[tauri::command]
pub fn toggle_start_on_boot(enabled: bool) -> Result<bool, String> {
    set_start_on_boot(enabled)
}
