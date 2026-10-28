#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::WindowEvent;

fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show_main = MenuItem::with_id(app, "show-main", "打开小番茄", true, None::<&str>)?;
    let toggle_pet = MenuItem::with_id(app, "toggle-pet", "显示/隐藏桌面宠物", true, None::<&str>)?;
    let toggle_startup = CheckMenuItem::with_id(
        app,
        "toggle-startup",
        "开机启动",
        true,
        commands::is_start_on_boot_enabled(),
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let exit = MenuItem::with_id(app, "exit", "退出软件", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_main, &toggle_pet, &toggle_startup, &separator, &exit])?;
    let startup_item = toggle_startup.clone();

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("小番茄 · 陪你专注，也提醒你休息")
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show-main" => {
                let _ = commands::show_main_window(app.clone());
            }
            "toggle-pet" => {
                let _ = commands::toggle_pet_window(app.clone());
            }
            "toggle-startup" => {
                let next = !commands::is_start_on_boot_enabled();
                if commands::set_start_on_boot(next).is_ok() {
                    let _ = startup_item.set_checked(next);
                }
            }
            "exit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::DoubleClick { button: MouseButton::Left, .. }
            | TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
                let _ = commands::show_main_window(tray.app_handle().clone());
            }
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }
    tray.build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = commands::show_main_window(app.clone());
        }))
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::show_main_window,
            commands::show_pet_window,
            commands::hide_pet_window,
            commands::toggle_pet_window,
            commands::read_text_file,
            commands::write_text_file,
            commands::default_todo_sync_path,
            commands::toggle_start_on_boot,
        ])
        .run(tauri::generate_context!())
        .expect("启动小番茄失败");
}
