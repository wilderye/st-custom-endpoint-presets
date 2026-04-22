/**
 * mobile-keyboard-fix-v2
 *
 * 阻止移动端虚拟键盘在阅读/流式输出期间不请自来地弹出。
 *
 * 策略：上游拦截 —— 覆盖 textarea 的 .focus() 方法，
 * 仅在用户刚触碰过 textarea 时放行，其余酒馆代码的程序化调用一律吞掉。
 * 生成期间额外加 readonly 属性防止浏览器因布局抖动自动弹出键盘。
 * 生成期间若用户误触 textarea 后点别处，主动 blur 以消除幽灵焦点。
 */

/** 用于标记 .focus() 已被覆盖，防止热重载时叠加覆盖 */
const MKF_OVERRIDE_KEY = '__mkf_v2_override';

/** 用户触碰 textarea 后允许 .focus() 放行的时间窗口（毫秒） */
const TOUCH_WINDOW_MS = 300;

/** 获取 send_textarea 的 DOM 元素（酒馆主页面） */
function getTextarea(): HTMLTextAreaElement | null {
  return window.parent.document.getElementById('send_textarea') as HTMLTextAreaElement | null;
}

function init(): void {
  // 非移动端直接跳过
  if (!SillyTavern.isMobile()) {
    console.info('[mobile-keyboard-fix-v2] 非移动端，跳过');
    return;
  }

  const taEl = getTextarea();
  if (!taEl) {
    console.warn('[mobile-keyboard-fix-v2] 未找到 #send_textarea');
    return;
  }

  // 防止热重载时叠加覆盖
  if ((taEl.focus as any)[MKF_OVERRIDE_KEY]) {
    console.info('[mobile-keyboard-fix-v2] 已覆盖过 .focus()，跳过');
    return;
  }

  console.info('[mobile-keyboard-fix-v2] 移动端检测通过，开始注册防御逻辑');

  // ── 覆盖 .focus() ──
  const originalFocus = taEl.focus.bind(taEl);
  let lastTouchTime = 0;

  taEl.addEventListener(
    'touchstart',
    () => {
      lastTouchTime = Date.now();
      taEl.removeAttribute('readonly');
    },
    { passive: true },
  );

  const overriddenFocus = function (this: HTMLTextAreaElement) {
    if (Date.now() - lastTouchTime < TOUCH_WINDOW_MS) {
      originalFocus();
    }
    // 超过时间窗口：非用户触发的程序化调用，吞掉
  };
  (overriddenFocus as any)[MKF_OVERRIDE_KEY] = true;
  taEl.focus = overriddenFocus;

  // ── 生成期间加 readonly（防幽灵键盘）──
  // readonly 由 touchstart 移除，而非生成结束事件，避免使用 blur()
  let isGenerating = false;

  eventOn(tavern_events.GENERATION_STARTED, (_type: string, _params: unknown, isDryRun: boolean) => {
    if (isDryRun) return;
    isGenerating = true;
    taEl.setAttribute('readonly', 'true');
  });

  eventOn(tavern_events.GENERATION_ENDED, () => {
    isGenerating = false;
  });

  eventOn(tavern_events.GENERATION_STOPPED, () => {
    isGenerating = false;
  });

  // ── 生成期间幽灵焦点防护 ──
  // 生成期间用户误触 textarea 后点别处，浏览器不会自动 blur，
  // 此时 activeElement 仍是 textarea，DOM 布局变化会重新弹出键盘。
  // 在 touchstart 捕获阶段检测：若正在生成 + 焦点在 textarea + 触碰点不在 textarea → 主动 blur
  const parentDoc = window.parent.document;
  const ghostFocusGuard = (e: Event) => {
    if (!isGenerating) return;
    if (parentDoc.activeElement !== taEl) return;
    if (e.target === taEl || taEl.contains(e.target as Node)) return;
    taEl.blur();
  };
  parentDoc.addEventListener('touchstart', ghostFocusGuard, { passive: true });

  // ── 脚本卸载清理 ──
  $(window).on('pagehide', () => {
    taEl.focus = originalFocus;
    taEl.removeAttribute('readonly');
    parentDoc.removeEventListener('touchstart', ghostFocusGuard);
    console.info('[mobile-keyboard-fix-v2] 已卸载');
  });
}

$(() => {
  errorCatched(init)();
});

export {};
