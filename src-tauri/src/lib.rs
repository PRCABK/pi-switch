mod catalog;
mod config;
mod process;
mod sessions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            config::get_app_info,
            config::read_model_config,
            config::save_model_config,
            catalog::search_catalog,
            catalog::fetch_catalog_config,
            sessions::list_sessions,
            sessions::get_session_detail,
            sessions::rename_session,
            sessions::delete_session,
            process::validate_models,
            process::continue_session,
            process::export_session
        ])
        .run(tauri::generate_context!())
        .expect("启动 Pi Switch 失败");
}
