# hidden-floor-manager UI 优化方案

## 一、当前 UI "不舒服"的原因诊断

旧版 UI 在酒馆界面中显得突兀、缺乏原生感，并且无法被第三方美化主题很好地覆盖，主要有以下原因：

1. **内联样式泛滥 (Inline Styles)**：
   原来通过 `style="align-items: center; justify-content: center;"`, `style="width: 70px; text-align: center;"` 等内联样式强行排版。内联样式的优先级极高，导致第三方的主题（比如圆角、模糊背景、弹性布局重置等）根本无法覆盖这些元素。
2. **非原生 HTML 标签的使用**：
   直接使用了 `<h3>`、`<p>`、`<b>`。酒馆内部对设置面板的文本样式通常是通过特定的类名（如 `.opacity50`, `.text_pole`）来控制，而非直接写原生语意标签，这导致字体大小和粗细在弹出层中不协调。
3. **缺乏图标引导与酒馆范式**：
   酒馆原生按钮大都带有 `fa-solid fa-xxx` 图标，并且经常满宽展示或 flex 均匀平铺，而旧版只是光秃秃的文本框和生硬的短按钮。
4. **功能区分度弱**：
   从视觉上来看，“隐藏范围管理”和“跳转管理”没有明确的行逻辑分隔，导致用户视线抓取不到重点。

---

## 二、新版 UI 架构设计思路

核心目标：**完全使用酒馆原生的 CSS 原子类** 去组合页面，让它和原生"侧边栏设置面板"一样浑然天成。

用到的原生原子类：
- `flex-container`、`flex-column`：用于实现弹性布局。
- `flexGap5`、 `flexGap10`：原生的间距参数。
- `wide100p`、`flex1`：保证自适应宽度，适配PC和手机。
- `alignitemscenter`、`justifyContentCenter`：对齐控制。
- `text_pole`：原生输入框样式。
- `menu_button`：原生标准按钮样式。
- `opacity50`、`opacity75`：弱化辅助文字信息权重。

---

## 三、新版 DOM 结构设计草图

我们在注入 HTML 时，将采用类似下方的结构范式：

```html
<!-- 最外层容器 -->
<div class="hidden-floor-manager-container wide100p flex-container flex-column flexGap10">

  <!-- ================= 1. 顶部信息区块 ================= -->
  <div class="flex-container flex-space-between alignitemscenter wide100p">
      <span class="opacity75">最新消息层数</span>
      <!-- 弱化显示数字 -->
      <span class="opacity50">${lastId}</span>
  </div>

  <div class="flex-container flex-column flexGap5 wide100p">
      <span class="opacity75">已隐藏楼层：</span>
      <!-- 让长串数字允许自动换行，不再固定高度 -->
      <div id="hfm_hidden_ranges" style="word-break: break-all;">
          <!-- 这里的每一个范围会被做成可被 hover 变色的链接样式 -->
          <!-- 原先提到的点击范围文本预览功能需求已经被你废弃了，这里只提供纯展示 -->
          <span class="opacity75">0-2, 5</span>
      </div>
  </div>

  <hr class="wide100p">

  <!-- ================= 2. 隐藏/显示状态管理 ================= -->
  <div class="flex-container flex-column flexGap5 wide100p">
      <span class="opacity75">范围管理</span>
      <!-- 输入框改用 flex1 自适应平铺，摒弃定宽 -->
      <div class="flex-container alignitemscenter flexGap5 wide100p">
          <input type="number" class="text_pole flex1" placeholder="起始" />
          <span class="opacity50">-</span>
          <input type="number" class="text_pole flex1" placeholder="结束" />
      </div>
      <!-- 按钮区：带有图标的扁平按钮组 -->
      <div class="flex-container flexGap5 wide100p">
          <div class="menu_button flex1 flex-container justifyContentCenter alignitemscenter">
              <i class="fa-solid fa-eye-slash" style="margin-right:0.5em;"></i> 隐藏
          </div>
          <div class="menu_button flex1 flex-container justifyContentCenter alignitemscenter">
              <i class="fa-solid fa-eye" style="margin-right:0.5em;"></i> 显示
          </div>
      </div>
  </div>

  <hr class="wide100p">

  <!-- ================= 3. 楼层跳转全新功能 ================= -->
  <div class="flex-container flex-column flexGap5 wide100p">
      <span class="opacity75">楼层跳转</span>
      <!-- 跳转目标输入区域 -->
      <div class="flex-container alignitemscenter flexGap5 wide100p">
          <input type="number" id="hfm_jump_target" class="text_pole flex1" placeholder="在此输入目标楼层" />
      </div>
      <!-- 跳转操作按钮组 -->
      <div class="flex-container flexGap5 wide100p">
          <div id="hfm_jump_preview_btn" class="menu_button flex1 flex-container justifyContentCenter alignitemscenter">
              <i class="fa-solid fa-magnifying-glass" style="margin-right:0.5em;"></i> 预览跳转
          </div>
          <div id="hfm_jump_direct_btn" class="menu_button flex1 flex-container justifyContentCenter alignitemscenter">
              <i class="fa-solid fa-share" style="margin-right:0.5em;"></i> 直接跳转
          </div>
      </div>
  </div>

</div>
```

### UI 设计上的重大改变：
1. **结构清晰**：利用了原生 `<hr>` 和视觉上的三大块：【数据展示】→【隐藏/显示】→【跳转追踪】。
2. **按钮规范**：不再呈现为单纯的字块，全部配合 `fa-solid` 小图标，这种细节最能提升“原生感”。
3. **消除溢出与强制定宽**：所有输入框用 `flex1`，能与按钮保持完美宽度对齐，整体呈现一种非常规整的面包片堆叠风格；即使在极其狭窄的手机端也不会破版。
4. **文本降噪**：大量使用了 `.opacity75` 和 `.opacity50`。原生 UI 很少使用死黑色，而是用透明度对标签名与实际参数做对比，这样更容易将用户的聚焦点引导到输入框和按钮上。

如果采用这套界面，无论使用了多前沿的花式 UI 美化挂载包（如玻璃拟态、圆角卡片、暗色模式），这三种原生 CSS 配置都能自然吸收其变化，与整体 UI 保持严丝合缝的统一。
