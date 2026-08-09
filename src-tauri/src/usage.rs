use crate::config::resolve_sessions_dir;
use chrono::{DateTime, Local};
use serde::Serialize;
use serde_json::Value;
use std::{
    cmp::Ordering,
    collections::{BTreeMap, HashMap},
    fs,
    io::{BufRead, BufReader},
    path::Path,
};
use walkdir::WalkDir;

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageTotals {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub total_tokens: u64,
    pub total_cost: f64,
    pub requests: u64,
    pub messages: u64,
    pub sessions: u64,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyUsage {
    pub date: String,
    pub total_tokens: u64,
    pub total_cost: f64,
    pub requests: u64,
    pub sessions: u64,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageBreakdown {
    pub name: String,
    pub total_tokens: u64,
    pub total_cost: f64,
    pub requests: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    pub totals: UsageTotals,
    pub today: UsageTotals,
    pub daily: Vec<DailyUsage>,
    pub models: Vec<UsageBreakdown>,
    pub providers: Vec<UsageBreakdown>,
}

fn number(usage: &Value, keys: &[&str]) -> u64 {
    keys.iter().find_map(|key| usage.get(*key).and_then(Value::as_u64)).unwrap_or(0)
}

fn local_date(timestamp: &str) -> String {
    DateTime::parse_from_rfc3339(timestamp)
        .map(|value| value.with_timezone(&Local).format("%Y-%m-%d").to_string())
        .unwrap_or_else(|_| timestamp.chars().take(10).collect())
}

fn usage_values(usage: &Value) -> UsageTotals {
    let input_tokens = number(usage, &["inputTokens", "input"]);
    let output_tokens = number(usage, &["outputTokens", "output"]);
    let cache_read_tokens = number(usage, &["cacheReadTokens", "cacheRead"]);
    let cache_write_tokens = number(usage, &["cacheWriteTokens", "cacheWrite"]);
    let reported_total = number(usage, &["totalTokens", "total"]);
    UsageTotals {
        input_tokens,
        output_tokens,
        cache_read_tokens,
        cache_write_tokens,
        total_tokens: if reported_total > 0 { reported_total } else { input_tokens + output_tokens + cache_read_tokens + cache_write_tokens },
        total_cost: usage.pointer("/cost/total").and_then(Value::as_f64).unwrap_or(0.0),
        requests: 1,
        ..UsageTotals::default()
    }
}

fn add_totals(target: &mut UsageTotals, value: &UsageTotals) {
    target.input_tokens += value.input_tokens;
    target.output_tokens += value.output_tokens;
    target.cache_read_tokens += value.cache_read_tokens;
    target.cache_write_tokens += value.cache_write_tokens;
    target.total_tokens += value.total_tokens;
    target.total_cost += value.total_cost;
    target.requests += value.requests;
    target.messages += value.messages;
    target.sessions += value.sessions;
}

fn add_breakdown(target: &mut UsageBreakdown, value: &UsageTotals) {
    target.total_tokens += value.total_tokens;
    target.total_cost += value.total_cost;
    target.requests += value.requests;
}

fn read_values(path: &Path) -> Vec<Value> {
    let Ok(file) = fs::File::open(path) else { return Vec::new() };
    BufReader::new(file)
        .lines()
        .filter_map(Result::ok)
        .filter_map(|line| serde_json::from_str(&line).ok())
        .collect()
}

fn register_usage(
    timestamp: &str,
    provider: &str,
    model: &str,
    value: UsageTotals,
    today_key: &str,
    totals: &mut UsageTotals,
    today: &mut UsageTotals,
    daily: &mut BTreeMap<String, DailyUsage>,
    models: &mut HashMap<String, UsageBreakdown>,
    providers: &mut HashMap<String, UsageBreakdown>,
) {
    let date = local_date(timestamp);
    add_totals(totals, &value);
    if date == today_key {
        add_totals(today, &value);
    }
    let day = daily.entry(date.clone()).or_insert_with(|| DailyUsage { date, ..DailyUsage::default() });
    day.total_tokens += value.total_tokens;
    day.total_cost += value.total_cost;
    day.requests += value.requests;

    let provider_name = if provider.is_empty() { "未知 Provider" } else { provider };
    let model_name = if model.is_empty() { "未知模型" } else { model };
    let model_key = if provider.is_empty() { model_name.to_string() } else { format!("{provider_name}/{model_name}") };
    let model_entry = models.entry(model_key.clone()).or_insert_with(|| UsageBreakdown { name: model_key, ..UsageBreakdown::default() });
    add_breakdown(model_entry, &value);
    let provider_entry = providers.entry(provider_name.to_string()).or_insert_with(|| UsageBreakdown { name: provider_name.to_string(), ..UsageBreakdown::default() });
    add_breakdown(provider_entry, &value);
}

fn compare_usage(left: &UsageBreakdown, right: &UsageBreakdown) -> Ordering {
    right.total_tokens.cmp(&left.total_tokens).then_with(|| right.total_cost.partial_cmp(&left.total_cost).unwrap_or(Ordering::Equal))
}

#[tauri::command]
pub fn get_usage_stats(sessions_dir: Option<String>) -> Result<UsageStats, String> {
    let directory = resolve_sessions_dir(sessions_dir)?;
    let today_key = Local::now().format("%Y-%m-%d").to_string();
    let mut totals = UsageTotals::default();
    let mut today = UsageTotals::default();
    let mut daily = BTreeMap::<String, DailyUsage>::new();
    let mut models = HashMap::<String, UsageBreakdown>::new();
    let mut providers = HashMap::<String, UsageBreakdown>::new();

    if directory.exists() {
        for entry in WalkDir::new(&directory)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file() && entry.path().extension().and_then(|value| value.to_str()) == Some("jsonl"))
        {
            let values = read_values(entry.path());
            if values.is_empty() {
                continue;
            }
            totals.sessions += 1;
            let session_timestamp = values
                .iter()
                .find(|value| value.get("type").and_then(Value::as_str) == Some("session"))
                .and_then(|value| value.get("timestamp").and_then(Value::as_str))
                .unwrap_or_default()
                .to_string();
            let session_date = local_date(&session_timestamp);
            if session_date == today_key {
                today.sessions += 1;
            }
            if !session_date.is_empty() {
                let day = daily.entry(session_date.clone()).or_insert_with(|| DailyUsage { date: session_date, ..DailyUsage::default() });
                day.sessions += 1;
            }

            let mut current_provider = String::new();
            let mut current_model = String::new();
            for value in values {
                let timestamp = value.get("timestamp").and_then(Value::as_str).unwrap_or(session_timestamp.as_str());
                match value.get("type").and_then(Value::as_str) {
                    Some("model_change") => {
                        current_provider = value.get("provider").and_then(Value::as_str).unwrap_or_default().to_string();
                        current_model = value.get("modelId").and_then(Value::as_str).unwrap_or_default().to_string();
                    }
                    Some("message") => {
                        totals.messages += 1;
                        if local_date(timestamp) == today_key {
                            today.messages += 1;
                        }
                        let Some(message) = value.get("message") else { continue };
                        if message.get("role").and_then(Value::as_str) != Some("assistant") {
                            continue;
                        }
                        if let Some(provider) = message.get("provider").and_then(Value::as_str) {
                            current_provider = provider.to_string();
                        }
                        if let Some(model) = message.get("model").and_then(Value::as_str) {
                            current_model = model.to_string();
                        }
                        if let Some(usage) = message.get("usage") {
                            register_usage(
                                timestamp,
                                &current_provider,
                                &current_model,
                                usage_values(usage),
                                &today_key,
                                &mut totals,
                                &mut today,
                                &mut daily,
                                &mut models,
                                &mut providers,
                            );
                        }
                    }
                    Some("compaction") | Some("branch_summary") => {
                        if let Some(usage) = value.get("usage") {
                            register_usage(
                                timestamp,
                                &current_provider,
                                &current_model,
                                usage_values(usage),
                                &today_key,
                                &mut totals,
                                &mut today,
                                &mut daily,
                                &mut models,
                                &mut providers,
                            );
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    let mut model_values = models.into_values().collect::<Vec<_>>();
    let mut provider_values = providers.into_values().collect::<Vec<_>>();
    model_values.sort_by(compare_usage);
    provider_values.sort_by(compare_usage);

    Ok(UsageStats {
        totals,
        today,
        daily: daily.into_values().collect(),
        models: model_values,
        providers: provider_values,
    })
}
