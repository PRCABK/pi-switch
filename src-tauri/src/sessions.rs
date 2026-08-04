use crate::config::resolve_sessions_dir;
use chrono::{DateTime, SecondsFormat, Utc};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    time::SystemTime,
};
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub name: Option<String>,
    pub cwd: String,
    pub path: String,
    pub created_at: String,
    pub modified_at: String,
    pub first_message: String,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub message_count: usize,
    pub total_tokens: u64,
    pub total_cost: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    pub summary: SessionSummary,
    pub entries: Vec<DisplayEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayEntry {
    pub id: String,
    pub parent_id: Option<String>,
    pub entry_type: String,
    pub timestamp: String,
    pub active: bool,
    pub role: Option<String>,
    pub title: String,
    pub text: String,
    pub thinking: Option<String>,
    pub tool_name: Option<String>,
    pub is_error: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn read_lines(path: &Path) -> Result<Vec<Value>, String> {
    let file = fs::File::open(path).map_err(|error| format!("读取 {} 失败：{error}", path.display()))?;
    BufReader::new(file)
        .lines()
        .enumerate()
        .filter_map(|(index, line)| match line {
            Ok(line) if line.trim().is_empty() => None,
            Ok(line) => Some(serde_json::from_str(&line).map_err(|error| {
                format!("{} 第 {} 行不是有效 JSON：{error}", path.display(), index + 1)
            })),
            Err(error) => Some(Err(format!("读取 {} 失败：{error}", path.display()))),
        })
        .collect()
}

fn content_text(content: Option<&Value>, block_type: &str) -> String {
    match content {
        Some(Value::String(text)) if block_type == "text" => text.clone(),
        Some(Value::Array(blocks)) => blocks
            .iter()
            .filter(|block| block.get("type").and_then(Value::as_str) == Some(block_type))
            .filter_map(|block| {
                let key = if block_type == "thinking" { "thinking" } else { "text" };
                block.get(key).and_then(Value::as_str)
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn tool_calls_text(content: Option<&Value>) -> String {
    let Some(Value::Array(blocks)) = content else { return String::new() };
    blocks
        .iter()
        .filter(|block| block.get("type").and_then(Value::as_str) == Some("toolCall"))
        .map(|block| {
            let name = block.get("name").and_then(Value::as_str).unwrap_or("tool");
            let arguments = block.get("arguments")
                .map(|value| serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string()))
                .unwrap_or_else(|| "{}".to_string());
            format!("调用工具 {name}\n{arguments}")
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn truncate(text: &str, max_chars: usize) -> String {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut chars = normalized.chars();
    let shortened = chars.by_ref().take(max_chars).collect::<String>();
    if chars.next().is_some() { format!("{shortened}…") } else { shortened }
}

fn system_time_text(time: SystemTime) -> String {
    DateTime::<Utc>::from(time).to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn summary_from_values(path: &Path, values: &[Value]) -> Result<SessionSummary, String> {
    let header = values.iter().find(|entry| entry.get("type").and_then(Value::as_str) == Some("session"))
        .ok_or_else(|| format!("{} 缺少 Session 头", path.display()))?;
    let id = header.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
    let cwd = header.get("cwd").and_then(Value::as_str).unwrap_or_default().to_string();
    let created_at = header.get("timestamp").and_then(Value::as_str).unwrap_or_default().to_string();
    let mut name = None;
    let mut first_message = String::new();
    let mut model = None;
    let mut provider = None;
    let mut message_count = 0;
    let mut total_tokens = 0_u64;
    let mut total_cost = 0_f64;

    for entry in values {
        match entry.get("type").and_then(Value::as_str) {
            Some("session_info") => name = entry.get("name").and_then(Value::as_str).map(str::to_string),
            Some("model_change") => {
                model = entry.get("modelId").and_then(Value::as_str).map(str::to_string);
                provider = entry.get("provider").and_then(Value::as_str).map(str::to_string);
            }
            Some("message") => {
                message_count += 1;
                let Some(message) = entry.get("message") else { continue };
                let role = message.get("role").and_then(Value::as_str).unwrap_or_default();
                if role == "user" && first_message.is_empty() {
                    first_message = truncate(&content_text(message.get("content"), "text"), 120);
                }
                if role == "assistant" {
                    model = message.get("model").and_then(Value::as_str).map(str::to_string).or(model);
                    provider = message.get("provider").and_then(Value::as_str).map(str::to_string).or(provider);
                    if let Some(usage) = message.get("usage") {
                        total_tokens += usage.get("totalTokens").and_then(Value::as_u64).unwrap_or(0);
                        total_cost += usage.pointer("/cost/total").and_then(Value::as_f64).unwrap_or(0.0);
                    }
                }
            }
            Some("compaction") | Some("branch_summary") => {
                if let Some(usage) = entry.get("usage") {
                    total_tokens += usage.get("totalTokens").and_then(Value::as_u64).unwrap_or(0);
                    total_cost += usage.pointer("/cost/total").and_then(Value::as_f64).unwrap_or(0.0);
                }
            }
            _ => {}
        }
    }

    let modified = fs::metadata(path).and_then(|metadata| metadata.modified()).unwrap_or(SystemTime::UNIX_EPOCH);
    Ok(SessionSummary {
        id,
        name,
        cwd,
        path: path_text(path),
        created_at,
        modified_at: system_time_text(modified),
        first_message,
        model,
        provider,
        message_count,
        total_tokens,
        total_cost,
    })
}

fn load_summary(path: &Path) -> Result<SessionSummary, String> {
    summary_from_values(path, &read_lines(path)?)
}

#[tauri::command]
pub fn list_sessions(sessions_dir: Option<String>) -> Result<Vec<SessionSummary>, String> {
    let directory = resolve_sessions_dir(sessions_dir)?;
    if !directory.exists() { return Ok(Vec::new()); }
    let mut sessions = WalkDir::new(&directory)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && entry.path().extension().and_then(|ext| ext.to_str()) == Some("jsonl"))
        .filter_map(|entry| load_summary(entry.path()).ok())
        .collect::<Vec<_>>();
    sessions.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    Ok(sessions)
}

fn active_ids(values: &[Value]) -> HashSet<String> {
    let entries = values.iter()
        .filter_map(|entry| entry.get("id").and_then(Value::as_str).map(|id| (id.to_string(), entry)))
        .collect::<HashMap<_, _>>();
    let mut active = HashSet::new();
    let mut current = values.iter().rev().find_map(|entry| entry.get("id").and_then(Value::as_str)).map(str::to_string);
    while let Some(id) = current {
        if !active.insert(id.clone()) { break; }
        current = entries.get(&id)
            .and_then(|entry| entry.get("parentId"))
            .and_then(Value::as_str)
            .map(str::to_string);
    }
    active
}

fn display_entry(entry: &Value, active: bool) -> Option<DisplayEntry> {
    let entry_type = entry.get("type")?.as_str()?.to_string();
    if entry_type == "session" || entry_type == "custom" || entry_type == "label" { return None; }
    let id = entry.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
    let parent_id = entry.get("parentId").and_then(Value::as_str).map(str::to_string);
    let timestamp = entry.get("timestamp").and_then(Value::as_str).unwrap_or_default().to_string();
    let mut result = DisplayEntry {
        id,
        parent_id,
        entry_type: entry_type.clone(),
        timestamp,
        active,
        role: None,
        title: entry_type.clone(),
        text: String::new(),
        thinking: None,
        tool_name: None,
        is_error: false,
        provider: None,
        model: None,
    };

    match entry_type.as_str() {
        "message" => {
            let message = entry.get("message")?;
            let role = message.get("role").and_then(Value::as_str).unwrap_or("unknown");
            result.role = Some(role.to_string());
            result.title = match role {
                "user" => "用户",
                "assistant" => "Pi",
                "toolResult" => "工具结果",
                "bashExecution" => "Shell 命令",
                "custom" => "扩展消息",
                _ => role,
            }.to_string();
            result.text = match role {
                "bashExecution" => format!("$ {}\n{}", message.get("command").and_then(Value::as_str).unwrap_or_default(), message.get("output").and_then(Value::as_str).unwrap_or_default()),
                "branchSummary" | "compactionSummary" => message.get("summary").and_then(Value::as_str).unwrap_or_default().to_string(),
                _ => {
                    let text = content_text(message.get("content"), "text");
                    let tools = tool_calls_text(message.get("content"));
                    match (text.is_empty(), tools.is_empty()) {
                        (false, false) => format!("{text}\n\n{tools}"),
                        (true, false) => tools,
                        _ => text,
                    }
                }
            };
            let thinking = content_text(message.get("content"), "thinking");
            if !thinking.is_empty() { result.thinking = Some(thinking); }
            result.tool_name = message.get("toolName").and_then(Value::as_str).map(str::to_string);
            result.is_error = message.get("isError").and_then(Value::as_bool).unwrap_or(false)
                || message.get("stopReason").and_then(Value::as_str) == Some("error");
            result.provider = message.get("provider").and_then(Value::as_str).map(str::to_string);
            result.model = message.get("model").and_then(Value::as_str).map(str::to_string);
        }
        "compaction" => {
            result.title = "上下文压缩".to_string();
            result.text = entry.get("summary").and_then(Value::as_str).unwrap_or_default().to_string();
        }
        "branch_summary" => {
            result.title = "分支摘要".to_string();
            result.text = entry.get("summary").and_then(Value::as_str).unwrap_or_default().to_string();
        }
        "model_change" => {
            result.title = "切换模型".to_string();
            result.provider = entry.get("provider").and_then(Value::as_str).map(str::to_string);
            result.model = entry.get("modelId").and_then(Value::as_str).map(str::to_string);
            result.text = format!("{}/{}", result.provider.as_deref().unwrap_or(""), result.model.as_deref().unwrap_or(""));
        }
        "thinking_level_change" => {
            result.title = "思考等级".to_string();
            result.text = entry.get("thinkingLevel").and_then(Value::as_str).unwrap_or_default().to_string();
        }
        "session_info" => {
            result.title = "会话名称".to_string();
            result.text = entry.get("name").and_then(Value::as_str).unwrap_or_default().to_string();
        }
        "custom_message" => {
            result.title = "扩展消息".to_string();
            result.text = content_text(entry.get("content"), "text");
        }
        _ => return None,
    }
    Some(result)
}

#[tauri::command]
pub fn get_session_detail(session_path: String) -> Result<SessionDetail, String> {
    let path = PathBuf::from(&session_path);
    if !path.is_file() { return Err("Session 文件不存在".to_string()); }
    let values = read_lines(&path)?;
    let active = active_ids(&values);
    let summary = summary_from_values(&path, &values)?;
    let entries = values.iter()
        .filter_map(|entry| {
            let is_active = entry.get("id").and_then(Value::as_str).map(|id| active.contains(id)).unwrap_or(false);
            display_entry(entry, is_active)
        })
        .collect();
    Ok(SessionDetail { summary, entries })
}

#[tauri::command]
pub fn rename_session(session_path: String, name: String) -> Result<(), String> {
    let path = PathBuf::from(&session_path);
    if !path.is_file() { return Err("Session 文件不存在".to_string()); }
    let values = read_lines(&path)?;
    let parent_id = values.iter().rev().find_map(|entry| entry.get("id").and_then(Value::as_str));
    let id = Uuid::new_v4().simple().to_string()[..8].to_string();
    let entry = serde_json::json!({
        "type": "session_info",
        "id": id,
        "parentId": parent_id,
        "timestamp": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        "name": name.trim()
    });
    let mut file = OpenOptions::new().append(true).open(&path)
        .map_err(|error| format!("打开 Session 文件失败：{error}"))?;
    writeln!(file, "{}", serde_json::to_string(&entry).map_err(|error| error.to_string())?)
        .map_err(|error| format!("写入 Session 名称失败：{error}"))
}

#[tauri::command]
pub fn delete_session(session_path: String) -> Result<(), String> {
    let path = PathBuf::from(&session_path);
    if !path.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
        return Err("Session 文件不存在或格式不正确".to_string());
    }
    load_summary(&path)?;
    fs::remove_file(&path).map_err(|error| format!("删除 Session 失败：{error}"))
}
