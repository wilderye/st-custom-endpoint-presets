/**
 * mobile-keyboard-fix
 *
 * 阻止移动端虚拟键盘在阅读/流式输出期间不请自来地弹出。
 * 策略：readonly 属性屏蔽 + capture-phase focus 拦截的"双重护盾"。
 *
 * - Shield 1 (Readonly): 在 action 按钮的 pointerdown 时给 textarea 加 readonly，
 *   使后续被酒馆代码触发的 .focus() 不会唤起虚拟键盘。
 * - Shield 2 (Capture-phase focus interceptor): 兜底防线，覆盖 readonly 护盾
 *   无法触及的场景（如 loadChat、流式输出期间的幽灵焦点）。
 */

/** 需要拦截的 action 按钮选择器 */
const ACTION_BTNS = '#send_but, #option_regenerate, #option_continue, #mes_continue, #mes_impersonate';

/** 获取 send_textarea 的 DOM 元素（酒馆主页面） */
function getTextarea(): HTMLTextAreaElement | null {
  return window.parent.document.getElementById('send_textarea') as HTMLTextAreaElement | null;
}

function init(): void {
  // 非移动端直接跳过，不注册任何逻辑
  if (!SillyTavern.isMobile()) {
    console.info('[mobile-keyboard-fix] 非移动端，跳过');
    return;
  }
  console.info('[mobile-keyboard-fix] 移动端检测通过，开始注册防御逻辑');

  // ── Shield 1: Readonly 护盾 ──
  // 在 action 按钮的 pointerdown 时给 textarea 加 readonly，
  // 使后续被酒馆代码触发的 .focus() 不会唤起虚拟键盘。
  $(document).on('pointerdown.mkf touchstart.mkf', ACTION_BTNS, () => {
    const ta = getTextarea();
    if (ta) {
      ta.setAttribute('readonly', 'true');
    }
  });

  $(document).on('pointerup.mkf touchend.mkf click.mkf', ACTION_BTNS, () => {
    setTimeout(() => {
      const ta = getTextarea();
      if (ta) {
        ta.removeAttribute('readonly');
        ta.blur();
      }
    }, 50);
  });

  // ── 用户意图追踪 ──
  // 用户直接触碰 textarea 时标记为"主动想打字"
  let userIntentionallyFocused = false;

  const taEl = getTextarea();
  if (taEl) {
    taEl.addEventListener(
      'touchstart',
      () => {
        userIntentionallyFocused = true;
      },
      { passive: true },
    );

    taEl.addEventListener('blur', () => {
      userIntentionallyFocused = false;
    });
  }

  // ── Edge Case: 虚拟键盘 Enter 键发送 ──
  // 用户用虚拟键盘的 Enter/Go 键发送消息时，键盘应收起。
  // 此时 userIntentionallyFocused = true，但发送后应清除。
  if (taEl) {
    taEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // 发送后短暂延迟清除意图标记并 blur
        setTimeout(() => {
          userIntentionallyFocused = false;
          const ta = getTextarea();
          if (ta) ta.blur();
        }, 100);
      }
    });
  }

  // ── 生成状态跟踪 ──
  // 流式输出期间，所有对 textarea 的 focus 均应被阻断
  let isGenerating = false;

  eventOn(tavern_events.GENERATION_STARTED, () => {
    isGenerating = true;
    // 生成开始时立即清除幽灵焦点
    const ta = getTextarea();
    if (ta && window.parent.document.activeElement === ta) {
      ta.blur();
    }
  });

  eventOn(tavern_events.GENERATION_ENDED, () => {
    isGenerating = false;
  });

  eventOn(tavern_events.GENERATION_STOPPED, () => {
    isGenerating = false;
  });

  // ── Shield 2: Capture-phase focus 拦截器 ──
  const focusInterceptor = (e: FocusEvent) => {
    // 仅拦截 send_textarea 的 focus
    if ((e.target as HTMLElement)?.id !== 'send_textarea') return;

    // 用户主动想打字 → 放行
    if (userIntentionallyFocused) return;

    // 生成中 → 无条件阻断
    if (isGenerating) {
      (e.target as HTMLElement).blur();
      return;
    }

    // 非生成中，但非用户主动 → 也阻断（覆盖 loadChat 等场景）
    (e.target as HTMLElement).blur();
  };

  window.parent.document.addEventListener('focus', focusInterceptor, true);

  // ── 脚本卸载清理 ──
  $(window).on('pagehide', () => {
    // 移除 jQuery 委托事件
    $(document).off('.mkf');

    // 移除 capture-phase 拦截器
    window.parent.document.removeEventListener('focus', focusInterceptor, true);

    // 确保 readonly 不残留
    const ta = getTextarea();
    if (ta) {
      ta.removeAttribute('readonly');
    }

    console.info('[mobile-keyboard-fix] 已卸载');
  });
}

$(() => {
  errorCatched(init)();
});
