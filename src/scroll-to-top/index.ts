import { teleportStyle } from '@util/script';

/**
 * 楼层顶部跳转按钮脚本
 *
 * 在长消息楼层底部注入一个 ⏫ 按钮，点击后平滑滚动到该楼层顶部。
 * - 按钮作为 .mes 的直接子元素，使用 position: absolute 定位
 * - 三个预设位置：左（对齐 swipe_left）、中（CSS 居中）、右（对齐 swipe_right）
 * - 通过 CSS 自定义属性桥接实现响应式定位：JS 读 swipe 元素 computedStyle → 写入 CSS 变量
 * - 监听 SETTINGS_UPDATED 事件自动同步位置（切换主题后）
 * - 长按弹出设置面板
 * - 通过事件委托挂在 #chat 上，性能优秀
 */

import './style.scss';

import { createApp } from 'vue';
import SettingsPanel from './SettingsPanel.vue';
import { getSettings } from './settings';

let currSettings = getSettings();

/**
 * =======================================================
 *                      内部常量与逻辑
 * =======================================================
 */

/** 按钮的标识 class，用于去重和清理 */
const BTN_CLASS = 'mes_scroll_to_top';

/**
 * 将 swipe_left / swipe_right 的位置信息写入 CSS 自定义属性。
 * CSS 规则通过 var(--stt-xxx) 引用这些值，实现响应式定位。
 */
function syncPositionVars(): void {
  const root = window.parent.document.documentElement;

  // 读取 swipe_left 的位置
  const swipeLeft = $('#chat .swipe_left').get(0);
  if (swipeLeft) {
    const cs = window.parent.getComputedStyle(swipeLeft);
    const left = parseFloat(cs.left);
    if (!isNaN(left)) {
      root.style.setProperty('--stt-left', `${left}px`);
    }
    root.style.setProperty('--stt-bottom', cs.bottom);

    // 同步排版属性（按钮需要与 swipe 视觉一致）
    root.style.setProperty('--stt-width', cs.width);
    root.style.setProperty('--stt-height', cs.height);
    root.style.setProperty('--stt-font-size', cs.fontSize);
    root.style.setProperty('--stt-line-height', cs.lineHeight);
  }

  // 读取 swipe_right 的距右距离
  const swipeRight = $('#chat .swipe_right').get(0);
  if (swipeRight) {
    const mesEl = $(swipeRight).closest('.mes').get(0);
    if (mesEl) {
      const mesRect = mesEl.getBoundingClientRect();
      const srRect = swipeRight.getBoundingClientRect();
      const rightOffset = mesRect.right - srRect.right;
      root.style.setProperty('--stt-right', `${rightOffset}px`);
    }
  }
}

/**
 * 清理写入的 CSS 自定义属性
 */
function cleanupPositionVars(): void {
  const root = window.parent.document.documentElement;
  const vars = [
    '--stt-left',
    '--stt-bottom',
    '--stt-right',
    '--stt-width',
    '--stt-height',
    '--stt-font-size',
    '--stt-line-height',
    '--stt-optical-x',
    '--stt-optical-y',
  ];
  vars.forEach(v => root.style.removeProperty(v));
}

/**
 * 实时同步预览的光学偏移变量到 CSS
 */
function syncOpticalVars(x = currSettings.opticalXOffset, y = currSettings.opticalYOffset): void {
  const root = window.parent.document.documentElement;
  root.style.setProperty('--stt-optical-x', `${x}px`);
  root.style.setProperty('--stt-optical-y', `${y}px`);
}

/**
 * 为按钮应用位置相关的 class 和 inline style
 */
function applyPositionToButton(btn: HTMLElement): void {
  const pos = currSettings.position;

  // 清除旧的位置 class 和 inline style
  btn.classList.remove('pos-left', 'pos-center', 'pos-right');
  btn.style.left = '';
  btn.style.right = '';
  btn.style.transform = '';
  btn.style.marginLeft = '';

  // 同步排版属性（所有位置通用）
  const root = window.parent.document.documentElement;
  const cs = window.parent.getComputedStyle(root);
  const width = cs.getPropertyValue('--stt-width').trim();
  const height = cs.getPropertyValue('--stt-height').trim();
  const fontSize = cs.getPropertyValue('--stt-font-size').trim();
  const lineHeight = cs.getPropertyValue('--stt-line-height').trim();

  if (width) btn.style.width = width;
  if (height) btn.style.height = height;
  if (fontSize) btn.style.fontSize = fontSize;
  if (lineHeight) btn.style.lineHeight = lineHeight;
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';

  // 根据位置设置水平定位
  if (pos === 'left') {
    btn.classList.add('pos-left');
    const sttLeft = parseFloat(cs.getPropertyValue('--stt-left')) || 20;
    const baseLeft = sttLeft + currSettings.swipeLeftSpacing;
    btn.style.left = `calc(${baseLeft}px + var(--stt-optical-x, 0px))`;
  } else if (pos === 'center') {
    btn.classList.add('pos-center');
    // X 偏移通过 margin-left 叠加，也可以做在 transform 里。目前保留用 margin-left 加减
    btn.style.marginLeft = `var(--stt-optical-x, 0px)`;
  } else {
    btn.classList.add('pos-right');
    const sttRight = parseFloat(cs.getPropertyValue('--stt-right')) || 20;
    const baseRight = sttRight + currSettings.swipeRightSpacing;
    // 使用负号：拉杆向右拖（正数值）时向笛卡尔坐标的右移（减少 right 值）
    btn.style.right = `calc(${baseRight}px - var(--stt-optical-x, 0px))`;
  }

  // Y 偏移（所有位置通用）
  if (pos === 'center') {
    btn.style.transform = `translateX(-50%) translateY(var(--stt-optical-y, 0px))`;
  } else {
    btn.style.transform = `translateY(var(--stt-optical-y, 0px))`;
  }
}

/**
 * 根据消息高度更新按钮可见性
 */
function updateButtonVisibility($mes: JQuery<HTMLElement>): void {
  const $btn = $mes.children(`.${BTN_CLASS}`);
  if ($btn.length === 0) return;

  const mesHeight = $mes.outerHeight() || 0;
  const threshold = window.parent.innerHeight * currSettings.showThresholdRatio;
  $btn.toggle(mesHeight > threshold);
}

/**
 * 为单个 .mes 元素注入跳转按钮（如果尚未注入）
 */
function injectButton($mes: JQuery<HTMLElement>): void {
  if ($mes.children(`.${BTN_CLASS}`).length > 0) return;

  const $btn = $('<div>').addClass(`${BTN_CLASS} fa-solid fa-angles-up`).attr('title', '点击跳到顶部 | 长按打开设置');

  $mes.append($btn);
  applyPositionToButton($btn[0]);
  updateButtonVisibility($mes);
}

/**
 * 为所有已存在的 .mes 楼层注入按钮
 */
function injectAllButtons(): void {
  $('#chat > .mes').each(function () {
    injectButton($(this));
  });
}

/**
 * 移除所有注入的按钮
 */
function removeAllButtons(): void {
  $(`.${BTN_CLASS}`).remove();
}

/**
 * 重新校准：同步 CSS 变量后，移除所有按钮重新注入
 */
function recalibrateAll(): void {
  syncPositionVars();
  removeAllButtons();
  injectAllButtons();
}

/**
 * 轻量刷新：就地更新已有按钮位置和可见性，不做 DOM 增删。
 */
function refreshAllButtons(): void {
  $('#chat > .mes').each(function () {
    const $mes = $(this);
    const $btn = $mes.children(`.${BTN_CLASS}`);
    if ($btn.length > 0) {
      applyPositionToButton($btn[0]);
    }
    updateButtonVisibility($mes);
  });
}

/**
 * 弹出设置面板（共用函数，长按和脚本按钮都调用）
 */
function showSettingsPanel(): void {
  const id = 'mes-scroll-settings-container';
  if (window.parent.document.getElementById(id)) {
    return;
  }

  try {
    const $app = $('<div>').attr('id', id).appendTo(window.parent.document.body);
    const app = createApp(SettingsPanel);
    const instance = app.mount($app[0]);

    if (instance && typeof (instance as any).setApp === 'function') {
      (instance as any).setApp(() => {
        app.unmount();
        $app.remove();
      });
    }
  } catch (e) {
    console.error('[scroll-to-top] 挂载设置面板失败:', e);
  }
}

function init(): void {
  // 监听设置面板的实时保存事件，触发重绘
  let settingsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('scroll-to-top-settings-changed', () => {
    currSettings = getSettings();
    syncOpticalVars();

    if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
    settingsDebounceTimer = setTimeout(() => {
      refreshAllButtons();
    }, 100);
  });

  // 监听重新校准事件（从面板触发）
  window.addEventListener('scroll-to-top-recalibrate', () => {
    recalibrateAll();
  });

  // 监听拖拽实时预览事件，通过 CSS Variable 做到 60fps 刷新，无需重绘 DOM 属性
  window.addEventListener('scroll-to-top-settings-preview', e => {
    const customEvent = e as CustomEvent<{ x: number; y: number }>;
    syncOpticalVars(customEvent.detail.x, customEvent.detail.y);
  });

  // 注册脚本 UI 左侧面板设置按钮
  appendInexistentScriptButtons([{ name: '偏置设置', visible: false }]);

  const btnEventName = getButtonEvent('偏置设置');

  eventOn(btnEventName, () => {
    showSettingsPanel();
  });

  // 将额外样式传送到酒馆页面 head
  const { destroy: destroyStyle } = teleportStyle();

  // 初始同步 CSS 变量
  syncPositionVars();
  syncOpticalVars();

  // 为已有楼层注入按钮
  injectAllButtons();

  // 监听新消息渲染事件，为新楼层注入按钮
  const onMessageRendered = (message_id: number) => {
    const $mes = $(`#chat > .mes[mesid="${message_id}"]`);
    if ($mes.length > 0) {
      requestAnimationFrame(() => {
        injectButton($mes);
        updateButtonVisibility($mes);
      });
    }
  };

  eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
  eventOn(tavern_events.USER_MESSAGE_RENDERED, onMessageRendered);

  // swipe 后消息内容可能改变高度，重新评估按钮可见性
  eventOn(tavern_events.MESSAGE_SWIPED, (message_id: number) => {
    const $mes = $(`#chat > .mes[mesid="${message_id}"]`);
    if ($mes.length > 0) {
      requestAnimationFrame(() => {
        injectButton($mes);
        updateButtonVisibility($mes);
      });
    }
  });

  // 更多消息加载时，为新加载的消息注入按钮
  eventOn(tavern_events.MORE_MESSAGES_LOADED, () => {
    requestAnimationFrame(() => {
      injectAllButtons();
    });
  });

  // 聊天切换时，重新注入按钮
  eventOn(tavern_events.CHAT_CHANGED, () => {
    requestAnimationFrame(() => {
      injectAllButtons();
    });
  });

  // 监听主题/设置变更，自动重新同步 CSS 变量
  eventOn(tavern_events.SETTINGS_UPDATED, () => {
    requestAnimationFrame(() => {
      syncPositionVars();
      refreshAllButtons();
    });
  });

  // ── 事件委托：点击 & 长按 ──

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let isLongPress = false;

  // 长按开始 → 弹出设置面板
  $('#chat').on(`pointerdown.scrollToTop`, `.${BTN_CLASS}`, function () {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      showSettingsPanel();
    }, currSettings.longPressMs);
  });

  // 长按取消
  $('#chat').on(
    `pointerup.scrollToTop pointerleave.scrollToTop pointercancel.scrollToTop`,
    `.${BTN_CLASS}`,
    function () {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    },
  );

  // 点击：如果不是长按，则滚动到楼层顶部
  $('#chat').on(`click.scrollToTop`, `.${BTN_CLASS}`, function () {
    if (isLongPress) {
      isLongPress = false;
      return;
    }
    const $mes = $(this).closest('.mes');
    if ($mes.length > 0) {
      const $chat = $('#chat');
      const scrollTo = $chat.scrollTop()! + $mes[0].getBoundingClientRect().top - $chat[0].getBoundingClientRect().top;
      $chat.animate({ scrollTop: scrollTo }, 300);
    }
  });

  // 脚本卸载时清理
  $(window).on('pagehide', () => {
    $('#chat').off('.scrollToTop');
    removeAllButtons();
    destroyStyle();
    cleanupPositionVars();
    window.parent.document.getElementById('mes-scroll-settings-container')?.remove();
  });
}

$(() => {
  errorCatched(init)();
});
