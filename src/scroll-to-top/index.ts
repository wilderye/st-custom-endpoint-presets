import { teleportStyle } from '@util/script';

/**
 * 楼层顶部跳转按钮脚本
 *
 * 在长消息楼层底部左侧注入一个 ⏫ 按钮，点击后平滑滚动到该楼层顶部。
 * - 按钮作为 .mes 的直接子元素，使用 position: absolute 定位
 * - 注入时读取 swipe_left 的 computedStyle，动态对齐
 * - 仅在消息高度超过屏幕 2/3 时显示
 * - 长按（500ms）任意按钮可重新校准所有按钮位置（适配切换美化后的布局变化）
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

interface SwipeStyles {
  bottom: string;
  left: number;
  width: string;
  height: string;
  fontSize: string;
  lineHeight: string;
  display: string;
  alignItems: string;
  justifyContent: string;
}

/**
 * 读取页面中任意一个 .swipe_left 的 computedStyle，返回所有排版与定位信息
 * 如果找不到则返回 null（使用 CSS 中的默认值）
 */
function readSwipeLeftPosition(): SwipeStyles | null {
  // 注意：脚本运行在 iframe 中，document 是 iframe 的文档
  // 需要用 parent.document 或 jQuery（已绑定到父页面）来查找酒馆页面元素
  const swipeLeft = $('#chat .swipe_left').get(0);
  if (!swipeLeft) {
    console.warn('[scroll-to-top] 未找到 .swipe_left 元素，使用 CSS 默认位置');
    return null;
  }

  const computed = window.parent.getComputedStyle(swipeLeft);
  const left = parseFloat(computed.left);
  if (isNaN(left)) return null;

  return {
    bottom: computed.bottom,
    left,
    width: computed.width,
    height: computed.height,
    fontSize: computed.fontSize,
    lineHeight: computed.lineHeight,
    display: computed.display,
    alignItems: computed.alignItems,
    justifyContent: computed.justifyContent,
  };
}

/**
 * 将按钮排版与位置完全同步到 swipe_left
 */
function applyPositionToButton(btn: HTMLElement, styles: SwipeStyles): void {
  // 最终的 left = 箭头原生left + 我们设定的基础间距 + 用户的 X轴 微调
  const finalLeft = `${styles.left + currSettings.swipeLeftSpacing + currSettings.opticalXOffset}px`;

  // 定位同步
  btn.style.bottom = styles.bottom;
  btn.style.left = finalLeft;

  // 排版属性同步
  btn.style.width = styles.width;
  btn.style.height = styles.height;
  btn.style.fontSize = styles.fontSize;
  btn.style.lineHeight = styles.lineHeight;
  btn.style.display = styles.display;
  btn.style.alignItems = styles.alignItems;
  btn.style.justifyContent = styles.justifyContent;

  // 光学微调补偿
  if (currSettings.opticalYOffset !== 0) {
    btn.style.transform = `translateY(${currSettings.opticalYOffset}px)`;
  }

  console.info('[scroll-to-top] 按钮排版同步完毕:', { bottom: styles.bottom, left: finalLeft, fontSize: styles.fontSize });
}

/**
 * 为单个 .mes 元素注入跳转按钮（如果尚未注入）
 */
function injectButton($mes: JQuery<HTMLElement>, swipePos: SwipeStyles | null): void {
  // 已有按钮则跳过
  if ($mes.children(`.${BTN_CLASS}`).length > 0) return;

  // 1:1 复刻原生 DOM 结构：单层节点即是容器也是图标
  const $btn = $('<div>')
    .addClass(`${BTN_CLASS} fa-solid fa-angles-up`)
    .attr('title', '点击跳到顶部 | 长按重新校准位置');

  $mes.append($btn);

  // 如果读取到了 swipe_left 的位置，用 inline style 覆盖 CSS 默认值
  if (swipePos) {
    applyPositionToButton($btn[0], swipePos);
  }

  // 根据高度决定是否显示
  updateButtonVisibility($mes);
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
 * 为所有已存在的 .mes 楼层注入按钮
 */
function injectAllButtons(): void {
  const swipePos = readSwipeLeftPosition();
  $('#chat > .mes').each(function () {
    injectButton($(this), swipePos);
  });
}

/**
 * 移除所有注入的按钮
 */
function removeAllButtons(): void {
  $(`.${BTN_CLASS}`).remove();
}

/**
 * 重新校准：移除所有按钮后重新注入（读取最新的 swipe_left 位置）
 */
function recalibrateAll(): void {
  console.info('[scroll-to-top] 重新校准按钮位置');
  removeAllButtons();
  injectAllButtons();
}

/**
 * 轻量刷新：就地更新已有按钮位置和可见性，不做 DOM 增删。
 * 用于设置变更时的实时预览。
 */
function refreshAllButtons(): void {
  const swipePos = readSwipeLeftPosition();
  $('#chat > .mes').each(function () {
    const $mes = $(this);
    const $btn = $mes.children(`.${BTN_CLASS}`);
    if ($btn.length > 0 && swipePos) {
      // 这里的 applyPositionToButton 是之前注入时用的同一个函数，
      // 它会严格读取 swipe_left 的各种排版参数来保证对齐。
      applyPositionToButton($btn[0], swipePos);
    }
    updateButtonVisibility($mes);
  });
}

function init(): void {
  console.info('[scroll-to-top] 脚本加载');

  // 监听设置悬浮窗内的实时保存事件，触发重绘
  let settingsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('scroll-to-top-settings-changed', () => {
    currSettings = getSettings();
    
    if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
    settingsDebounceTimer = setTimeout(() => {
      refreshAllButtons();
    }, 100);
  });

  // 注册并监听脚本 UI 左侧面板设置按钮 (默认关闭不勾选)
  appendInexistentScriptButtons([{ name: '偏置设置', visible: false }]);

  const btnEventName = getButtonEvent('偏置设置');
  console.info(`[scroll-to-top] 注册偏置设置按钮事件: ${btnEventName}`);

  eventOn(btnEventName, () => {
    console.info('[scroll-to-top] 偏置设置按钮被点击了！准备弹出面板...');
    const id = 'mes-scroll-settings-container';
    if (window.parent.document.getElementById(id)) {
      console.warn('[scroll-to-top] 面板 DOM 已经存在，跳过渲染');
      return;
    }

    try {
      const $app = $('<div>').attr('id', id).appendTo(window.parent.document.body);
      const app = createApp(SettingsPanel);
      const instance = app.mount($app[0]);
      
      // 如果想要提供自动卸载的接口
      if (instance && typeof (instance as any).setApp === 'function') {
        (instance as any).setApp(() => {
          app.unmount();
          $app.remove();
        });
      }
      console.info('[scroll-to-top] 面板已成功挂载');
    } catch (e) {
      console.error('[scroll-to-top] 挂载设置面板失败:', e);
    }
  });

  // 将额外样式传送到酒馆页面 head
  const { destroy: destroyStyle } = teleportStyle();

  // 为已有楼层注入按钮
  injectAllButtons();

  // 监听新消息渲染事件，为新楼层注入按钮
  const onMessageRendered = (message_id: number) => {
    const $mes = $(`#chat > .mes[mesid="${message_id}"]`);
    if ($mes.length > 0) {
      requestAnimationFrame(() => {
        const swipePos = readSwipeLeftPosition();
        injectButton($mes, swipePos);
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
        const swipePos = readSwipeLeftPosition();
        injectButton($mes, swipePos);
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

  // ── 事件委托：点击 & 长按 ──

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let isLongPress = false;

  // 长按开始
  $('#chat').on(`pointerdown.scrollToTop`, `.${BTN_CLASS}`, function () {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      recalibrateAll();
    }, currSettings.longPressMs);
  });

  // 长按取消
  $('#chat').on(`pointerup.scrollToTop pointerleave.scrollToTop pointercancel.scrollToTop`, `.${BTN_CLASS}`, function () {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  // 点击：如果不是长按，则滚动到楼层顶部
  $('#chat').on(`click.scrollToTop`, `.${BTN_CLASS}`, function () {
    if (isLongPress) {
      // 长按已经触发了重新校准，不执行滚动
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
    console.info('[scroll-to-top] 脚本卸载');
    $('#chat').off('.scrollToTop');
    removeAllButtons();
    destroyStyle();
    // 清除挂载在父文档上的设置面板，防止热重载后产生孤儿 DOM
    window.parent.document.getElementById('mes-scroll-settings-container')?.remove();
  });
}

$(() => {
  errorCatched(init)();
});
