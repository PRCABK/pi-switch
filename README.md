# Pi Switch

Pi Switch 是一个面向 [Pi Coding Agent](https://pi.dev) 的 Windows 桌面管理工具。它把模型配置、历史 Session、Skill 和 Token 用量放到同一个清楚的工作界面里，数据仍然留在你的本机。

- 产品官网：<https://prcabk.github.io/pi-switch/>
- 最新版本：<https://github.com/PRCABK/pi-switch/releases/latest>
- 源代码：<https://github.com/PRCABK/pi-switch>
- 当前版本：`0.2.6`

## 能做什么

### 模型管理

- 可视化编辑 `models.json` 中的 Provider 和模型配置。
- 从 `pi.dev/models` 搜索模型，并导入 **Show configuration** 提供的配置。
- 保存前自动生成带时间戳的备份文件。
- 写回配置时保留未知字段，降低与 Pi 后续版本之间的兼容风险。
- 通过 `pi --list-models` 检查当前模型配置是否可用。

### Session 管理

- 递归扫描 `~/.pi/agent/sessions/**/*.jsonl`。
- 查看用户消息、Pi 回复、思考内容、工具调用、工具结果、模型切换和上下文压缩记录。
- 识别 Session 当前分支，并保留完整的消息时间线。
- 重命名、删除 Session。
- 将 Session 导出为 HTML 文件。
- 在原工作目录中调用 `pi --session <id>` 继续对话。

### 用量统计

用量统计是应用启动后的默认首页，数据直接来自本地 Session JSONL，不填充示例数字，包含：

- 累计 Token、今日 Token、费用、请求数、消息数和 Session 数。
- 输入、输出、缓存读取、缓存写入的 Token 构成。
- 按日期查看 Token 与费用趋势。
- 按模型和 Provider 查看用量排行。
- 如果本地没有 Session 或 Session 中没有 usage 数据，对应数值显示为零。

### Skill 管理

- 默认管理目录为 `~/.pi/agent/skills`。
- 从本地目录安装 Skill，来源目录必须包含 `SKILL.md`。
- 安装过程只复制文件，不执行 Skill 中的脚本或命令。
- 启用、停用 Skill。
- 停用时将 Skill 移动到同级的 `~/.pi/agent/skills-disabled`，Pi Agent 不会扫描该目录，同时可以无损恢复。
- 卸载受管目录中的 Skill。卸载前会校验目录结构，避免删除任意路径。
- 显示 Skill 名称、描述、文件数量、更新时间和当前状态。

### 应用设置

可以在设置页覆盖默认路径：

| 配置项 | 默认位置 |
| --- | --- |
| Pi 可执行文件 | `pi`，从系统 `PATH` 查找 |
| 模型配置 | `~/.pi/agent/models.json` |
| Session 目录 | `~/.pi/agent/sessions` |
| Skill 目录 | `~/.pi/agent/skills` |

留空时使用默认位置。自定义路径只保存在当前用户的本机 WebView `localStorage` 中，不会上传到服务器。

## 安装使用

1. 安装 Pi Coding Agent，并确认终端中可以运行 `pi --version`。
2. 从 [最新 Release](https://github.com/PRCABK/pi-switch/releases/latest) 下载：
   - `Pi-Switch_vX.Y.Z_windows-x64_setup.exe`：Windows 安装版。
   - `Pi-Switch_vX.Y.Z_windows-x64_portable.zip`：免安装便携版。
   - `SHA256SUMS.txt`：发布文件的 SHA-256 校验值。
3. 启动 Pi Switch。首次启动会从 Pi 的默认目录读取配置和 Session。
4. 如果 Pi 不在系统 `PATH` 中，在“应用设置”中填入 `pi.exe` 的完整路径。

当前发布目标是 Windows x64，系统需要 Windows 10/11 和 WebView2 运行环境。NSIS 安装版通常会使用系统中已有的 WebView2；若启动失败，请先安装或更新 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

## 开发环境

### 前置依赖

- Node.js `20.19` 或更高版本。
- Rust stable 与 Cargo：<https://rustup.rs/>。
- Windows 开发需要 WebView2 和 Visual Studio C++ Build Tools。
- Pi Coding Agent 可选但建议安装。模型校验、继续对话、导出 Session 和运行时版本检测需要调用 Pi CLI。

### 安装依赖

```bash
npm ci
```

### 启动 Tauri 开发环境

```bash
npm run tauri dev
```

### 仅启动前端开发服务器

```bash
npm run dev
```

前端开发服务器默认地址是 <http://localhost:1420/>。它适合检查 Vue 界面；调用 Tauri 文件系统和进程命令的功能需要在 Tauri 窗口中运行。

### 构建前端

```bash
npm run build
```

### 预览前端构建结果

```bash
npm run preview
```

### 检查版本一致性

```bash
npm run check:version
```

## 构建 Windows 应用

```bash
npm run tauri build
```

默认输出位置：

- 独立程序：`src-tauri/target/release/pi-switch.exe`
- NSIS 安装包：`src-tauri/target/release/bundle/nsis/`

应用使用 Tauri 2 的无边框窗口，顶部自定义标题栏负责拖动、最小化、最大化/还原和关闭窗口。

## 发布新版本

发布脚本会检查工作区、更新 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json` 和 `src-tauri/Cargo.toml` 的版本，运行版本检查和前端构建，然后创建版本提交与 Git Tag，并原子推送到 GitHub。

```bash
npm run release -- 0.2.7
```

版本号也可以带 `v` 前缀或预发布标识：

```bash
npm run release -- v0.2.7
npm run release -- 0.2.7-beta.1
```

PowerShell 入口同样可用：

```powershell
./scripts/release.ps1 0.2.7
```

推送 `v*` Tag 后，`.github/workflows/release.yml` 会在 GitHub 的 `windows-latest` runner 上构建 Windows x64 应用，并创建包含安装版、便携版和 SHA-256 校验文件的 Release。仓库需要在 **Settings → Actions → General → Workflow permissions** 中允许工作流写入仓库内容。

## GitHub Pages

宣传页源文件位于 `website/`，包括 `index.html`、`styles.css`、`app.js` 和产品界面截图资源。

向 `main` 分支推送以下路径的变更时，`.github/workflows/pages.yml` 会自动把 `website/` 发布到 `gh-pages` 分支：

- `website/**`
- `.github/workflows/pages.yml`

线上地址为 <https://prcabk.github.io/pi-switch/>。也可以在 GitHub Actions 中手动运行 **Deploy GitHub Pages** 工作流。

## 数据位置与工作方式

Pi Switch 不使用云端数据库。Tauri 后端直接读取和写入 Pi 的本地文件：

- 模型配置使用 JSON 解析和原子替换，旧文件在写入前改名为带时间戳的 `.bak` 备份。
- Session 使用逐行 JSON（JSONL）读取，应用不会把 Session 同步到网络。
- 用量统计遍历 Session 文件中的 assistant usage、compaction 和 branch summary 数据。
- Skill 安装只进行本地文件复制，停用使用目录移动。
- `pi.dev` 仅用于模型目录搜索和配置导入，导入入口限制为 `https://pi.dev/models/...`。

## 安全说明

- 建议在 `models.json` 中使用 `$ENV_VAR` 引用 API Key，不要保存明文密钥。
- Pi Switch 不执行安装 Skill 目录中的脚本。
- 停用 Skill 后目录移出 `~/.pi/agent/skills`，Pi Agent 不会扫描停用内容。
- 删除 Session 会直接删除对应的 JSONL 文件，操作前需要二次确认。
- 导入模型配置前会限制来源域名和详情路径，避免将任意网页内容当作配置导入。
- 使用第三方 Skill 前仍应自行审查其内容；安装时虽然不会执行脚本，但 Skill 文件可能会影响 Pi Agent 的后续行为。

## 项目结构

```text
src/                    Vue 组件、路由、前端 API 封装和类型
src/views/              用量、模型、Session、Skill、设置页面
src-tauri/src/          Tauri commands 与 Rust 文件系统/进程逻辑
src-tauri/tauri.conf.json
                        Tauri 窗口、构建和打包配置
scripts/                版本检查与发布脚本
website/                GitHub Pages 宣传页
.github/workflows/      Pages 部署和 Windows Release 工作流
```

## 技术栈

- Tauri 2
- Rust
- Vue 3 + TypeScript
- Vue Router
- Element Plus
- Vite

## 许可证

本项目使用 [MIT License](LICENSE)。
