# hidden-floor-manager 跳转功能设计方案

## 一、功能定位

楼层跳转是 hidden-floor-manager 面板中的**独立功能**，与"隐藏楼层"、"显示楼层"**并列**。

## 二、主面板 UI

采用酒馆原生 CSS 原子类（如 `flex1`, `opacity75`, `menu_button` 等）重构布局，消除生硬的内联定宽，实现响应式撑满排列和对所有第三方主题的兼容覆盖。

```
<!-- 最外层使用 flex-container flex-column flexGap10 统一排版 -->
┌───────────────────────────────────────────────┐
│ 最新消息层数 (opacity75)        499(opacity50)│ 
│                                               │
│ 已隐藏楼层：(opacity75)                       │
│ 0-2, 5, 7-8                                   │
│ ───────────────────────────────────────────── │
│ 范围管理 (opacity75)                          │
│ [ 起始楼层(flex1) ] - [ 结束楼层(flex1) ]     │
│ [👁️‍🗨️隐藏 (flex1)]      [👁️显示 (flex1)]        │
│ ───────────────────────────────────────────── │
│ 楼层跳转 (opacity75)                          │
│ [ 在此输入目标楼层 (flex1)                  ] │
│ [🔍预览跳转(flex1)]     [↪️直接跳转(flex1)]    │
└───────────────────────────────────────────────┘
```

**新增功能区域说明：**
- **目标楼层输入框**：数字 input
- **预览跳转按钮**：点击后打开预览页面
- **直接跳转按钮**：点击后直接调用原生 `executeSlashCommandsWithOptions`

**UI 特性：**
- **降噪设计**：指示性文本（如“范围管理”、“楼层跳转”）使用 `.opacity75` 和 `.opacity50`，将用户的视觉强引导至高亮的输入框和按钮。
- **响应式对齐 (方块堆积布局)**：输入框和按钮统一使用原生 `.flex1`，自动均分容器空间完美铺满、上下行对齐。
- **指示图标**：所有的交互按钮均引入现有的 `fa-solid` FontAwesome 原生字体图标（如 `fa-eye-slash`, `fa-eye`, `fa-magnifying-glass`, `fa-share`）提升原生感。

## 三、"直接跳转"逻辑

0. 前置检查：如果 `SillyTavern.chat.length === 0`，toast 提示"需要先打开一个聊天"，返回
1. 读取输入框中的目标楼层，使用 `Math.floor()` 取整得到 `targetIndex`
2. 校验范围 `[0, lastMessageId]`
3. 计算真正需要渲染的层数差值 `gap`：获取当前 DOM 中已渲染的第一条消息 ID（`firstId = Number(document.querySelector('#chat .mes')?.getAttribute('mesid')) || 0`），`gap = Math.max(0, firstId - targetIndex)`。querySelector 返回 null 时 firstId 默认为 0（不弹确认）。
4. 如果 `gap > 100`，通过 `SillyTavern.callGenericPopup(..., SillyTavern.POPUP_TYPE.CONFIRM)` 弹出确认框：

   > `需渲染楼层数较多，可能造成卡顿一段时间后跳转，是否跳转？`
   > `[是] [否]`

5. 确认后调用 `SillyTavern.executeSlashCommandsWithOptions('/chat-jump ' + targetIndex)`

## 四、"预览跳转"页面

### 4.1 页面结构（遵循相同的原生 UI 范式）

```
┌─────────────────────────────────────────────┐
│ 楼层预览（标题）                            │
│ ─────────────────────────────────────────   │
│ 目标楼层 (opacity75)                        │
│ [ 目标楼层输入 (flex1) ]         [🔍预览]   │
│                                             │
│ [        ⬆️ 显示更多楼层 (wide100p)       ] │
│ ─────────────────────────────────────────   │
│ #40 [角色名] (opacity75)               [↪️] │
│ ┌─────────────────────────────────────┐     │
│ │ 消息内容前几行...                   │     │
│ │ [展开 ▾]                            │     │
│ └─────────────────────────────────────┘     │
│                                             │
│ #41 [用户名] (opacity75)               [↪️] │
│ ┌─────────────────────────────────────┐     │
│ │ 消息内容前几行...                   │     │
│ │ [展开 ▾]                            │     │
│ └─────────────────────────────────────┘     │
│ ... (共 21 条)                              │
│                                             │
│ #50 [角色名] ← 中心楼层 框体高亮       [↪️] │
│ ┌─────────────────────────────────────┐     │
│ │ 完整消息内容...                     │     │
│ └─────────────────────────────────────┘     │
│ ...                                         │
│ ─────────────────────────────────────────   │
│ [        ⬇️ 显示更多楼层 (wide100p)       ] │
└─────────────────────────────────────────────┘
```

### 4.2 初始加载

- 读取目标楼层 `target`，使用 `Math.floor()` 取整并校验范围
- 计算范围 `[max(0, target-10), min(lastId, target+10)]`
- 直接遍历 `SillyTavern.chat[i]` 获取消息数据
- 逐条渲染到弹窗中

### 4.3 消息渲染

每条消息由以下部分组成：
- **楼层号** + **发送者名称**（角色/用户）
- **消息内容区域**：使用 `SillyTavern.messageFormatting(msg.mes, senderName, msg.is_system, msg.is_user, mesid)` 渲染完整内容
  - 默认折叠，只显示前几行（CSS `max-height` + `overflow: hidden`）
  - 点击"展开"按钮后显示完整内容
  - 中心楼层（目标楼层）默认展开并添加高亮样式
- **跳转图标按钮**：位于右下角，点击后**先弹确认框**（若 gap > 100），确认"是"后再关闭预览弹窗并调用 `SillyTavern.executeSlashCommandsWithOptions('/chat-jump ' + mesid)`
  - gap 小于等于 100 时直接关闭弹窗并跳转，不弹确认

### 4.4 范围编辑与重新预览

顶部的 `[目标楼层] [预览]` 区域：
- 一个数字输入框，初始值为当前预览的目标楼层
- 用户可输入新的目标楼层，点击"预览"按钮后以新目标为中心重新计算 +/-10 范围，清空列表并重新渲染
- 点击"显示更多"不更新该输入框的值，输入框仅在用户手动修改时改变

### 4.5 "显示更多楼层"按钮

- **顶部按钮 `[显示更多楼层 ↑]`**：点击后将原范围向上扩展 10 层（如 40 变成 30），如果到顶 (0) 则隐藏该按钮。
- **底部按钮 `[显示更多楼层 ↓]`**：点击后将原范围向下扩展 10 层（如 60 变成 70），如果到达最新楼层则隐藏该按钮。
- **渲染策略**：点击后计算新范围 `[newStart, newEnd]`，重新渲染列表（清空并重建 HTML）。**不自动滚动**，由用户自行操作。
- **输入框不受影响**：点击"显示更多"不更新顶部目标楼层输入框的值，该值保持跳转时的原始值。

## 五、技术方案

### 5.1 使用的 API

> 优先使用酒馆原生接口，避免依赖第三方酒馆助手封装可能引入的 bug。
> 仅在原生接口极其难用时才考虑酒馆助手接口。

| API | 用途 |
|---|---|
| `SillyTavern.chat[index]` | 直接下标访问消息数据（`.mes` 文本、`.name` 发送者、`.is_user`、`.is_system` 隐藏状态） |
| `SillyTavern.chat.length - 1` | 获取最新楼层号 |
| `SillyTavern.messageFormatting(mes, ch_name, is_system, is_user, message_id)` | 将消息文本渲染为 HTML（含 Markdown、正则、DOMPurify） |
| `SillyTavern.executeSlashCommandsWithOptions('/chat-jump N')` | 执行原生楼层跳转 |
| `SillyTavern.callGenericPopup(content, type, inputValue?, options?)` | 弹出弹窗 |
| `SillyTavern.POPUP_TYPE.CONFIRM / DISPLAY` | 弹窗类型 |
| `SillyTavern.name1` / `SillyTavern.name2` | 用户名 / 角色名 |

### 5.2 文件改动

#### [MODIFY] index.ts

**同时重构现有代码**：将 `refreshHiddenDisplay()` 中的 `getChatMessages(range, {hide_state:'hidden'})` 替换为遍历 `SillyTavern.chat` 检查 `is_system === true`；将 `triggerSlash('/hide ...')` 替换为 `SillyTavern.executeSlashCommandsWithOptions('/hide ...')`。

1. **主面板 `openPanel()` 新增跳转区域**：
   - 在"隐藏/显示"按钮行下方新增分隔线和跳转区域
   - 包含输入框和两个按钮

2. **新增 `openPreviewPopup(targetIndex)`**：
   - 构建预览弹窗 DOM
   - 遍历 `SillyTavern.chat[i]` 获取数据
   - 渲染消息列表
   - 绑定展开/折叠、跳转、加载更多的事件

3. **新增 `doDirectJump(targetIndex)`**：
   - 校验 + 距离检查 + 确认框 + `executeSlashCommandsWithOptions`

4. **新增 `renderMessageItem(msg, mesid, isCenter)`**：
   - 渲染单条消息的 DOM 构建逻辑

5. **新增 `loadMoreMessages(direction, currentRange)`**：
   - 向上/向下加载更多消息，重新渲染列表

### 5.3 样式

使用内联样式或在 DOM 中注入 `<style>` 标签，不新增 CSS 文件。主要样式：
- 消息条目的折叠/展开
- 中心楼层的高亮背景
- 跳转图标按钮的定位
- 隐藏楼层的视觉标记（如半透明/斜体）

## 六、交互流程图

```
主面板
├── 输入目标楼层: 50
├── [预览跳转] ──→ 打开预览弹窗
│                   ├── 显示楼层 40-60（目标 50 为中心）
│                   ├── 范围可编辑 [40]-[60] [预览]
│                   ├── [显示更多楼层 ↑] → 加载 30-39
│                   ├── 每条消息折叠显示，可展开
│                   ├── 每条消息 [↗] → 关闭弹窗 + chat-jump
│                   └── [显示更多楼层 ↓] → 加载 61-70
│
└── [直接跳转] ──→ gap > 100? → 确认框 → chat-jump
```

## 七、待确认事项

无。方案完整，可以开始实现。
