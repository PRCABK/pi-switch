use scraper::{Html, Selector};
use serde::Serialize;
use serde_json::Value;

const CATALOG_ORIGIN: &str = "https://pi.dev";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModel {
    pub id: String,
}

fn join_base_url(base_url: &str) -> Result<String, String> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return Err("Provider 未配置 Base URL".to_string());
    }
    let trimmed = trimmed.trim_end_matches('/');
    if trimmed.ends_with("/models") {
        Ok(trimmed.to_string())
    } else if trimmed.ends_with("/v1") {
        Ok(format!("{trimmed}/models"))
    } else {
        Ok(format!("{trimmed}/models"))
    }
}

#[tauri::command]
pub async fn fetch_provider_models(base_url: String, api_key: Option<String>, auth_header: bool) -> Result<Vec<ProviderModel>, String> {
    let url = join_base_url(&base_url)?;
    let mut request = client()?.get(&url);
    if auth_header {
        let key = api_key.unwrap_or_default();
        let key = key.trim();
        if !key.is_empty() && !key.starts_with('$') && !key.starts_with('!') {
            request = request.header("Authorization", format!("Bearer {key}"));
        }
    }
    let response = request.send().await.map_err(|error| format!("请求 /v1/models 失败：{error}"))?;
    let status = response.status();
    let text = response.text().await.map_err(|error| format!("读取响应失败：{error}"))?;
    if !status.is_success() {
        let snippet = text.chars().take(300).collect::<String>();
        return Err(format!("/v1/models 返回错误：{status} - {snippet}"));
    }
    let value: Value = serde_json::from_str(&text).map_err(|error| format!("解析 JSON 失败：{error}"))?;
    let ids = match &value {
        Value::Object(map) => map.get("data").cloned().unwrap_or(Value::Null),
        Value::Array(array) => Value::Array(array.clone()),
        _ => Value::Null,
    };
    let array = ids.as_array().ok_or("响应中没有可解析的模型列表")?;
    let mut result = Vec::new();
    for item in array {
        let id = item.get("id").and_then(|value| value.as_str()).unwrap_or_default().trim().to_string();
        if !id.is_empty() {
            result.push(ProviderModel { id });
        }
    }
    Ok(result)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogModel {
    pub name: String,
    pub id: String,
    pub provider: String,
    pub detail_path: String,
    pub context_window: String,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Pi-Switch/0.1 (+https://pi.dev)")
        .build()
        .map_err(|error| format!("创建网络客户端失败：{error}"))
}

#[tauri::command]
pub async fn search_catalog(name: String, provider: Option<String>) -> Result<Vec<CatalogModel>, String> {
    let html = client()?
        .get(format!("{CATALOG_ORIGIN}/models"))
        .query(&[("name", name.trim()), ("provider", provider.as_deref().unwrap_or(""))])
        .send().await.map_err(|error| format!("请求 pi.dev 失败：{error}"))?
        .error_for_status().map_err(|error| format!("pi.dev 返回错误：{error}"))?
        .text().await.map_err(|error| format!("读取 pi.dev 响应失败：{error}"))?;

    let document = Html::parse_document(&html);
    let rows = Selector::parse("tr[data-model-row='true']").map_err(|error| error.to_string())?;
    let links = Selector::parse("a[data-model-link='true']").map_err(|error| error.to_string())?;
    let contexts = Selector::parse("td[data-label='Context']").map_err(|error| error.to_string())?;
    let normalize = |value: &str| {
        value
            .chars()
            .filter(|character| character.is_alphanumeric())
            .flat_map(char::to_lowercase)
            .collect::<String>()
    };
    let query = normalize(name.trim());
    let provider_filter = provider.unwrap_or_default().to_lowercase();

    let mut result = Vec::new();
    for row in document.select(&rows) {
        let row_provider = row.value().attr("data-model-provider").unwrap_or_default();
        let id = row.value().attr("data-model-id").unwrap_or_default();
        let search_name = row.value().attr("data-model-name").unwrap_or_default();
        if (!provider_filter.is_empty() && row_provider.to_lowercase() != provider_filter)
            || (!query.is_empty() && !normalize(search_name).contains(&query) && !normalize(id).contains(&query)) {
            continue;
        }
        let Some(link) = row.select(&links).next() else { continue };
        let detail_path = link.value().attr("data-model-path").unwrap_or_default();
        if !detail_path.starts_with("/models/") { continue; }
        result.push(CatalogModel {
            name: link.text().collect::<String>().trim().to_string(),
            id: id.to_string(),
            provider: row_provider.to_string(),
            detail_path: detail_path.to_string(),
            context_window: row.select(&contexts).next().map(|cell| cell.text().collect::<String>()).unwrap_or_default(),
        });
        if result.len() >= 100 { break; }
    }
    Ok(result)
}

#[tauri::command]
pub async fn fetch_catalog_config(detail_path: String) -> Result<Value, String> {
    if !detail_path.starts_with("/models/") || detail_path.contains("://") || detail_path.contains("..") {
        return Err("模型详情地址不合法".to_string());
    }
    let html = client()?
        .get(format!("{CATALOG_ORIGIN}{detail_path}"))
        .send().await.map_err(|error| format!("请求模型详情失败：{error}"))?
        .error_for_status().map_err(|error| format!("模型详情返回错误：{error}"))?
        .text().await.map_err(|error| format!("读取模型详情失败：{error}"))?;
    let document = Html::parse_document(&html);
    let selector = Selector::parse(".models-config-disclosure pre code").map_err(|error| error.to_string())?;
    let code = document.select(&selector).next().ok_or("页面中没有找到 Show configuration")?;
    let json = code.text().collect::<String>();
    serde_json::from_str(&json).map_err(|error| format!("解析 Show configuration 失败：{error}"))
}
