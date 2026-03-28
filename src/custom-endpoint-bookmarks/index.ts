import { createScriptIdDiv } from '@util/script';

// ===================== 国际化 =====================

const locale = localStorage.getItem('language') || navigator.language || 'en';
const isChinese = locale.startsWith('zh');

const t = isChinese
  ? {
      title: '自定义端点预设',
      checkbox: '切换对话补全预设时，不切换API设置',
      none: '无',
      btnNew: '新增',
      btnSave: '保存',
      btnRename: '改名',
      btnDelete: '删除',
      promptName: '请输入预设名称：',
      promptRename: '请输入新名称：',
      promptDelete: (n: string) => `确认删除预设「${n}」？`,
      toastCreated: (n: string) => `预设「${n}」已创建`,
      toastUpdated: (n: string) => `预设「${n}」已更新`,
      toastRenamed: (n: string) => `已重命名为「${n}」`,
      toastDeleted: (n: string) => `预设「${n}」已删除`,
      toastDuplicate: (n: string) => `已存在同名预设「${n}」`,
    }
  : {
      title: 'Custom Endpoint Presets',
      checkbox: 'Keep API settings when switching chat completion presets',
      none: 'None',
      btnNew: 'New',
      btnSave: 'Save',
      btnRename: 'Rename',
      btnDelete: 'Delete',
      promptName: 'Enter preset name:',
      promptRename: 'Enter new name:',
      promptDelete: (n: string) => `Delete preset "${n}"?`,
      toastCreated: (n: string) => `Preset "${n}" created`,
      toastUpdated: (n: string) => `Preset "${n}" updated`,
      toastRenamed: (n: string) => `Renamed to "${n}"`,
      toastDeleted: (n: string) => `Preset "${n}" deleted`,
      toastDuplicate: (n: string) => `Preset "${n}" already exists`,
    };

// ===================== 数据层 =====================

interface Bookmark {
  name: string;
  url: string;
  secretId: string | null;
  model: string;
}

interface BookmarkStore {
  bookmarks: Bookmark[];
  selectedName: string | null;
}

const STORE_KEY = 'customEndpointBookmarks';

function getStore(): BookmarkStore {
  const ext = SillyTavern.extensionSettings;
  if (!ext[STORE_KEY]) {
    ext[STORE_KEY] = { bookmarks: [], selectedName: null };
  }
  return ext[STORE_KEY] as BookmarkStore;
}

function saveStore() {
  SillyTavern.saveSettingsDebounced();
}

/** 通过 STScript 命令获取当前激活的 Secret ID */
async function getActiveSecretId(): Promise<string | null> {
  try {
    const result = await SillyTavern.executeSlashCommandsWithOptions('/secret-id quiet=true');
    if (result && !result.isError && result.pipe) {
      return String(result.pipe).trim() || null;
    }
  } catch {
    // 获取失败则为 null
  }
  return null;
}

// ===================== UI 层 =====================

console.log('[ceb] 脚本模块已加载');

$(() => {
  console.log('[ceb] jQuery ready 回调已触发');
  const store = getStore();
  console.log('[ceb] Store 已初始化:', JSON.stringify(store));

  // --- 创建书签容器（仅 Custom 时显示） ---
  const $container = createScriptIdDiv().addClass('custom-endpoint-bookmarks');

  // --- 标题 ---
  const $title = $('<h4>').text(t.title);

  // --- 勾选框：切换预设不切换API设置（始终显示，放在 Connection Manager 下方） ---
  const $checkboxWrapper = createScriptIdDiv().addClass('custom-endpoint-bookmarks-bind');
  const $checkboxRow = $('<div class="flex-container alignItemsCenter gap5px marginTop5">');
  const $checkbox = $('<input type="checkbox" id="ceb_bind_toggle">').prop(
    'checked',
    !SillyTavern.chatCompletionSettings.bind_preset_to_connection,
  );
  const $checkboxLabel = $('<label for="ceb_bind_toggle" class="checkbox_label">').text(t.checkbox);
  $checkboxRow.append($checkbox, $checkboxLabel);
  $checkboxWrapper.append($checkboxRow);

  $checkbox.on('change', function () {
    const nativeCb = $('#bind_preset_to_connection');
    nativeCb.prop('checked', !$(this).prop('checked')).trigger('input');
  });

  // 监听原生勾选框变化，同步到我们的勾选框
  const syncCheckbox = () => {
    $checkbox.prop('checked', !SillyTavern.chatCompletionSettings.bind_preset_to_connection);
  };
  $('#bind_preset_to_connection').on('input.ceb', syncCheckbox);

  // --- 下拉框行 ---
  const $row = $('<div class="flex-container alignItemsCenter gap5px">');

  const $select = $('<select class="text_pole flex1">');

  const $btnCreate = $(`<i class="menu_button fa-solid fa-plus" title="${t.btnNew}"></i>`);
  const $btnSave = $(`<i class="menu_button fa-solid fa-save" title="${t.btnSave}"></i>`);
  const $btnRename = $(`<i class="menu_button fa-solid fa-pencil" title="${t.btnRename}"></i>`);
  const $btnDelete = $(`<i class="menu_button fa-solid fa-trash" title="${t.btnDelete}"></i>`);

  $row.append($select, $btnCreate, $btnSave, $btnRename, $btnDelete);

  $container.append($title, $row);

  // --- 渲染下拉框 ---
  function renderDropdown() {
    $select.empty();
    $select.append($('<option value="">').text(t.none));
    for (const bm of store.bookmarks) {
      const $opt = $('<option>').val(bm.name).text(bm.name);
      if (bm.name === store.selectedName) {
        $opt.prop('selected', true);
      }
      $select.append($opt);
    }
    toggleButtons();
  }

  function toggleButtons() {
    const hasSelection = !!$select.val();
    $btnSave.toggleClass('disabled', !hasSelection);
    $btnRename.toggleClass('disabled', !hasSelection);
    $btnDelete.toggleClass('disabled', !hasSelection);
  }

  // --- 切换书签 ---
  $select.on('change', async function () {
    const name = String($(this).val());
    if (!name) {
      store.selectedName = null;
      saveStore();
      toggleButtons();
      return;
    }

    const bookmark = store.bookmarks.find(b => b.name === name);
    if (!bookmark) return;

    store.selectedName = name;
    saveStore();
    toggleButtons();

    // 填入 URL
    $('#custom_api_url_text').val(bookmark.url).trigger('input');
    // 填入模型名
    $('#custom_model_id').val(bookmark.model).trigger('input');
    // 切换 API Key（使用原生命令，自动刷新显示和触发重连）
    if (bookmark.secretId) {
      try {
        await SillyTavern.executeSlashCommandsWithOptions(
          `/secret-id quiet=true key=api_key_custom ${bookmark.secretId}`,
        );
      } catch (e) {
        console.error('[ceb] Failed to rotate secret:', e);
      }
    }
  });

  // --- 新增 ---
  $btnCreate.on('click', async () => {
    const name = await SillyTavern.callGenericPopup(t.promptName, SillyTavern.POPUP_TYPE.INPUT, '');

    if (!name || typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed) return;

    if (store.bookmarks.some(b => b.name === trimmed)) {
      toastr.error(t.toastDuplicate(trimmed));
      return;
    }

    const secretId = await getActiveSecretId();

    const bookmark: Bookmark = {
      name: trimmed,
      url: String($('#custom_api_url_text').val() || ''),
      secretId,
      model: String($('#custom_model_id').val() || ''),
    };

    store.bookmarks.push(bookmark);
    store.selectedName = trimmed;
    saveStore();
    renderDropdown();
    toastr.success(t.toastCreated(trimmed));
  });

  // --- 保存（覆盖当前选中） ---
  $btnSave.on('click', async () => {
    const name = store.selectedName;
    if (!name) return;

    const bookmark = store.bookmarks.find(b => b.name === name);
    if (!bookmark) return;

    const secretId = await getActiveSecretId();

    bookmark.url = String($('#custom_api_url_text').val() || '');
    bookmark.secretId = secretId ?? bookmark.secretId;
    bookmark.model = String($('#custom_model_id').val() || '');
    saveStore();
    toastr.success(t.toastUpdated(name));
  });

  // --- 改名 ---
  $btnRename.on('click', async () => {
    const oldName = store.selectedName;
    if (!oldName) return;

    const bookmark = store.bookmarks.find(b => b.name === oldName);
    if (!bookmark) return;

    const newName = await SillyTavern.callGenericPopup(t.promptRename, SillyTavern.POPUP_TYPE.INPUT, oldName);

    if (!newName || typeof newName !== 'string') return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    if (store.bookmarks.some(b => b.name === trimmed)) {
      toastr.error(t.toastDuplicate(trimmed));
      return;
    }

    bookmark.name = trimmed;
    store.selectedName = trimmed;
    saveStore();
    renderDropdown();
    toastr.success(t.toastRenamed(trimmed));
  });

  // --- 删除 ---
  $btnDelete.on('click', async () => {
    const name = store.selectedName;
    if (!name) return;

    const confirmed = await SillyTavern.callGenericPopup(t.promptDelete(name), SillyTavern.POPUP_TYPE.CONFIRM);

    if (!confirmed) return;

    const index = store.bookmarks.findIndex(b => b.name === name);
    if (index !== -1) {
      store.bookmarks.splice(index, 1);
    }
    store.selectedName = null;
    saveStore();
    renderDropdown();
    toastr.success(t.toastDeleted(name));
  });

  // --- 注入勾选框到 Connection Manager 下方（始终可见） ---
  const $connProfiles = $('#connection_profiles');
  if ($connProfiles.length) {
    const $connBlock = $connProfiles.closest('.wide100p');
    $connBlock.after($checkboxWrapper);
    console.log('[ceb] 勾选框已注入到 Connection Manager 下方');
  } else {
    $('#openai_api').prepend($checkboxWrapper);
    console.log('[ceb] fallback: 勾选框注入到 #openai_api 顶部');
  }

  // --- 注入书签UI到聊天补全来源下方（仅 Custom 时可见） ---
  const $sourceSelect = $('#chat_completion_source');
  console.log('[ceb] #chat_completion_source 找到:', $sourceSelect.length, '个元素');
  $sourceSelect.after($container);
  console.log('[ceb] 书签UI已注入到 #chat_completion_source 后面');

  // --- 可见性控制 ---
  function updateVisibility() {
    const currentSource = $('#chat_completion_source').val();
    const visible = currentSource === 'custom';
    console.log('[ceb] 当前来源:', currentSource, '显示:', visible);
    $container.toggle(visible);
  }
  updateVisibility();

  // 监听聊天补全来源变更（使用酒馆事件，自动清理）
  eventOn(tavern_events.CHATCOMPLETION_SOURCE_CHANGED, () => {
    updateVisibility();
    syncCheckbox();
  });

  // --- Connection Manager 事件同步（自动清理） ---
  eventOn(tavern_events.CONNECTION_PROFILE_LOADED, () => {
    store.selectedName = null;
    saveStore();
    $select.val('');
    toggleButtons();
    syncCheckbox();
  });

  // --- 初始渲染 ---
  renderDropdown();

  // --- 脚本卸载时清理 jQuery 事件和 DOM ---
  // eventOn 注册的事件会自动清理，只需手动清理 jQuery 命名空间事件和 DOM
  $(window).on('pagehide', () => {
    $('#bind_preset_to_connection').off('input.ceb');
    $container.remove();
    $checkboxWrapper.remove();
  });
});
