use chrono::Local;
use serde::Serialize;
use serde_json::Value;
use std::{fs, path::{Path, PathBuf}};
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub agent_dir: String,
    pub models_path: String,
    pub sessions_dir: String,
    pub skills_dir: String,
    pub pi_version: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigFile {
    pub path: String,
    pub exists: bool,
    pub config: Value,
}

pub(crate) fn default_agent_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|path| path.join(".pi").join("agent"))
        .ok_or_else(|| "无法确定当前用户主目录".to_string())
}

pub(crate) fn resolve_models_path(path: Option<String>) -> Result<PathBuf, String> {
    match path.filter(|value| !value.trim().is_empty()) {
        Some(value) => Ok(PathBuf::from(value)),
        None => Ok(default_agent_dir()?.join("models.json")),
    }
}

pub(crate) fn resolve_sessions_dir(path: Option<String>) -> Result<PathBuf, String> {
    match path.filter(|value| !value.trim().is_empty()) {
        Some(value) => Ok(PathBuf::from(value)),
        None => Ok(default_agent_dir()?.join("sessions")),
    }
}

pub(crate) fn resolve_skills_dir(path: Option<String>) -> Result<PathBuf, String> {
    match path.filter(|value| !value.trim().is_empty()) {
        Some(value) => Ok(PathBuf::from(value)),
        None => Ok(default_agent_dir()?.join("skills")),
    }
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[tauri::command]
pub fn get_app_info() -> Result<AppInfo, String> {
    let agent_dir = default_agent_dir()?;
    let pi_version = crate::process::run_pi("pi", &["--version"])
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string());

    Ok(AppInfo {
        models_path: path_text(&agent_dir.join("models.json")),
        sessions_dir: path_text(&agent_dir.join("sessions")),
        skills_dir: path_text(&agent_dir.join("skills")),
        agent_dir: path_text(&agent_dir),
        pi_version,
    })
}

#[tauri::command]
pub fn read_model_config(path: Option<String>) -> Result<ModelConfigFile, String> {
    let path = resolve_models_path(path)?;
    if !path.exists() {
        return Ok(ModelConfigFile {
            path: path_text(&path),
            exists: false,
            config: serde_json::json!({ "providers": {} }),
        });
    }

    let text = fs::read_to_string(&path)
        .map_err(|error| format!("读取 {} 失败：{error}", path.display()))?;
    let config = serde_json::from_str(&text)
        .map_err(|error| format!("{} 不是有效的 JSON：{error}", path.display()))?;
    Ok(ModelConfigFile { path: path_text(&path), exists: true, config })
}

fn validate_config(config: &Value) -> Result<(), String> {
    let root = config.as_object().ok_or("模型配置顶层必须是 JSON 对象")?;
    root.get("providers")
        .and_then(Value::as_object)
        .ok_or("模型配置必须包含 providers 对象")?;
    Ok(())
}

#[tauri::command]
pub fn save_model_config(path: Option<String>, config: Value) -> Result<Option<String>, String> {
    validate_config(&config)?;
    let path = resolve_models_path(path)?;
    let parent = path.parent().ok_or("模型配置路径无效")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("创建 {} 失败：{error}", parent.display()))?;

    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or("models.json");
    let temp_path = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));
    let content = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("序列化模型配置失败：{error}"))? + "\n";
    fs::write(&temp_path, content)
        .map_err(|error| format!("写入临时配置失败：{error}"))?;

    let backup_path = if path.exists() {
        let stamp = Local::now().format("%Y%m%d-%H%M%S-%3f");
        let backup = parent.join(format!("{file_name}.{stamp}.bak"));
        fs::rename(&path, &backup)
            .map_err(|error| format!("备份原配置失败：{error}"))?;
        Some(backup)
    } else {
        None
    };

    if let Err(error) = fs::rename(&temp_path, &path) {
        if let Some(backup) = &backup_path {
            let _ = fs::rename(backup, &path);
        }
        let _ = fs::remove_file(&temp_path);
        return Err(format!("替换模型配置失败：{error}"));
    }

    Ok(backup_path.as_deref().map(|backup| path_text(backup)))
}
