use crate::process::{run_pi, CommandResult};
use scraper::{Html, Selector};
use serde::Serialize;
use serde_json::Value;
use std::{fs, path::PathBuf};

use crate::config::default_agent_dir;

const PACKAGES_ORIGIN: &str = "https://pi.dev";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackage {
    pub source: String,
    pub kind: String,
    pub scope: String,
    pub pinned: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageGalleryItem {
    pub name: String,
    pub description: String,
    pub provider: String,
    pub types: String,
    pub downloads: String,
    pub updated: String,
    pub detail_path: String,
    pub install_command: String,
}

fn pi_command(pi_path: Option<String>) -> String {
    pi_path
        .filter(|path| !path.trim().is_empty())
        .unwrap_or_else(|| "pi".to_string())
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(default_agent_dir()?.join("settings.json"))
}

fn classify(source: &str) -> (String, String) {
    // Returns (kind, scope).
    let (kind, scope) = if let Some(rest) = source.strip_prefix("npm:") {
        ("npm", rest.to_string())
    } else if let Some(rest) = source.strip_prefix("git:") {
        ("git", rest.to_string())
    } else if source.starts_with("https://")
        || source.starts_with("http://")
        || source.starts_with("ssh://")
        || source.starts_with("git://")
    {
        ("git", source.to_string())
    } else if source.starts_with("./") || source.starts_with("../") || source.starts_with('/') {
        ("local", source.to_string())
    } else if source.starts_with("npm:") {
        ("npm", source.to_string())
    } else {
        // Fallback: treat unknown specs as local.
        ("local", source.to_string())
    };
    (kind.to_string(), scope)
}

fn read_packages_array(settings: &Value) -> Vec<Value> {
    settings
        .get("packages")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default()
}

#[tauri::command]
pub fn list_packages(pi_path: Option<String>) -> Result<Vec<InstalledPackage>, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("读取 settings.json 失败：{error}"))?;
    let settings: Value = serde_json::from_str(&text)
        .map_err(|error| format!("settings.json 不是有效的 JSON：{error}"))?;

    let _ = pi_path; // kept for API symmetry; not used for listing
    let mut result = Vec::new();
    for entry in read_packages_array(&settings) {
        let (source, pinned) = match &entry {
            Value::String(string) => (string.clone(), false),
            Value::Object(object) => {
                let source = object
                    .get("source")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                // Pinned npm specs include a version, git specs include a ref.
                let pinned = source.contains('@');
                (source, pinned)
            }
            _ => continue,
        };
        if source.is_empty() {
            continue;
        }
        let (kind, scope) = classify(&source);
        result.push(InstalledPackage {
            source,
            kind,
            scope,
            pinned,
        });
    }
    Ok(result)
}

fn build_command_result(output: std::io::Result<std::process::Output>) -> Result<CommandResult, String> {
    let output = output.map_err(|error| format!("执行 pi 命令失败：{error}"))?;
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    Ok(CommandResult {
        success: output.status.success(),
        output: text.trim().to_string(),
    })
}

#[tauri::command]
pub fn install_package(source: String, pi_path: Option<String>) -> Result<CommandResult, String> {
    let source = source.trim();
    if source.is_empty() {
        return Err("请输入要安装的插件来源".to_string());
    }
    let pi = pi_command(pi_path);
    let output = run_pi(&pi, &["install", source]);
    build_command_result(output)
}

#[tauri::command]
pub fn remove_package(source: String, pi_path: Option<String>) -> Result<CommandResult, String> {
    let source = source.trim();
    if source.is_empty() {
        return Err("请输入要卸载的插件来源".to_string());
    }
    let pi = pi_command(pi_path);
    let output = run_pi(&pi, &["remove", source]);
    build_command_result(output)
}

#[tauri::command]
pub fn update_packages(pi_path: Option<String>) -> Result<CommandResult, String> {
    let pi = pi_command(pi_path);
    let output = run_pi(&pi, &["update", "--extensions"]);
    build_command_result(output)
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Pi-Switch/0.1 (+https://pi.dev)")
        .build()
        .map_err(|error| format!("创建网络客户端失败：{error}"))
}

#[tauri::command]
pub async fn search_packages(name: Option<String>) -> Result<Vec<PackageGalleryItem>, String> {
    let name = name.unwrap_or_default();
    let mut request = client()?.get(format!("{PACKAGES_ORIGIN}/packages"));
    let trimmed = name.trim();
    if !trimmed.is_empty() {
        request = request.query(&[("name", trimmed)]);
    }
    let html = request
        .send()
        .await
        .map_err(|error| format!("请求 pi.dev 失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("pi.dev 返回错误：{error}"))?
        .text()
        .await
        .map_err(|error| format!("读取 pi.dev 响应失败：{error}"))?;

    let document = Html::parse_document(&html);
    let cards = Selector::parse("[data-package-card='true']").map_err(|error| error.to_string())?;
    let links = Selector::parse("a[data-package-link='true']").map_err(|error| error.to_string())?;
    let descs = Selector::parse(".packages-desc").map_err(|error| error.to_string())?;
    let metas = Selector::parse(".packages-meta").map_err(|error| error.to_string())?;
    let copy =
        Selector::parse("[data-copy-text^='pi install ']").map_err(|error| error.to_string())?;

    let mut result = Vec::new();
    for card in document.select(&cards) {
        let name = card.value().attr("data-package-name").unwrap_or_default().to_string();
        if name.is_empty() {
            continue;
        }
        let types = card
            .value()
            .attr("data-package-types")
            .unwrap_or_default()
            .to_string();
        let downloads_raw = card
            .value()
            .attr("data-package-downloads")
            .unwrap_or_default()
            .to_string();
        let date_raw = card
            .value()
            .attr("data-package-date")
            .unwrap_or_default()
            .to_string();
        let downloads = format_downloads(&downloads_raw);
        let updated = format_updated(&date_raw);

        let detail_path = card
            .select(&links)
            .next()
            .and_then(|link| link.value().attr("data-package-path"))
            .unwrap_or_default()
            .to_string();
        let description = card
            .select(&descs)
            .next()
            .map(|node| node.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        let provider = card
            .select(&metas)
            .next()
            .map(|node| node.text().collect::<String>())
            .map(|text| {
                // First metadata span is the author/provider.
                text.split_whitespace().next().unwrap_or("").to_string()
            })
            .unwrap_or_default();
        let install_command = card
            .select(&copy)
            .next()
            .and_then(|node| node.value().attr("data-copy-text"))
            .unwrap_or_default()
            .to_string();

        result.push(PackageGalleryItem {
            name,
            description,
            provider,
            types,
            downloads,
            updated,
            detail_path,
            install_command,
        });
        if result.len() >= 200 {
            break;
        }
    }
    Ok(result)
}

fn format_downloads(raw: &str) -> String {
    let value: u64 = raw.parse().unwrap_or(0);
    if value == 0 {
        return "—".to_string();
    }
    if value >= 1_000_000 {
        format!("{:.1}M/mo", value as f64 / 1_000_000.0)
    } else if value >= 1_000 {
        format!("{:.1}K/mo", value as f64 / 1_000.0)
    } else {
        format!("{}/mo", value)
    }
}

fn format_updated(raw: &str) -> String {
    let millis: i64 = raw.parse().unwrap_or(0);
    if millis == 0 {
        return "—".to_string();
    }
    let then: chrono::DateTime<chrono::Utc> =
        chrono::DateTime::from_timestamp_millis(millis).unwrap_or_else(chrono::Utc::now);
    let delta = chrono::Utc::now().signed_duration_since(then);
    let secs = delta.num_seconds();
    if secs < 60 {
        return "刚刚".to_string();
    }
    let mins = secs / 60;
    if mins < 60 {
        return format!("{}m ago", mins);
    }
    let hours = mins / 60;
    if hours < 24 {
        return format!("{}h ago", hours);
    }
    let days = hours / 24;
    if days < 30 {
        return format!("{}d ago", days);
    }
    let months = days / 30;
    if months < 12 {
        return format!("{}mo ago", months);
    }
    format!("{}y ago", days / 365)
}
