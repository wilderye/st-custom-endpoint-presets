import { teleportStyle } from '@util/script';

/**
 * 楼层跳转按钮脚本
 *
 * 在长消息楼层中注入跳顶/跳底按钮。
 * - 底部按钮点击后平滑滚动到该楼层顶部
 * - 顶部按钮作为酒馆原生 .mes_button 插入消息右上按钮组，点击后平滑滚动到该楼层底部
 * - 底部按钮作为 .mes 的直接子元素，使用 position: absolute 定位
 * - 三个预设位置：左（对齐 swipe_left）、中（CSS 居中）、右（对齐 swipe_right）
 * - 通过 CSS 自定义属性桥接实现响应式定位：JS 读 swipe 元素 computedStyle → 写入 CSS 变量
 * - 监听 SETTINGS_UPDATED 事件自动同步位置（切换主题后）
 * - 长按弹出设置面板
 * - 点击和长按通过事件委托挂在 #chat 上
 */

import './style.scss';

import { createApp } from 'vue';
import SettingsPanel from './SettingsPanel.vue';
import { getMessageBottomScrollTop, getMessageTopScrollTop } from './scroll-position';
import { getSettings } from './settings';

let currSettings = getSettings();

/**
 * =======================================================
 *                      内部常量与逻辑
 * =======================================================
 */

/** 底部跳顶按钮的标识 class，用于去重和清理 */
const TOP_BTN_CLASS = 'mes_scroll_to_top';
/** 顶部跳底按钮的标识 class，用于去重和清理 */
const BOTTOM_BTN_CLASS = 'mes_scroll_to_bottom';

function setPositionVar(name: string, value: string): void {
  const style = window.parent.document.documentElement.style;
  if (style.getPropertyValue(name) !== value) {
    style.setProperty(name, value);
  }
}

/**
 * 将 swipe_left / swipe_right 的位置信息写入 CSS 自定义属性。
 * CSS 规则通过 var(--stt-xxx) 引用这些值，实现响应式定位。
 */
function syncPositionVars(): void {
  const values: Record<string, string> = {};

  // 读取 swipe_left 的位置
  const swipeLeft = $('#chat .swipe_left').get(0);
  if (swipeLeft) {
    const cs = window.parent.getComputedStyle(swipeLeft);
    const left = parseFloat(cs.left);
    if (!isNaN(left)) {
      // 保留原有定位计算对零值使用 20px 的回退。
      values['--stt-left'] = `${left || 20}px`;
    }
    values['--stt-bottom'] = cs.bottom;

    // 同步排版属性（按钮需要与 swipe 视觉一致）
    values['--stt-width'] = cs.width;
    values['--stt-height'] = cs.height;
    values['--stt-font-size'] = cs.fontSize;
    values['--stt-line-height'] = cs.lineHeight;
  }

  // 读取 swipe_right 的距右距离
  const swipeRight = $('#chat .swipe_right').get(0);
  if (swipeRight) {
    const mesEl = $(swipeRight).closest('.mes').get(0);
    if (mesEl) {
      const mesRect = mesEl.getBoundingClientRect();
      const srRect = swipeRight.getBoundingClientRect();
      const rightOffset = mesRect.right - srRect.right;
      values['--stt-right'] = `${rightOffset || 20}px`;
    }
  }

  // 先收集原生按钮的排版结果，再统一写入；相同值无需重复写入。
  Object.entries(values).forEach(([name, value]) => setPositionVar(name, value));
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
    '--stt-left-spacing',
    '--stt-right-spacing',
  ];
  vars.forEach(v => root.style.removeProperty(v));
}

/**
 * 同步手动微调和按钮间距；预览时只更新发生变化的变量。
 */
function syncButtonStyleVars(x = currSettings.opticalXOffset, y = currSettings.opticalYOffset): void {
  setPositionVar('--stt-optical-x', `${x}px`);
  setPositionVar('--stt-optical-y', `${y}px`);
  setPositionVar('--stt-left-spacing', `${currSettings.swipeLeftSpacing}px`);
  setPositionVar('--stt-right-spacing', `${currSettings.swipeRightSpacing}px`);
}

/**
 * 仅在位置发生变化时更新 class，尺寸和间距由共用 CSS 变量控制。
 */
function applyPositionToButton(btn: HTMLElement): void {
  const pos = currSettings.position;
  btn.classList.toggle('pos-left', pos === 'left');
  btn.classList.toggle('pos-center', pos === 'center');
  btn.classList.toggle('pos-right', pos === 'right');
}

/**
 * 读取消息高度并判断是否显示按钮，不修改页面。
 */
function getButtonVisibility($mes: JQuery<HTMLElement>): boolean {
  const mesHeight = $mes.outerHeight() || 0;
  const threshold = window.parent.innerHeight * currSettings.showThresholdRatio;
  return mesHeight > threshold;
}

function updateButtonVisibility($mes: JQuery<HTMLElement>, shouldShow: boolean): void {
  $mes.children(`.${TOP_BTN_CLASS}`).toggle(shouldShow);
  $mes.find(`.mes_buttons > .${BOTTOM_BTN_CLASS}`).toggle(shouldShow && currSettings.showBottomButton);
}

/**
 * 为单个 .mes 元素注入跳转按钮（如果尚未注入）
 */
function injectButton($mes: JQuery<HTMLElement>): void {
  if ($mes.children(`.${TOP_BTN_CLASS}`).length === 0) {
    const $btn = $('<div>')
      .addClass(`${TOP_BTN_CLASS} fa-solid fa-angles-up`)
      .attr('title', '点击跳到顶部 | 长按打开设置');

    $mes.append($btn);
    applyPositionToButton($btn[0]);
  }

  const $mesButtons = $mes.find('.mes_block .mes_buttons').first();
  if ($mesButtons.length > 0 && $mesButtons.children(`.${BOTTOM_BTN_CLASS}`).length === 0) {
    const $btn = $('<div>')
      .addClass(`${BOTTOM_BTN_CLASS} mes_button fa-solid fa-angles-down`)
      .attr('title', '点击跳到底部');

    const $nativeAnchor = $mesButtons.children('.extraMesButtonsHint').first();
    if ($nativeAnchor.length > 0) {
      $btn.insertBefore($nativeAnchor);
    } else {
      $mesButtons.prepend($btn);
    }
  }
}

/**
 * 为所有已存在的 .mes 楼层注入按钮
 */
function injectAllButtons(): void {
  $('#chat > .mes').each(function () {
    injectButton($(this));
  });
  refreshAllButtons();
}

/**
 * 移除所有注入的按钮
 */
function removeAllButtons(): void {
  $(`.${TOP_BTN_CLASS}, .${BOTTOM_BTN_CLASS}`).remove();
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
 * 先集中读取消息高度，再更新位置和可见性，避免读写交替触发逐条排版。
 */
function refreshAllButtons(): void {
  const messages = $('#chat > .mes')
    .toArray()
    .map(mes => {
      const $mes = $(mes);
      return { $mes, shouldShow: getButtonVisibility($mes) };
    });

  messages.forEach(({ $mes, shouldShow }) => {
    const $btn = $mes.children(`.${TOP_BTN_CLASS}`);
    if ($btn.length > 0) {
      applyPositionToButton($btn[0]);
    }
    updateButtonVisibility($mes, shouldShow);
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
    syncButtonStyleVars();

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
    syncButtonStyleVars(customEvent.detail.x, customEvent.detail.y);
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
  syncButtonStyleVars();

  // 为已有楼层注入按钮
  injectAllButtons();

  // 监听新消息渲染事件，为新楼层注入按钮
  const onMessageRendered = (message_id: number) => {
    const $mes = $(`#chat > .mes[mesid="${message_id}"]`);
    if ($mes.length > 0) {
      requestAnimationFrame(() => {
        injectButton($mes);
        updateButtonVisibility($mes, getButtonVisibility($mes));
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
        updateButtonVisibility($mes, getButtonVisibility($mes));
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
  $('#chat').on(`pointerdown.scrollToTop`, `.${TOP_BTN_CLASS}`, function () {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      showSettingsPanel();
    }, currSettings.longPressMs);
  });

  // 长按取消
  $('#chat').on(
    `pointerup.scrollToTop pointerleave.scrollToTop pointercancel.scrollToTop`,
    `.${TOP_BTN_CLASS}`,
    function () {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    },
  );

  // 点击：如果不是长按，则滚动到楼层顶部
  $('#chat').on(`click.scrollToTop`, `.${TOP_BTN_CLASS}`, function () {
    if (isLongPress) {
      isLongPress = false;
      return;
    }
    const $mes = $(this).closest('.mes');
    if ($mes.length > 0) {
      const $chat = $('#chat');
      const scrollTo = getMessageTopScrollTop({
        currentScrollTop: $chat.scrollTop() ?? 0,
        chatRect: $chat[0].getBoundingClientRect(),
        messageRect: $mes[0].getBoundingClientRect(),
      });
      $chat.animate({ scrollTop: scrollTo }, 300);
    }
  });

  // 点击顶部原生按钮：滚动到楼层底部
  $('#chat').on(`click.scrollToTop`, `.${BOTTOM_BTN_CLASS}`, function () {
    const $mes = $(this).closest('.mes');
    if ($mes.length > 0) {
      const $chat = $('#chat');
      const scrollTo = getMessageBottomScrollTop({
        currentScrollTop: $chat.scrollTop() ?? 0,
        chatRect: $chat[0].getBoundingClientRect(),
        messageRect: $mes[0].getBoundingClientRect(),
      });
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
