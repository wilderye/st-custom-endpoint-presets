<template>
  <div v-if="visible" class="mes-scroll-settings-overlay">
    <!-- 主面板 -->
    <div class="mes-scroll-settings-panel">
      <div class="panel-header">
        <h3 class="panel-title">跳顶按钮设置</h3>
        <i title="关闭设置" class="fa-solid fa-xmark close-btn" @click="close"></i>
      </div>

      <div class="panel-body">
        <!-- 按钮位置选择 -->
        <div class="setting-item">
          <div class="setting-title">按钮位置</div>
          <div class="setting-desc">选择跳顶按钮在消息底部的位置</div>
          <div class="position-selector">
            <button :class="['pos-btn', { active: settings.position === 'left' }]" @click="setPosition('left')">
              <i class="fa-solid fa-align-left"></i> 左
            </button>
            <button :class="['pos-btn', { active: settings.position === 'center' }]" @click="setPosition('center')">
              <i class="fa-solid fa-align-center"></i> 中
            </button>
            <button :class="['pos-btn', { active: settings.position === 'right' }]" @click="setPosition('right')">
              <i class="fa-solid fa-align-right"></i> 右
            </button>
          </div>
        </div>

        <!-- 位置微调 -->
        <div class="setting-item">
          <div class="setting-title">位置微调</div>
          <div class="setting-desc">觉得按钮没对齐？手动对位置进行调整</div>
          <button class="calib-btn" @click="calibrationMode = !calibrationMode">
            {{ calibrationMode ? '退出微调模式' : '手动微调偏移' }}
          </button>
        </div>

        <!-- 常规设置：仅在非微调模式下显示 -->
        <template v-if="!calibrationMode">
          <!-- 重新校准 -->
          <div class="setting-item">
            <div class="setting-title">与当前主题重新对齐</div>
            <div class="setting-desc">
              切换美化时，会自动重新对齐，此为备用措施。手动微调数值叠加在对齐后数值之上，重新对齐不会丢失您的微调数值
            </div>
            <button class="calib-btn" @click="recalibrate">
              <i class="fa-solid fa-arrows-rotate"></i> 重新对齐
            </button>
          </div>

          <!-- 显示高度阈值 -->
          <div class="setting-item">
            <div class="setting-title">什么情况下才显示此按钮？</div>
            <div class="setting-desc">
              当前: 当单条消息长度超过屏幕的 {{ Math.round(settings.showThresholdRatio * 100) }}% 时
            </div>
            <input
              v-model.number="settings.showThresholdRatio"
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              class="w-full"
              @change="commitSettings"
            />
          </div>
        </template>

        <!-- 微调模式：取代常规设置 -->
        <template v-else>
          <div class="setting-item">
            <div class="title-row">
              <div class="setting-title">X 轴偏移量 (px)</div>
              <input
                v-model.number="settings.opticalXOffset"
                type="number"
                class="calib-inline-number"
                @input="previewSettings"
                @change="commitSettings"
              />
            </div>
            <div class="setting-desc">手动微调按钮的左右位置</div>
            <input
              v-model.number="settings.opticalXOffset"
              type="range"
              min="-50"
              max="50"
              step="1"
              class="w-full"
              @input="previewSettings"
              @change="commitSettings"
            />
          </div>

          <div class="setting-item">
            <div class="title-row">
              <div class="setting-title">Y 轴偏移量 (px)</div>
              <input
                v-model.number="settings.opticalYOffset"
                type="number"
                class="calib-inline-number"
                @input="previewSettings"
                @change="commitSettings"
              />
            </div>
            <div class="setting-desc">手动微调按钮的上下位置</div>
            <input
              v-model.number="settings.opticalYOffset"
              type="range"
              min="-50"
              max="50"
              step="1"
              class="w-full"
              @input="previewSettings"
              @change="commitSettings"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ScrollSettings } from './settings';
import { getSettings, saveSettings } from './settings';

const visible = ref(true);
const calibrationMode = ref(false);

const settings = ref<ScrollSettings>(getSettings());

const commitSettings = () => {
  saveSettings(settings.value);
  window.dispatchEvent(new CustomEvent('scroll-to-top-settings-changed'));
};

const previewSettings = () => {
  window.dispatchEvent(
    new CustomEvent('scroll-to-top-settings-preview', {
      detail: { x: settings.value.opticalXOffset, y: settings.value.opticalYOffset },
    }),
  );
};

const setPosition = (pos: 'left' | 'center' | 'right') => {
  settings.value.position = pos;
  commitSettings();
};

const recalibrate = () => {
  window.dispatchEvent(new CustomEvent('scroll-to-top-recalibrate'));
};

const close = () => {
  visible.value = false;
  setTimeout(() => app.unmount(), 300);
};

const app = { unmount: () => {} };
defineExpose({ setApp: (v: () => void) => (app.unmount = v) });
</script>

<style scoped>
.mes-scroll-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  font-family: inherit;
  pointer-events: none;
}

.mes-scroll-settings-panel {
  pointer-events: auto;
  width: 90%;
  max-width: 320px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background-color: var(--SmartThemeBlurTintColor, rgba(30, 30, 30, 0.85));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  color: var(--SmartThemeBodyColor, #e0e0e0);
  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px 12px 24px;
  flex-shrink: 0;
}

.panel-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 24px 16px 24px;
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

/* 位置选择器 */
.position-selector {
  display: flex;
  gap: 8px;
}

.pos-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: inherit;
  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.2));
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9em;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.pos-btn:hover {
  opacity: 0.9;
  background: var(--SmartThemeQuoteColor, rgba(255, 255, 255, 0.05));
}

.pos-btn.active {
  opacity: 1;
  border-color: var(--SmartThemeQuoteColor, rgba(255, 255, 255, 0.5));
  background: var(--SmartThemeQuoteColor, rgba(255, 255, 255, 0.1));
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
  display: flex;
  align-items: center;
  gap: 6px;
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

.calib-inline-number::-webkit-inner-spin-button,
.calib-inline-number::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.calib-inline-number[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}

@media screen and (max-width: 768px) {
  .mes-scroll-settings-overlay {
    padding-top: 5vh;
  }
  .mes-scroll-settings-panel {
    max-height: 60vh;
  }
}
</style>
