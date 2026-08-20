mod catalog;
mod config;
mod packages;
mod process;
mod sessions;
mod skills;
mod usage;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 托盘菜单：显示 / 退出
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Pi Switch")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键单击：切换窗口显示/隐藏
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.unminimize();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // 拦截关闭请求：阻止原生关闭，改为通知前端由用户决定（最小化到托盘 / 退出）
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("tauri://close-requested-prompt", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            config::get_app_info,
            config::read_model_config,
            config::save_model_config,
            catalog::search_catalog,
            catalog::fetch_catalog_config,
            catalog::fetch_provider_models,
            packages::list_packages,
            packages::install_package,
            packages::remove_package,
            packages::update_packages,
            packages::search_packages,
            sessions::list_sessions,
            sessions::get_session_detail,
            sessions::rename_session,
            sessions::delete_session,
            skills::list_skills,
            skills::install_skill,
            skills::set_skill_enabled,
            skills::uninstall_skill,
            usage::get_usage_stats,
            process::validate_models,
            process::continue_session,
            process::export_session
        ])
        .run(tauri::generate_context!())
        .expect("启动 Pi Switch 失败");
}
