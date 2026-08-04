# Pi Switch

一个类似 CC Switch 的独立桌面工具，用于管理 [Pi Coding Agent](https://pi.dev) 的自定义模型和历史对话。

## 功能

- 可视化管理 `~/.pi/agent/models.json` 中的 Provider 和模型
- 从 `pi.dev/models` 搜索并导入 **Show configuration** 配置
- 保存配置前自动创建时间戳备份，保留未知配置字段
- 通过 `pi --list-models` 验证模型配置
- 扫描 `~/.pi/agent/sessions/**/*.jsonl` 并显示对话、思考、工具结果和分支
- 重命名、删除、导出 Session
- 在外部终端运行 `pi --session <id>` 继续对话

## 技术栈

- Tauri 2
- Rust
- Vue 3 + TypeScript
- Element Plus

## 开发环境

1. 安装 Node.js 20.19+。
2. 安装 Rust stable：<https://rustup.rs/>。
3. Windows 需要 WebView2 和 Visual Studio C++ Build Tools。
4. 安装依赖并启动：

```bash
npm install
npm run tauri dev
```

## 构建 Windows 安装包

```bash
npm run tauri build
```

独立程序位于 `src-tauri/target/release/pi-switch.exe`，NSIS 安装包位于 `src-tauri/target/release/bundle/nsis/`。

## 安全说明

- API Key 推荐在 `models.json` 中使用 `$ENV_VAR` 引用，不建议保存明文。
- 删除 Session 会直接删除对应 JSONL 文件，操作前会二次确认。
- `pi.dev` 配置导入只接受 `https://pi.dev/models/...` 详情路径。
