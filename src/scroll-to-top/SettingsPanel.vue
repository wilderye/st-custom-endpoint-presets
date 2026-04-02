<template>
  <div v-if="visible" class="mes-scroll-settings-overlay">
    <!-- 主大纲面板 (Main Panel) -->
    <div class="mes-scroll-settings-panel">
      <div class="panel-header">
        <h3 class="panel-title">跳顶按钮设置</h3>
        <i title="关闭设置" class="fa-solid fa-xmark close-btn" @click="close"></i>
      </div>

      <div class="setting-item">
        <div class="setting-title">位置微调</div>
        <div class="setting-desc">觉得按钮没对齐？点此校准相对位置</div>
        <button class="calib-btn" @click="calibrationMode = !calibrationMode">
          {{ calibrationMode ? '退出校准模式' : '进入校准模式' }}
        </button>
      </div>

      <!-- 常规设置：仅在非校准模式下显示 -->
      <template v-if="!calibrationMode">
        <!-- 模块二：显示高度阈值 -->
        <div class="setting-item">
          <div class="setting-title">什么情况下才显示此按钮？</div>
          <div class="setting-desc">当前: 当单条消息长度超过屏幕的 {{ Math.round(settings.showThresholdRatio * 100) }}% 时</div>
          <input v-model.number="settings.showThresholdRatio" type="range" min="0.1" max="2" step="0.05" class="w-full" @change="commitSettings" />
        </div>

        <!-- 模块三：长按重置时间 -->
        <div class="setting-item">
          <div class="setting-title">长按多久触发位置重置？</div>
          <div class="setting-desc">当前: {{ settings.longPressMs }} 毫秒 ({{ (settings.longPressMs / 1000).toFixed(1) }}秒)</div>
          <input v-model.number="settings.longPressMs" type="range" min="100" max="2000" step="100" class="w-full" @change="commitSettings" />
        </div>
      </template>

      <!-- 校准模式：取代常规设置 -->
      <template v-else>
        <div class="setting-item">
          <div class="title-row">
            <div class="setting-title">X 轴偏移量 (px)</div>
            <input v-model.number="settings.opticalXOffset" type="number" class="calib-inline-number" @change="commitSettings" />
          </div>
          <div class="setting-desc">手动微调按钮的左右位置</div>
          <input v-model.number="settings.opticalXOffset" type="range" min="-50" max="50" step="1" class="w-full" @change="commitSettings" />
        </div>

        <div class="setting-item">
          <div class="title-row">
            <div class="setting-title">Y 轴偏移量 (px)</div>
            <input v-model.number="settings.opticalYOffset" type="number" class="calib-inline-number" @change="commitSettings" />
          </div>
          <div class="setting-desc">手动微调按钮的上下位置</div>
          <input v-model.number="settings.opticalYOffset" type="range" min="-50" max="50" step="1" class="w-full" @change="commitSettings" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { getSettings, saveSettings } from './settings';
import type { ScrollSettings } from './settings';

const visible = ref(true);
const calibrationMode = ref(false);

const settings = ref<ScrollSettings>(getSettings());

// 拖动结束后才保存并通知 index.ts 刷新按钮
// v-model 仍然实时更新 UI 文字，但实际生效（按钮位置/可见性）只在松手时触发
const commitSettings = () => {
  saveSettings(settings.value);
  window.dispatchEvent(new CustomEvent('scroll-to-top-settings-changed'));
};

const close = () => {
  visible.value = false;
  setTimeout(() => app.unmount(), 300); // 留出一点动画退出的时间（如果外部想做动画）
};

const app = { unmount: () => {} };
defineExpose({ setApp: (v: () => void) => app.unmount = v });
</script>

<style scoped>
/* 最外层遮罩，屏蔽酒馆背后的点击影响但自身透明 */
.mes-scroll-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: flex-start; /* 核心修复：坚决不使用 center 防止顶部溢出被吞没 */
  padding-top: 12vh; /* 固定距离顶部一段距离 */
  font-family: inherit;
  pointer-events: none; /* 让大部分区域能够穿透点击 */
}

/* 主面板自身的背景（继承酒馆主题色泽） */
.mes-scroll-settings-panel {
  pointer-events: auto;
  width: 90%;
  max-width: 320px;
  max-height: 70vh; /* 严格限制面板高度 */
  overflow-y: auto; /* 溢出时从底部截断并出现滚动条 */
  overscroll-behavior: contain; /* 防止滑到底部时连带页面回弹 */
  /* 采用酒馆自带的半透明或模糊变量，如果失效则 fall back 到 rgba 暗色 */
  background-color: var(--SmartThemeBlurTintColor, rgba(30, 30, 30, 0.85));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  color: var(--SmartThemeBodyColor, #e0e0e0);
  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.panel-title {
  margin: 0;
  font-size: 1.1em;
  font-weight: bold;
}

.close-btn {
  cursor: pointer;
  padding: 5px;
  font-size: 1.2em;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

.setting-item {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
}

.setting-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 0.95em;
}

.setting-desc {
  font-size: 0.8em;
  opacity: 0.7;
  margin-bottom: 12px;
  line-height: 1.4;
}

.w-full {
  width: 100%;
}

.calib-btn {
  background: transparent;
  color: inherit;
  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.2));
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  align-self: flex-start;
}

.calib-btn:hover {
  background: var(--SmartThemeQuoteColor, rgba(255, 255, 255, 0.1));
}

.title-row {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.title-row .setting-title {
  margin-bottom: 0;
}

.calib-inline-number {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 38px;
  background: transparent;
  color: inherit;
  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.2));
  border-radius: 3px;
  padding: 1px 0;
  text-align: center;
  font-family: inherit;
  font-size: 0.85em;
  outline: none;
}

/* 隐藏输入框原生加减号箭头 */
.calib-inline-number::-webkit-inner-spin-button,
.calib-inline-number::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.calib-inline-number[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

@media screen and (max-width: 768px) {
  .mes-scroll-settings-overlay {
    padding-top: 5vh;
  }
}
</style>
