# SillyTavern API 设置体系

> 来源：`SillyTavern-release/public/scripts/openai.js` 和 `extensions/connection-manager/index.js`

## 三层架构

### 1. oai_settings（运行时设置）

- **位置**：内存中的全局对象，持久化到 `settings.json`
- **内容**：所有聊天补全相关设置（约100个字段），包括生成参数和连接设置
- **自动保存机制**：每个输入框都绑定了 `input` 事件，修改后立即调用 `saveSettingsDebounced()`
  - 例：`$('#custom_api_url_text').on('input', () => { oai_settings.custom_url = ...; saveSettingsDebounced(); })`
  - **因此：即使不点任何保存按钮，关闭重开酒馆后仍然保持最后输入的值**

### 2. Chat Completion Preset（对话补全预设）

- **位置**：服务器上的 JSON 文件，通过 `/api/presets/save` 持久化
- **保存函数**：`saveOpenAIPreset()` → `getChatCompletionPreset()`
- **保存内容**：`settingsToUpdate` 中所有 key 的值（包含生成参数和连接设置）

#### settingsToUpdate 字段分类

每个字段格式：`[selector, setting_name, is_checkbox, is_connection]`

**连接设置（is_connection = true）**：
- `chat_completion_source`, `custom_url`, `custom_model`, `custom_include_body`, `custom_exclude_body`, `custom_include_headers`, `custom_prompt_post_processing`
- `openai_model`, `claude_model`, `openrouter_model` 及所有平台 model
- `reverse_proxy`, `proxy_password`, `show_external_models`, `bypass_status_check`
- Azure 相关：`azure_base_url`, `azure_deployment_name`, `azure_api_version`, `azure_openai_model`
- VertexAI 相关：`vertexai_auth_mode`, `vertexai_region`, `vertexai_express_project_id`

**生成参数（is_connection = false）**：
- 采样参数：`temperature`, `top_p`, `top_k`, `min_p`, `top_a`, `freq_pen`, `pres_pen`, `repetition_penalty`
- 上下文：`openai_max_context`, `openai_max_tokens`, `max_context_unlocked`
- 提示词：`prompts`, `prompt_order`, `impersonation_prompt`, `new_chat_prompt` 等
- 功能开关：`stream_openai`, `function_calling`, `show_thoughts`, `enable_web_search` 等

#### 切换预设时的行为

由 `bind_preset_to_connection`（默认 true）控制：
- **true**：切换预设时更新所有字段（包括连接设置）
- **false**：切换预设时跳过 `is_connection = true` 的字段

#### sensitiveFields

这些字段在预设导出/分享时可能被排除：
`reverse_proxy`, `proxy_password`, `custom_url`, `custom_include_body`, `custom_exclude_body`, `custom_include_headers`, `vertexai_region`, `vertexai_express_project_id`, `azure_base_url`, `azure_deployment_name`

### 3. Connection Profile（API连接配置）

- **所属**：内置扩展 `connection-manager`
- **位置**：`extension_settings.connectionManager.profiles` 数组，保存到 `settings.json`
- **每个 profile 的结构**：

```js
{
  id: string,        // UUID
  name: string,      // 用户命名
  mode: "cc" | "tc", // 聊天补全 or 文本补全
  exclude: string[], // 排除的命令列表

  // 以下均为可选，取决于 mode 和 exclude
  "api": string,                    // API 来源
  "preset": string,                 // 对话补全预设名
  "api-url": string,                // 服务器 URL
  "model": string,                  // 模型名
  "proxy": string,                  // 反向代理预设名
  "stop-strings": string,           // 自定义停止字符串
  "start-reply-with": string,       // 以...开始回复
  "reasoning-template": string,     // 推理模板
  "prompt-post-processing": string, // 提示词后处理
  "secret-id": string,              // API Key 引用 ID
  "regex-preset": string,           // 正则预设
}
```

#### 切换 Profile 时的行为

按顺序执行 STScript 斜杠命令（聊天补全模式下）：

1. `/api` → 设置 API 来源
2. `/preset` → 切换对话补全预设
3. `/api` → **再次**设置 API 来源（因为预设可能覆盖了它）
4. `/api-url` → 设置 URL
5. `/model` → 设置模型
6. `/proxy` → 设置代理
7. `/stop-strings` → 停止字符串
8. `/start-reply-with` → 开始回复
9. `/reasoning-template` → 推理模板
10. `/prompt-post-processing` → 提示词后处理
11. `/secret-id` → API Key
12. `/regex-preset` → 正则预设

## 反向代理预设系统

独立于以上三层的小型预设系统：
- **数据**：全局 `proxies` 数组，每项 `{ name, url, password }`
- **存储**：`settings.json` 的 `proxies` 和 `selected_proxy` 字段
- **UI**：`#openai_proxy_preset` 下拉框 + `#save_proxy` / `#delete_proxy` 按钮
- **HTML 位置**：index.html 约 2890-2946 行

## 自定义端点（Custom）的 UI 结构

HTML id `#custom_form`（index.html 约 3736-3767 行）：
- `#custom_api_url_text` — URL 输入框
- `#api_key_custom` — API Key 输入框（通过 secrets 后端存储，key 名 `api_key_custom`）
- `#custom_model_id` — 模型名输入框（带 datalist 自动补全）
- `#model_custom_select` — 可用模型下拉框

## Secrets（API Key 管理）系统

> 来源：`scripts/secrets.js`

### 数据结构

每个 API 类型（如 `api_key_custom`）可以存储**多个** Key，每个 Key 有：

```js
{
  id: "622095a9-3c35-40fb-9956-fd2e56052cdc",  // UUID，唯一标识
  label: "03/28/2026 1:56 AM",                   // 显示标签（默认为保存时间）
  value: "sk-****",                               // 脱敏显示值
  active: true                                    // 是否为当前激活的 Key
}
```

所有 Key 的状态存储在前端的 `secret_state` 对象中（通过 `/api/secrets/read` 从后端获取）。

### 关键 API

| 函数 | 用途 | 后端接口 |
|---|---|---|
| `writeSecret(key, value, label)` | 添加新 Key | `POST /api/secrets/write`，返回 `{ id }` |
| `rotateSecret(key, id)` | **切换**激活的 Key（按 ID） | `POST /api/secrets/rotate` |
| `deleteSecret(key, id)` | 删除 Key | `POST /api/secrets/delete` |
| `findSecret(key, id)` | 获取 Key 明文值（需服务器配置允许） | `POST /api/secrets/find` |
| `renameSecret(key, id, label)` | 重命名 Key 标签 | `POST /api/secrets/rename` |
| `readSecretState()` | 刷新前端的 `secret_state` | `POST /api/secrets/read` |

### 切换 Key 的机制

`rotateSecret('api_key_custom', id)` 做了三件事：
1. 调用 `POST /api/secrets/rotate` 让后端把该 ID 的 Key 设为 active
2. 调用 `readSecretState()` 刷新前端状态
3. 触发 `$('#main_api').trigger('change')` 强制重新连接 API

### STScript 命令

- `/secret-id [id]` — 切换激活的 Key（支持按 ID 或按 label 查找）
- `/secret-id` (无参数) — 返回当前激活的 Key 的 ID
- 可通过 `key=api_key_custom` 指定 Key 类型

### 对脚本开发的意义

**可以只存 Secret ID（UUID），不需要存实际的 Key 值。** 切换端点时调用 `rotateSecret('api_key_custom', savedId)` 即可安全切换。
