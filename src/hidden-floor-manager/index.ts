/**
 * 隐藏楼层管理器
 *
 * 在酒馆扩展菜单（魔棒）中添加入口，打开原生 Popup 面板，
 * 展示已隐藏楼层的合并范围，并支持按范围批量隐藏/显示。
 */

// ─── 常量 ───

const MENU_ITEM_ID = 'hidden_floor_manager_btn';

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
  return ranges
    .map(r => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`))
    .join(', ');
}

// ─── 面板 ───

/** 查询隐藏楼层并更新面板内 DOM */
async function refreshHiddenDisplay($container: JQuery): Promise<void> {
  $container.text('查询中...');
  try {
    const lastId = getLastMessageId();
    const hidden = getChatMessages(`0-${lastId}`, { hide_state: 'hidden' });
    const ids = hidden.map(m => m.message_id);
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

/** 构建面板 HTML 并弹出 */
async function openPanel(): Promise<void> {
  const lastId = getLastMessageId();

  // 构建面板 DOM
  const $panel = $('<div class="wide100p"></div>');

  // 标题
  $panel.append('<h3>隐藏楼层管理</h3>');

  // 概要行
  $panel.append(`<p>最新消息层数: ${lastId}</p>`);

  // 已隐藏楼层
  $panel.append('<div><b>已隐藏楼层:</b></div>');
  const $hiddenDisplay = $('<div style="margin: 4px 0 0; min-height: 1.2em;"></div>');
  $panel.append($hiddenDisplay);

  // 分隔线
  $panel.append('<hr>');

  // 范围输入行
  const $inputRow = $('<div class="flex-container flexGap5" style="align-items: center; justify-content: center;"></div>');
  const $startInput = $('<input type="number" class="text_pole" min="0" style="width: 70px; text-align: center;">')
    .val(0);
  const $endInput = $('<input type="number" class="text_pole" min="0" style="width: 70px; text-align: center;">')
    .val(lastId);
  $inputRow.append($startInput, '<span style="margin: 0 4px;">-</span>', $endInput);
  $panel.append($inputRow);

  // 操作按钮行
  const $btnRow = $('<div class="flex-container flexGap5" style="margin-top: 8px; justify-content: center;"></div>');

  const $hideBtn = $('<div class="menu_button" style="white-space: nowrap;">隐藏</div>');

  const $showBtn = $('<div class="menu_button" style="white-space: nowrap;">显示</div>');

  // 隐藏按钮点击
  $hideBtn.on('click', async () => {
    const start = Number($startInput.val());
    const end = Number($endInput.val());
    if (isNaN(start) || isNaN(end) || start > end || start < 0) {
      toastr.warning('请输入有效的楼层范围');
      return;
    }
    await triggerSlash(`/hide ${start}-${end}`);
    await refreshHiddenDisplay($hiddenDisplay);
  });

  // 显示按钮点击
  $showBtn.on('click', async () => {
    const start = Number($startInput.val());
    const end = Number($endInput.val());
    if (isNaN(start) || isNaN(end) || start > end || start < 0) {
      toastr.warning('请输入有效的楼层范围');
      return;
    }
    await triggerSlash(`/unhide ${start}-${end}`);
    await refreshHiddenDisplay($hiddenDisplay);
  });

  $btnRow.append($hideBtn, $showBtn);
  $panel.append($btnRow);

  SillyTavern.callGenericPopup($panel, SillyTavern.POPUP_TYPE.DISPLAY, '', {
    allowVerticalScrolling: true,
  });

  requestAnimationFrame(() => {
    const $popup = $panel.closest('.popup');
    $popup.css('width', '350px');
    
    // 覆盖原生关闭按钮的位置，将其往左下移动到边框内部
    const $closeBtn = $popup.find('.popup-button-close');
    $closeBtn.css({
      top: '10px',
      right: '10px'
    });
  });

  // 初始查询
  await refreshHiddenDisplay($hiddenDisplay);
}

// ─── 初始化 & 卸载 ───

function init(): void {
  console.info('[hidden-floor-manager] 脚本加载');

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
  });
}

$(() => {
  errorCatched(init)();
});
