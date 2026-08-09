use crate::config::resolve_skills_dir;
use chrono::{DateTime, SecondsFormat, Utc};
use serde::Serialize;
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::SystemTime,
};
use walkdir::WalkDir;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub enabled: bool,
    pub file_count: usize,
    pub modified_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCatalog {
    pub skills_dir: String,
    pub disabled_dir: String,
    pub skills: Vec<SkillInfo>,
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn disabled_skills_dir(skills_dir: &Path) -> PathBuf {
    let name = skills_dir
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("skills");
    skills_dir.with_file_name(format!("{name}-disabled"))
}

fn validate_skill_id(id: &str) -> Result<&str, String> {
    let trimmed = id.trim();
    let mut components = Path::new(trimmed).components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(_)), None) if !trimmed.starts_with('.') => Ok(trimmed),
        _ => Err("Skill ID 不合法".to_string()),
    }
}

fn frontmatter_value(text: &str, key: &str) -> Option<String> {
    let mut lines = text.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    for line in lines {
        let line = line.trim();
        if line == "---" {
            break;
        }
        if let Some(value) = line.strip_prefix(&format!("{key}:")) {
            return Some(value.trim().trim_matches(['\'', '"']).to_string());
        }
    }
    None
}

fn skill_info(path: &Path, enabled: bool) -> Result<SkillInfo, String> {
    let manifest = path.join("SKILL.md");
    if !manifest.is_file() {
        return Err(format!("{} 缺少 SKILL.md", path.display()));
    }
    let text = fs::read_to_string(&manifest)
        .map_err(|error| format!("读取 {} 失败：{error}", manifest.display()))?;
    let id = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Skill 目录名称不是有效文本".to_string())?
        .to_string();
    let name = frontmatter_value(&text, "name").filter(|value| !value.is_empty()).unwrap_or_else(|| id.clone());
    let description = frontmatter_value(&text, "description").unwrap_or_default();
    let mut file_count = 0;
    let mut modified = SystemTime::UNIX_EPOCH;
    for entry in WalkDir::new(path).follow_links(false).into_iter().filter_map(Result::ok) {
        if entry.file_type().is_file() {
            file_count += 1;
        }
        if let Ok(metadata) = entry.metadata() {
            if let Ok(value) = metadata.modified() {
                modified = modified.max(value);
            }
        }
    }
    Ok(SkillInfo {
        id,
        name,
        description,
        path: path_text(path),
        enabled,
        file_count,
        modified_at: DateTime::<Utc>::from(modified).to_rfc3339_opts(SecondsFormat::Millis, true),
    })
}

fn scan_root(root: &Path, enabled: bool) -> Vec<SkillInfo> {
    let Ok(entries) = fs::read_dir(root) else { return Vec::new() };
    entries
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_type().ok().filter(|kind| kind.is_dir()).map(|_| entry.path()))
        .filter_map(|path| skill_info(&path, enabled).ok())
        .collect()
}

#[tauri::command]
pub fn list_skills(skills_dir: Option<String>) -> Result<SkillCatalog, String> {
    let active = resolve_skills_dir(skills_dir)?;
    let disabled = disabled_skills_dir(&active);
    let mut skills = scan_root(&active, true);
    skills.extend(scan_root(&disabled, false));
    skills.sort_by(|left, right| right.enabled.cmp(&left.enabled).then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase())));
    Ok(SkillCatalog {
        skills_dir: path_text(&active),
        disabled_dir: path_text(&disabled),
        skills,
    })
}

fn copy_skill(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| format!("创建 {} 失败：{error}", target.display()))?;
    for entry in WalkDir::new(source).follow_links(false) {
        let entry = entry.map_err(|error| format!("扫描 Skill 失败：{error}"))?;
        if entry.file_type().is_symlink() {
            continue;
        }
        let relative = entry.path().strip_prefix(source).map_err(|error| error.to_string())?;
        let destination = target.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&destination)
                .map_err(|error| format!("创建 {} 失败：{error}", destination.display()))?;
        } else if entry.file_type().is_file() {
            fs::copy(entry.path(), &destination)
                .map_err(|error| format!("复制 {} 失败：{error}", entry.path().display()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn install_skill(source_path: String, skills_dir: Option<String>) -> Result<SkillInfo, String> {
    let source_input = PathBuf::from(source_path.trim());
    let source = if source_input.is_file() && source_input.file_name().and_then(|value| value.to_str()) == Some("SKILL.md") {
        source_input.parent().map(Path::to_path_buf).ok_or("无法确定 Skill 目录")?
    } else {
        source_input
    };
    if !source.join("SKILL.md").is_file() {
        return Err("所选目录中没有 SKILL.md".to_string());
    }
    let source = source.canonicalize().map_err(|error| format!("读取来源目录失败：{error}"))?;
    let id = source.file_name().and_then(|value| value.to_str()).ok_or("无法确定 Skill ID")?;
    let id = validate_skill_id(id)?.to_string();
    let active = resolve_skills_dir(skills_dir)?;
    let disabled = disabled_skills_dir(&active);
    if active.exists() {
        let active_canonical = active.canonicalize().map_err(|error| error.to_string())?;
        if source.starts_with(&active_canonical) {
            return Err("该 Skill 已位于受管目录中".to_string());
        }
    }
    if active.join(&id).exists() || disabled.join(&id).exists() {
        return Err(format!("Skill “{id}” 已存在"));
    }
    fs::create_dir_all(&active).map_err(|error| format!("创建 Skill 目录失败：{error}"))?;
    let target = active.join(&id);
    if let Err(error) = copy_skill(&source, &target) {
        let _ = fs::remove_dir_all(&target);
        return Err(error);
    }
    skill_info(&target, true)
}

#[tauri::command]
pub fn set_skill_enabled(skill_id: String, enabled: bool, skills_dir: Option<String>) -> Result<(), String> {
    let id = validate_skill_id(&skill_id)?;
    let active = resolve_skills_dir(skills_dir)?;
    let disabled = disabled_skills_dir(&active);
    let (source, target) = if enabled {
        (disabled.join(id), active.join(id))
    } else {
        (active.join(id), disabled.join(id))
    };
    if !source.join("SKILL.md").is_file() {
        return Err("Skill 不存在或结构不正确".to_string());
    }
    if target.exists() {
        return Err("目标目录已存在同名 Skill".to_string());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建目录失败：{error}"))?;
    }
    fs::rename(&source, &target).map_err(|error| format!("切换 Skill 状态失败：{error}"))
}

#[tauri::command]
pub fn uninstall_skill(skill_id: String, enabled: bool, skills_dir: Option<String>) -> Result<(), String> {
    let id = validate_skill_id(&skill_id)?;
    let active = resolve_skills_dir(skills_dir)?;
    let root = if enabled { active.clone() } else { disabled_skills_dir(&active) };
    let target = root.join(id);
    if !target.join("SKILL.md").is_file() {
        return Err("Skill 不存在或结构不正确".to_string());
    }
    fs::remove_dir_all(&target).map_err(|error| format!("卸载 Skill 失败：{error}"))
}
