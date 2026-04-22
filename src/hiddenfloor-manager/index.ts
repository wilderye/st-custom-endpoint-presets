/**
 * 隐藏楼层管理器
 *
 * 在酒馆扩展菜单（魔棒）中添加入口，打开原生 Popup 面板，
 * 展示已隐藏楼层的合并范围，并支持按范围批量隐藏/显示。
 * 新增楼层跳转功能：预览跳转（弹窗预览目标 ±10 条）和直接跳转。
 */

// ─── 常量 ───

const MENU_ITEM_ID = 'hidden_floor_manager_btn';
const PREVIEW_COLLAPSE_HEIGHT = '4.5em';
const FOCUS_BAIT_HTML =
  '<button autofocus tabindex="0" style="position:absolute; width:0; height:0; padding:0; margin:0; border:none; opacity:0; pointer-events:none;"></button>';

// ─── 工具函数 ───

/** 获取最新楼层号 */
function getLastId(): number {
  return SillyTavern.chat.length - 1;
}

/** 解析并校验楼层输入值，返回取整后的数字或 null（校验失败时自动 toast） */
function parseFloorInput(value: unknown): number | null {
  const num = Number(value);
  if (value === '' || value === null || value === undefined || isNaN(num)) {
    toastr.warning('请输入有效的楼层号');
    return null;
  }
  const floored = Math.floor(num);
  const lastId = getLastId();
  if (floored < 0 || lastId < 0) {
    toastr.warning('请输入有效的楼层号');
    return null;
  }
  if (floored > lastId) {
    toastr.warning(`楼层号不能超过最新楼层 ${lastId}`);
    return null;
  }
  return floored;
}

// ─── 范围合并 ───

/** 将一组楼层号合并为连续范围，如 [0,1,2,5,7,8] → [{start:0,end:2},{start:5,end:5},{start:7,end:8}] */
function mergeRanges(ids: number[]): { start: number; end: number }[] {
  if (ids.length === 0) return [];
  const sorted = [...ids].sort((a, b) => a - b);
  const ranges: { start: number; end: number }[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push({ start, end });
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push({ start, end });
  return ranges;
}

/** 将范围数组格式化为显示文本，如 "0-2, 5, 7-8" */
function formatRanges(ranges: { start: number; end: number }[]): string {
  return ranges.map(r => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`)).join(', ');
}

// ─── 隐藏楼层查询（原生 API） ───

/** 遍历 SillyTavern.chat 收集隐藏楼层 ID */
function getHiddenFloorIds(): number[] {
  const ids: number[] = [];
  for (let i = 0; i < SillyTavern.chat.length; i++) {
    if (SillyTavern.chat[i].is_system) {
      ids.push(i);
    }
  }
  return ids;
}

/** 查询隐藏楼层并更新面板内 DOM */
function refreshHiddenDisplay($container: JQuery): void {
  try {
    const ids = getHiddenFloorIds();
    if (ids.length === 0) {
      $container.text('无');
    } else {
      const ranges = mergeRanges(ids);
      $container.text(formatRanges(ranges));
    }
  } catch (e) {
    console.error('[hidden-floor-manager] 查询隐藏楼层失败', e);
    $container.text('查询失败');
  }
}

// ─── 跳转逻辑 ───

/** 执行跳转（含 gap > 100 确认），返回是否真正执行了跳转 */
async function doJump(targetIndex: number): Promise<boolean> {
  const lastId = getLastId();
  const gap = Math.abs(lastId - targetIndex);

  if (gap > 100) {
    const result = await SillyTavern.callGenericPopup(
      `需渲染 ${gap} 个楼层，可能造成卡顿一段时间后跳转，是否跳转？`,
      SillyTavern.POPUP_TYPE.CONFIRM,
    );
    if (result !== SillyTavern.POPUP_RESULT.AFFIRMATIVE) {
      return false;
    }
  }

  const res = await SillyTavern.executeSlashCommandsWithOptions(`/chat-jump ${targetIndex}`);

  if (res.isError) {
    toastr.error(`跳转失败: ${res.errorMessage}`);
    return false;
  }
  return true;
}

// ─── 预览弹窗 ───

/** 渲染单条消息的预览 DOM */
function renderMessageItem(
  mesid: number,
  isCenter: boolean,
  closePopup: () => void,
  formatCache: Map<number, string>,
): JQuery {
  const msg = SillyTavern.chat[mesid];
  const senderName = msg.is_user ? SillyTavern.name1 : msg.name || SillyTavern.name2;

  // 使用酒馆助手高层接口格式化消息内容（宏替换 → 酒馆正则 → HTML），并通过缓存提速
  let formattedHtml = formatCache.get(mesid);
  if (!formattedHtml) {
    formattedHtml = formatAsDisplayedMessage(msg.mes, { message_id: mesid });
    formatCache.set(mesid, formattedHtml);
  }

  // 消息条目容器
  const $item = $('<div class="hfm-preview-item"></div>');
  if (isCenter) $item.addClass('hfm-preview-center');

  // 头部行：楼层号 + 幽灵图标(隐藏楼层) + 发送者 + 折叠三角 + 跳转按钮
  const $header = $('<div class="flex-container alignitemscenter flexGap5 wide100p"></div>');
  const $floorTag = $(`<span class="opacity50" style="font-size:0.85em;">#${mesid}</span>`);
  const $sender = $('<span class="opacity75 flex1" style="font-size:0.9em;"></span>').text(senderName);

  // 头部折叠按钮（默认隐藏，由溢出检测决定是否显示）
  // fa-fw 保证 chevron-right ↔ chevron-down 切换时图标宽度不变
  const $headerToggle = $(
    '<div class="hfm-header-toggle menu_button" style="padding:2px 8px;font-size:0.85em;line-height:1;display:none;" title="展开/折叠"><i class="fa-solid fa-chevron-right fa-fw"></i></div>',
  );

  const $jumpBtn = $(
    '<div class="menu_button" style="padding:2px 8px;font-size:0.85em;" title="跳转到此楼层"><i class="fa-solid fa-share"></i></div>',
  );

  $jumpBtn.on('click', async () => {
    const jumped = await doJump(mesid);
    if (jumped) {
      closePopup();
    }
  });

  $header.append($floorTag);
  if (msg.is_system) {
    $header.append('<i class="fa-solid fa-ghost opacity50" style="font-size:0.8em;"></i>');
  }
  $header.append($sender, $headerToggle, $jumpBtn);
  $item.append($header);

  // 消息内容区（折叠/展开）
  const $contentWrap = $('<div class="hfm-content-wrap"></div>');
  const $content = $(`<div class="hfm-content">${formattedHtml}</div>`);

  // 代码块默认折叠
  $content.find('pre:has(code)').each(function (index) {
    const $pre = $(this);
    // 使用 max-content 和 nowrap 保证文字无论如何不会竖向折行，margin: 0 auto 保证只在中间居中。
    const $btn = $(
      '<div class="menu_button" style="white-space:nowrap; width:max-content; margin:4px auto; padding:2px 10px; font-size:0.8em; line-height:1.2;">📦 代码块 ▸</div>',
    );
    $btn.attr('data-hfm-code-toggle', `${mesid}-${index}`);
    $btn.on('click', () => {
      $pre.toggle();
      $btn.text($pre.is(':visible') ? '📦 代码块 ▾' : '📦 代码块 ▸');
    });
    $pre.before($btn).hide();
  });

  // 所有楼层默认折叠
  $content.addClass('hfm-collapsed');

  $contentWrap.append($content);
  $item.append($contentWrap);

  // 底部展开/折叠按钮（默认隐藏，由溢出检测决定是否显示）
  const $toggleBtn = $(
    '<div class="hfm-toggle opacity50" style="cursor:pointer;font-size:0.8em;text-align:center;padding:2px 0;display:none;">展开 ▾</div>',
  );

  // 同步折叠状态的工具函数
  const syncCollapseUI = (collapsed: boolean) => {
    if (collapsed) {
      $content.addClass('hfm-collapsed');
      $toggleBtn.text('展开 ▾');
      $headerToggle.find('i').removeClass('fa-chevron-down').addClass('fa-chevron-right');
    } else {
      $content.removeClass('hfm-collapsed');
      $toggleBtn.text('折叠 ▴');
      $headerToggle.find('i').removeClass('fa-chevron-right').addClass('fa-chevron-down');
    }
  };

  $toggleBtn.on('click', () => syncCollapseUI(!$content.hasClass('hfm-collapsed')));
  $headerToggle.on('click', () => syncCollapseUI(!$content.hasClass('hfm-collapsed')));
  $item.append($toggleBtn);

  return $item;
}

/** 生成一组消息的 DOM 片段，以增量方式插入避免破坏现有状态 */
function createMessageElements(
  start: number,
  end: number,
  centerTarget: number,
  closePopup: () => void,
  formatCache: Map<number, string>,
): JQuery<DocumentFragment> {
  const $frag = $(document.createDocumentFragment());
  const lastId = getLastId();
  const clampedStart = Math.max(0, start);
  const clampedEnd = Math.min(lastId, end);

  for (let i = clampedStart; i <= clampedEnd; i++) {
    const isCenter = i === centerTarget;
    $frag.append(renderMessageItem(i, isCenter, closePopup, formatCache));
  }
  return $frag;
}

/** 打开预览跳转弹窗 */
async function openPreviewPopup(targetIndex: number): Promise<void> {
  const lastId = getLastId();
  let rangeStart = Math.max(0, targetIndex - 10);
  let rangeEnd = Math.min(lastId, targetIndex + 10);

  // ─── 构建弹窗 DOM ───
  const $popup = $('<div class="wide100p flex-container flex-column flexGap5"></div>');
  $popup.append(FOCUS_BAIT_HTML);

  // 顶部吸顶容器
  const $stickyTop = $('<div class="hfm-sticky-top wide100p"></div>');

  // 目标楼层标签 + 输入框 + 预览按钮
  const $topRow = $('<div class="flex-container alignitemscenter flexGap5 wide100p"></div>');
  $topRow.append('<span class="opacity75" style="white-space:nowrap;">目标楼层</span>');
  const $targetInput = $('<input type="number" class="text_pole" style="max-width:10em;text-align:center;" />').val(
    targetIndex,
  );
  const $previewBtn = $(
    '<div class="menu_button flex-container justifyContentCenter alignitemscenter" title="预览"><i class="fa-solid fa-magnifying-glass"></i></div>',
  );
  $topRow.append($targetInput, $previewBtn);
  $stickyTop.append($topRow);
  $stickyTop.append('<hr class="wide100p" style="margin:4px 0;">');
  $popup.append($stickyTop);

  // 显示更多（顶部）
  const $loadMoreUp = $(
    '<div class="menu_button wide100p flex-container justifyContentCenter alignitemscenter"><i class="fa-solid fa-arrow-up" style="margin-right:0.5em;"></i>显示更多楼层</div>',
  );
  $popup.append($loadMoreUp);

  // 消息列表容器
  const $listContainer = $('<div class="hfm-preview-list"></div>');
  $popup.append($listContainer);

  // 显示更多（底部）
  const $loadMoreDown = $(
    '<div class="menu_button wide100p flex-container justifyContentCenter alignitemscenter"><i class="fa-solid fa-arrow-down" style="margin-right:0.5em;"></i>显示更多楼层</div>',
  );
  $popup.append($loadMoreDown);

  // ─── 创建弹窗实例与独立缓存 ───
  const formatCache = new Map<number, string>();
  const previewPopup = new SillyTavern.Popup($popup, SillyTavern.POPUP_TYPE.DISPLAY, '', {
    allowVerticalScrolling: true,
    wide: true,
  });
  const closePopup = () => previewPopup.completeCancelled();

  // 为弹窗 dialog 添加自定义类，用于作用域 CSS（滚动条、关闭按钮偏移）
  $(previewPopup.dlg).addClass('hfm-popup-dialog');

  // ─── 渲染与视图状态更新 ───
  const updateVisibility = () => {
    $loadMoreUp.css('display', rangeStart > 0 ? '' : 'none');
    $loadMoreDown.css('display', rangeEnd < lastId ? '' : 'none');
    requestAnimationFrame(() => {
      $listContainer.find('.hfm-collapsed').each(function () {
        const el = this as HTMLElement;
        if (el.scrollHeight > el.clientHeight) {
          const $item = $(el).closest('.hfm-preview-item');
          $item.find('.hfm-toggle').show();
          $item.find('.hfm-header-toggle').show();
        }
      });
    });
  };

  const performFullRenderAndScroll = () => {
    $listContainer.empty().append(createMessageElements(rangeStart, rangeEnd, targetIndex, closePopup, formatCache));
    requestAnimationFrame(() => {
      const centerEl = $listContainer.find('.hfm-preview-center').get(0);
      if (centerEl) centerEl.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    updateVisibility();
  };

  performFullRenderAndScroll();

  // ─── 事件绑定（全增量渲染） ───
  $loadMoreUp.on('click', () => {
    const newStart = Math.max(0, rangeStart - 10);
    if (newStart < rangeStart) {
      $listContainer.prepend(createMessageElements(newStart, rangeStart - 1, targetIndex, closePopup, formatCache));
      rangeStart = newStart;
      updateVisibility();
    }
  });

  $loadMoreDown.on('click', () => {
    const newEnd = Math.min(lastId, rangeEnd + 10);
    if (newEnd > rangeEnd) {
      $listContainer.append(createMessageElements(rangeEnd + 1, newEnd, targetIndex, closePopup, formatCache));
      rangeEnd = newEnd;
      updateVisibility();
    }
  });

  $previewBtn.on('click', () => {
    const newTarget = parseFloorInput($targetInput.val());
    if (newTarget === null) return;
    targetIndex = newTarget;
    rangeStart = Math.max(0, targetIndex - 10);
    rangeEnd = Math.min(lastId, targetIndex + 10);
    performFullRenderAndScroll();
  });

  // ─── 弹出 ───
  previewPopup.show();
}

// ─── 面板 ───

/** 构建面板 HTML 并弹出 */
async function openPanel(): Promise<void> {
  // 前置检查
  if (SillyTavern.chat.length === 0) {
    toastr.warning('需要先打开一个聊天');
    return;
  }

  const lastId = getLastId();

  // ─── 构建面板 DOM ───
  const $panel = $('<div class="wide100p flex-container flex-column flexGap10"></div>');
  $panel.append(FOCUS_BAIT_HTML);

  // 1. 顶部信息区
  const $infoRow = $('<div class="flex-container alignitemscenter flexGap5 wide100p"></div>');
  $infoRow.append('<span class="opacity75">最新消息层数</span>');
  $infoRow.append(`<span class="opacity50">${lastId}</span>`);
  $panel.append($infoRow);

  const $hiddenSection = $('<div class="flex-container flex-column flexGap5 wide100p"></div>');
  $hiddenSection.append('<span class="opacity75">已隐藏楼层</span>');
  const $hiddenDisplay = $('<div style="word-break:break-all;min-height:1.2em;"></div>');
  $hiddenSection.append($hiddenDisplay);
  $panel.append($hiddenSection);

  $panel.append('<hr class="wide100p">');

  // 2. 范围管理区
  const $rangeSection = $('<div class="flex-container flex-column flexGap5 wide100p"></div>');
  $rangeSection.append('<span class="opacity75">范围管理</span>');

  const $rangeInputRow = $('<div class="flex-container alignitemscenter flexGap5 wide100p"></div>');
  const $startInput = $(
    '<input type="number" class="text_pole flex1" min="0" placeholder="起始" style="text-align:center;" />',
  ).val(0);
  const $endInput = $(
    '<input type="number" class="text_pole flex1" min="0" placeholder="结束" style="text-align:center;" />',
  ).val('');
  $rangeInputRow.append($startInput, '<span class="opacity50">-</span>', $endInput);
  $rangeSection.append($rangeInputRow);

  const $rangeBtnRow = $('<div class="flex-container flexGap5 wide100p"></div>');
  const $hideBtn = $(
    '<div class="menu_button flex1 flex-container justifyContentCenter alignitemscenter"><i class="fa-solid fa-eye-slash" style="margin-right:0.5em;"></i>隐藏</div>',
  );
  const $showBtn = $(
    '<div class="menu_button flex1 flex-container justifyContentCenter alignitemscenter"><i class="fa-solid fa-eye" style="margin-right:0.5em;"></i>显示</div>',
  );

  $hideBtn.on('click', async () => {
    const start = Math.floor(Number($startInput.val()));
    const end = Math.floor(Number($endInput.val()));
    if (isNaN(start) || isNaN(end) || start > end || start < 0) {
      toastr.warning('请输入有效的楼层范围');
      return;
    }
    if (end > lastId) {
      toastr.warning(`楼层号不能超过最新楼层 ${lastId}`);
      return;
    }
    await SillyTavern.executeSlashCommandsWithOptions(`/hide ${start}-${end}`);
    refreshHiddenDisplay($hiddenDisplay);
  });

  $showBtn.on('click', async () => {
    const start = Math.floor(Number($startInput.val()));
    const end = Math.floor(Number($endInput.val()));
    if (isNaN(start) || isNaN(end) || start > end || start < 0) {
      toastr.warning('请输入有效的楼层范围');
      return;
    }
    if (end > lastId) {
      toastr.warning(`楼层号不能超过最新楼层 ${lastId}`);
      return;
    }
    await SillyTavern.executeSlashCommandsWithOptions(`/unhide ${start}-${end}`);
    refreshHiddenDisplay($hiddenDisplay);
  });

  $rangeBtnRow.append($hideBtn, $showBtn);
  $rangeSection.append($rangeBtnRow);
  $panel.append($rangeSection);

  $panel.append('<hr class="wide100p">');

  // 3. 楼层跳转区
  const $jumpSection = $('<div class="flex-container flex-column flexGap5 wide100p"></div>');
  $jumpSection.append('<span class="opacity75">楼层跳转</span>');

  const $jumpInputRow = $('<div class="flex-container alignitemscenter flexGap5 wide100p"></div>');
  const $jumpInput = $(
    '<input type="number" class="text_pole flex1" placeholder="在此输入目标楼层" style="text-align:center;" />',
  );
  $jumpInputRow.append($jumpInput);
  $jumpSection.append($jumpInputRow);

  const $jumpBtnRow = $('<div class="flex-container flexGap5 wide100p"></div>');
  const $previewJumpBtn = $(
    '<div class="menu_button flex1 flex-container justifyContentCenter alignitemscenter"><i class="fa-solid fa-magnifying-glass" style="margin-right:0.5em;"></i>预览跳转</div>',
  );
  const $directJumpBtn = $(
    '<div class="menu_button flex1 flex-container justifyContentCenter alignitemscenter"><i class="fa-solid fa-share" style="margin-right:0.5em;"></i>直接跳转</div>',
  );

  $previewJumpBtn.on('click', () => {
    const target = parseFloorInput($jumpInput.val());
    if (target === null) return;
    errorCatched(openPreviewPopup)(target);
  });

  $directJumpBtn.on('click', async () => {
    const target = parseFloorInput($jumpInput.val());
    if (target === null) return;
    await doJump(target);
  });

  $jumpBtnRow.append($previewJumpBtn, $directJumpBtn);
  $jumpSection.append($jumpBtnRow);
  $panel.append($jumpSection);

  // ─── 弹出面板 ───
  SillyTavern.callGenericPopup($panel, SillyTavern.POPUP_TYPE.DISPLAY, '', {
    allowVerticalScrolling: true,
  });

  // 修改主面板 dialog，应用位置补偿 CSS
  requestAnimationFrame(() => {
    $panel.closest('dialog').addClass('hfm-popup-dialog');
  });

  // 初始查询
  refreshHiddenDisplay($hiddenDisplay);
}

// ─── 初始化 & 卸载 ───

function init(): void {
  console.info('[hidden-floor-manager] 脚本加载');

  // 注入样式
  if ($('#hfm-preview-style').length === 0) {
    $('head').append(`<style id="hfm-preview-style">
      .hfm-preview-list { width: 100%; min-width: 0; overflow-x: hidden; }
      .hfm-preview-item { border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1)); border-radius: 5px; padding: 8px; margin-bottom: 6px; width: 100%; box-sizing: border-box; }
      .hfm-preview-center { border-color: var(--SmartThemeQuoteColor, #f0c040); box-shadow: 0 0 4px var(--SmartThemeQuoteColor, #f0c040); }
      .hfm-content { padding: 4px 0; overflow-wrap: break-word; text-align: left; width: 100%; box-sizing: border-box; }
      .hfm-content q { quotes: none; }
      .hfm-content pre { max-width: 100%; overflow-x: auto; box-sizing: border-box; }
      .hfm-content.hfm-collapsed { max-height: ${PREVIEW_COLLAPSE_HEIGHT}; overflow: hidden; }
      .hfm-sticky-top { position: sticky; top: 0; z-index: 1; background: var(--SmartThemeBlurTintColor); padding: 8px 0 4px 0; margin: -8px 0 0 0; }
      /* 滚动条轨道上方留出空间，避免与关闭按钮重叠 */
      .hfm-popup-dialog .popup-content::-webkit-scrollbar-track { margin-top: 50px; }
      /* 关闭按钮向左下偏移 + 提升层级避免被吸顶栏遮挡 */
      .hfm-popup-dialog .popup-button-close { right: 8px; top: 8px; z-index: 2; }
    </style>`);
  }

  // 注入菜单项
  const $menuItem = $(`
    <div id="${MENU_ITEM_ID}" class="list-group-item flex-container flexGap5">
      <div class="fa-fw fa-solid fa-eye-slash extensionsMenuExtensionButton"></div>
      <span>隐藏楼层管理</span>
    </div>
  `);
  $menuItem.on('click', () => {
    errorCatched(openPanel)();
  });
  $('#extensionsMenu').append($menuItem);

  // 卸载清理
  $(window).on('pagehide', () => {
    console.info('[hidden-floor-manager] 脚本卸载');
    $(`#${MENU_ITEM_ID}`).remove();
    $('#hfm-preview-style').remove();
  });
}

$(() => {
  errorCatched(init)();
});

export {};
