# Pi Switch 操作说明

Pi Switch 是 [Pi Coding Agent](https://pi.dev) 的 Windows 桌面管理工具。它把模型配置、对话历史、Skill、Token 用量集中在一个界面里，所有数据都保存在你的本机，不会上传到云端。

本面向**终端用户**，说明每个功能页面的操作方法。

---

## 目录

- [准备与首次启动](#准备与首次启动)
- [用量统计](#用量统计)
- [模型管理](#模型管理)
  - [新增 / 编辑 Provider](#新增--编辑-provider)
  - [新增 / 编辑模型](#新增--编辑模型)
  - [从 pi.dev 批量导入模型](#从-pidev-批量导入模型)
  - [从 Provider /v1/models 拉取模型并导入](#从-provider-v1models-拉取模型并导入)
  - [校验与保存](#校验与保存)
- [对话管理](#对话管理)
- [Skill 管理](#skill-管理)
- [应用设置](#应用设置)
- [常见问题](#常见问题)

---

## 准备与首次启动

1. 先安装 Pi Coding Agent，并确认终端能运行 `pi --version`。
2. 启动 Pi Switch。首次启动会自动读取 Pi 的默认目录：
   - 模型配置：`~/.pi/agent/models.json`
   - 对话记录：`~/.pi/agent/sessions`
   - Skill：`~/.pi/agent/skills`
3. 如果 `pi` 不在系统 `PATH` 中，或你想用自定义路径，请到 [应用设置](#应用设置) 页填写。

界面左侧是导航，顶部有自定义标题栏（可拖动、最小化、最大化/还原、关闭）。默认首页是「用量统计」。

---

## 用量统计

应用启动后的默认首页。数据直接来自本地对话记录文件，不填充示例数据。

页面包含：

- **累计指标**：累计 Token、今日 Token、总费用、请求数、消息数、Session 数。
- **Token 构成**：输入 / 输出 / 缓存读取 / 缓存写入的占比。
- **趋势图**：按日期查看 Token 与费用变化。
- **排行榜**：按模型、按 Provider 查看用量分布。

操作：

- 点击右上角「刷新」重新读取本地数据。
- 若本地没有对话记录或记录里没有 usage 数据，对应数值会显示为 0。

---

## 模型管理

可视化编辑 `models.json` 中的 Provider 和模型配置。页面分左右两栏：左侧是 Provider 列表，右侧是当前选中 Provider 的详情和模型表。

### 新增 / 编辑 Provider

1. 点击左栏 Providers 标题旁的「新增」按钮，或在右栏点「编辑」修改当前 Provider。
2. 在弹窗中填写：
   - **Provider ID**：唯一标识，例如 `openai`、`长红`。保存后不建议随意改动。
   - **API 类型**：`openai-completions` / `openai-responses` / `anthropic-messages` / `google-generative-ai`。
   - **Base URL**：服务地址，例如 `https://api.example.com/v1`。留空则使用 Pi 内置地址。
   - **API Key**：建议用 `$ENV_VAR` 环境变量引用，避免保存明文密钥。
   - **自动添加 Authorization: Bearer 请求头**：按需勾选。
   - **自定义 Headers（JSON）**：额外请求头。
   - **模型配置（JSON 数组）**：该 Provider 下所有模型的完整 JSON 配置，可直接编辑。
3. 点击「应用」保存到内存。此时**还未写入磁盘**，需点顶部「保存配置」才会真正生效。

删除 Provider：在右栏点「删除」，二次确认后移除（同样需保存才生效）。

### 新增 / 编辑模型

1. 在右栏模型列表上方点「新增模型」，或点某行的「编辑」。
2. 填写模型信息：
   - **模型 ID**：调用时使用的真实 ID，例如 `gpt-5.5`。
   - **显示名称**：可选，便于辨认。
   - **支持推理**：开关。
   - **输入类型**：文本 / 图片。
   - **上下文窗口**、**最大输出 Tokens**。
   - **价格（美元 / 百万 tokens）**：输入、输出、缓存读取、缓存写入。
3. 点「应用」加入模型列表。

> 模型 ID 在同一 Provider 内不能重复。删除模型同样需二次确认，并需保存才生效。

### 从 pi.dev 批量导入模型

当你想从 pi.dev 模型目录把模型配置导入当前 Provider 时：

1. 点击顶部「从 pi.dev 导入」按钮，打开导入对话框。
2. 输入模型名称（如 `gpt-5.5`）或 Provider（如 `openai`），点「搜索」。
3. 搜索结果表格会出现多选列：
   - **批量导入**：勾选若干模型行，点右上角「批量导入选中」按钮。应用会逐个拉取这些模型的配置并合并进**当前选中的 Provider**，按模型 ID 去重。
   - **单条预览导入**：点某行的「获取配置」可先预览该模型的完整 JSON 配置，再在预览页点「导入配置」导入。
4. 导入成功后会有提示，记得回主页点「保存配置」写入磁盘。

### 从 Provider /v1/models 拉取模型并导入

很多 Provider 的 Base URL 后接 `/models` 就是 OpenAI 兼容的模型列表接口。Pi Switch 可以直接拉取这个接口，再用拿到的模型 ID 去 pi.dev 精准搜索并批量导入。

操作流程（两步式）：

1. 在右栏 ACTIVE PROVIDER 工具栏点「从 /v1/models 获取」。
2. 应用会用**当前 Provider 的 Base URL + apiKey** 请求 `{baseUrl}/models`，拉到该 Provider 支持的所有模型 ID。
   - 鉴权规则：只要 Provider 配置了明文 apiKey（非 `$`/`!` 环境变量引用），就会自动带上 `Authorization: Bearer` 请求头。
3. **第一步——选择模型 ID**：在表格中勾选你想要的 model ID，点「搜索 pi.dev」。
4. **第二步——按 Provider 分组选择**：应用会用每个选中 ID 去 pi.dev 精准搜索，把命中结果**按 Provider 分组**展示：
   - 每组标题有全选复选框，显示命中数量。
   - 你可以勾选具体要导入的模型。
5. 点「批量导入」，把勾选的模型配置合并进当前选中 Provider，按模型 ID 去重。
6. 导入完成后，回主页点「保存配置」写入磁盘。

> 没拉到模型？检查 Base URL 是否正确（如 `https://api.example.com/v1` 或 `http://127.0.0.8317/v1`）、apiKey 是否有效、Provider 是否支持 OpenAI 兼容的 `/v1/models` 端点。

### 校验与保存

- **运行 pi --list-models**：在右栏底部点此按钮，调用 Pi CLI 校验当前配置是否可用，结果在弹窗里展示。建议在保存前先校验。
- **保存配置**：点顶部「保存配置」写入 `models.json`。写入前会自动生成带时间戳的 `.bak` 备份文件，并保留未知字段以兼容 Pi 后续版本。
- **重新加载**：放弃当前内存改动，重新从磁盘读取配置。

> 所有编辑（新增/删除/导入）都先作用于内存，只有点「保存配置」才会真正改写磁盘文件。

---

## 对话管理

递归扫描 `~/.pi/agent/sessions/**/*.jsonl`，浏览和管理 Pi 的历史对话。

页面功能：

- **搜索**：按对话名称、ID、项目目录或模型过滤。
- **对话列表**：显示每条对话的名称、项目路径、创建/修改时间、消息数、Token 数、费用、使用的模型等。
- **查看详情**：点击对话展开消息时间线，可查看用户消息、Pi 回复、思考内容、工具调用与结果、模型切换、上下文压缩记录等。支持折叠/展开思考内容。
- **继续对话**：在原工作目录调用 `pi --session <id>` 继续对话。
- **重命名**：修改对话显示名称。
- **导出**：把对话导出为 HTML 文件。
- **删除**：直接删除对应的 JSONL 文件，操作前需二次确认，**不可恢复**。
- **刷新**：重新扫描本地对话。

---

## Skill 管理

管理 `~/.pi/agent/skills` 下的 Skill。

功能：

- **安装 Skill**：从本地目录安装，来源目录必须包含 `SKILL.md`。安装过程**只复制文件，不执行任何脚本**。
- **启用 / 停用**：
  - 停用时把 Skill 移到同级的 `~/.pi/agent/skills-disabled` 目录，Pi Agent 不会扫描该目录，可无损恢复。
  - 启用时移回 `skills` 目录。
- **卸载**：从受管目录移除 Skill，卸载前会校验目录结构，避免误删任意路径。
- **查看信息**：Skill 名称、描述、文件数量、更新时间、当前状态。
- **刷新**：重新读取 Skill 目录。

> 安全提示：安装虽不执行脚本，但 Skill 文件可能影响 Pi Agent 后续行为，使用第三方 Skill 前请自行审查内容。

---

## 应用设置

在此覆盖 Pi Switch 读取的默认路径：

| 配置项 | 默认位置 |
| --- | --- |
| Pi 可执行文件 | `pi`（从系统 PATH 查找） |
| 模型配置 | `~/.pi/agent/models.json` |
| Session 目录 | `~/.pi/agent/sessions` |
| Skill 目录 | `~/.pi/agent/skills` |

- 留空时使用默认位置。
- 自定义路径只保存在本机 WebView 的 `localStorage` 中，不会上传服务器。
- 修改后保存，相关页面会按新路径重新读取。

---

## 常见问题

**Q：编辑了模型/Provider，重启后没了？**
A：编辑只保存在内存，必须点「保存配置」才会写入磁盘。

**Q：「从 /v1/models 获取」报 401 Unauthorized？**
A：说明请求没带 API Key。请确认当前 Provider 配置了有效的明文 apiKey；若用的是 `$ENV_VAR` 环境变量引用，Pi Switch 无法在请求时解析它，请改用明文 key（仅用于本地拉取，注意安全）。

**Q：「从 /v1/models 获取」拉到的列表为空？**
A：检查 Base URL 是否正确、服务是否支持 OpenAI 兼容的 `/v1/models` 端点、以及 apiKey 是否有访问权限。

**Q：导入模型后 pi 报错？**
A：先用「运行 pi --list-models」校验配置，按报错信息修正后再保存。

**Q：删除对话能找回吗？**
A：不能。删除会直接删 JSONL 文件，操作前会二次确认，请谨慎。

**Q：API Key 安全吗？**
A：建议在 `models.json` 中用 `$ENV_VAR` 引用 API Key，不要保存明文。Pi Switch 本身不上传任何数据。

**Q：应用启动失败？**
A：Windows 需要 WebView2 运行环境。请安装或更新 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) 后重试。

---

如需开发者文档（构建、发布、源码结构），请参考 [README.md](README.md)。
