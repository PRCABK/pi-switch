use serde::Serialize;
use std::{path::Path, process::Command};

#[cfg(target_os = "windows")]
fn windows_cmd_quote(value: &str) -> std::io::Result<String> {
    // cmd.exe expands metacharacters before it starts the batch file. Refuse
    // ambiguous values instead of trying to emulate all of cmd's quoting rules.
    if value.chars().any(|character| character.is_control() || matches!(character, '"' | '^' | '&' | '|' | '<' | '>' | '(' | ')' | '%' | '!')) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Windows 命令参数包含不支持的 Shell 特殊字符",
        ));
    }
    Ok(format!("\"{value}\""))
}

#[cfg(target_os = "windows")]
fn windows_command_line(program: &str, args: &[&str]) -> std::io::Result<String> {
    std::iter::once(program)
        .chain(args.iter().copied())
        .map(windows_cmd_quote)
        .collect::<std::io::Result<Vec<_>>>()
        .map(|parts| parts.join(" "))
}

#[cfg(target_os = "windows")]
fn windows_shell_command_line(program: &str, args: &[&str]) -> std::io::Result<String> {
    windows_command_line(program, args).map(|line| format!("\"{line}\""))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub success: bool,
    pub output: String,
}

fn pi_command(pi_path: Option<String>) -> String {
    pi_path.filter(|path| !path.trim().is_empty()).unwrap_or_else(|| "pi".to_string())
}

pub(crate) fn run_pi(pi: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    #[cfg(target_os = "windows")]
    {
        // 先直接启动可执行文件，避免把路径和参数交给 cmd 解释。
        // npm 在 Windows 上常见的 pi.cmd 不能由 CreateProcess 直接启动，
        // 只有这种情况才退回到经过引用和转义的 cmd 命令行。
        match Command::new(pi).args(args).output() {
            Ok(output) => Ok(output),
            Err(direct_error) => {
                let command_line = windows_shell_command_line(pi, args).map_err(|_| direct_error)?;
                Command::new("cmd.exe")
                    .args(["/d", "/s", "/c"])
                    .arg(command_line)
                    .output()
                    .map_err(|_| std::io::Error::new(std::io::ErrorKind::NotFound, "无法执行 pi"))
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(pi).args(args).output()
    }
}

#[tauri::command]
pub fn validate_models(pi_path: Option<String>) -> Result<CommandResult, String> {
    let pi = pi_command(pi_path);
    let output = run_pi(&pi, &["--list-models"])
        .map_err(|error| format!("无法执行 pi --list-models：{error}"))?;
    let text = format!("{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    Ok(CommandResult { success: output.status.success(), output: text.trim().to_string() })
}

fn validate_session_id(id: &str) -> Result<(), String> {
    if id.is_empty() || !id.chars().all(|character| character.is_ascii_alphanumeric() || character == '-') {
        return Err("Session ID 不合法".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn continue_session(session_id: String, cwd: Option<String>, pi_path: Option<String>) -> Result<(), String> {
    validate_session_id(&session_id)?;
    let pi = pi_command(pi_path);

    #[cfg(target_os = "windows")]
    {
        let directory = cwd.as_deref().filter(|path| Path::new(path).is_dir());
        let command_line = windows_shell_command_line(&pi, &["--session", &session_id])
            .map_err(|error| format!("无法打开终端：{error}"))?;
        let mut command = Command::new("wt.exe");
        if let Some(directory) = directory {
            command.args(["-d", directory]);
        }
        match command.args(["cmd.exe", "/d", "/k", &command_line]).spawn() {
            Ok(_) => return Ok(()),
            Err(_) => {
                let mut fallback = Command::new("cmd.exe");
                if let Some(directory) = directory {
                    fallback.current_dir(directory);
                }
                fallback
                    .args(["/d", "/k", &command_line])
                    .spawn()
                    .map_err(|error| format!("无法打开终端：{error}"))?;
                return Ok(());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let directory = cwd
            .filter(|path| Path::new(path).is_dir())
            .or_else(|| dirs::home_dir().map(|path| path.to_string_lossy().into_owned()))
            .unwrap_or_else(|| ".".to_string());
        let shell = format!("cd {} && {} --session {}", shell_quote(&directory), shell_quote(&pi), shell_quote(&session_id));
        Command::new("osascript").args(["-e", &format!("tell application \"Terminal\" to do script {}", apple_quote(&shell))])
            .spawn().map_err(|error| format!("无法打开 Terminal：{error}"))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        let directory = cwd.filter(|path| Path::new(path).is_dir()).unwrap_or_else(|| ".".to_string());
        let shell = format!("cd {} && exec {} --session {}; exec bash", shell_quote(&directory), shell_quote(&pi), shell_quote(&session_id));
        for terminal in ["x-terminal-emulator", "gnome-terminal", "konsole"] {
            let result = if terminal == "gnome-terminal" {
                Command::new(terminal).args(["--", "bash", "-lc", &shell]).spawn()
            } else {
                Command::new(terminal).args(["-e", "bash", "-lc", &shell]).spawn()
            };
            if result.is_ok() { return Ok(()); }
        }
        Err("未找到可用的终端程序".to_string())
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(target_os = "macos")]
fn apple_quote(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

#[tauri::command]
pub fn export_session(session_path: String, pi_path: Option<String>, sessions_dir: Option<String>) -> Result<CommandResult, String> {
    let source = crate::sessions::resolve_session_path(&session_path, sessions_dir)?;
    let output_path = source.with_extension("html");
    let pi = pi_command(pi_path);
    let source_text = source.to_string_lossy();
    let output_text = output_path.to_string_lossy();
    let output = run_pi(&pi, &["--export", &source_text, &output_text])
        .map_err(|error| format!("导出 Session 失败：{error}"))?;
    let message = if output.status.success() {
        output_path.to_string_lossy().into_owned()
    } else {
        format!("{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr))
    };
    Ok(CommandResult { success: output.status.success(), output: message.trim().to_string() })
}
