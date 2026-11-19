/* eslint-disable import-x/no-nodejs-modules */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(path.join(process.env.PLAYWRIGHT_MODULE, 'index.mjs')).href
    : 'playwright'
);

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = [
  '<!doctype html><html><head><meta charset="utf-8"><title>回顶按钮刷新回归测试</title>',
  '<script src="/jquery.js"></script><script src="/vue.js"></script>',
  '<style id="native-style">',
  'html,body{margin:0;height:100%;overflow:hidden}#chat{height:100%;width:min(850px,100%);margin:auto;overflow:auto}',
  '.mes{position:relative;padding:20px}.mes_buttons{display:flex;height:30px}.mes_text{height:1200px}',
  '.swipe_left,.swipe_right{position:absolute;bottom:20px;width:32px;height:28px;font-size:18px;line-height:20px}',
  '.swipe_left{left:20px}.swipe_right{right:20px}',
  '.mes_scroll_to_top::before{content:"↑"}.mes_scroll_to_bottom::before{content:"↓"}',
  'iframe{display:none}</style></head><body><div id="chat"></div><iframe id="script-frame"></iframe>',
  '<script type="module">window.z=await import("/zod/index.js");</script></body></html>',
].join('\n');
const frame = [
  '<!doctype html><html><head></head><body><script>',
  'window.$=parent.$;window.Vue=parent.Vue;window.z=parent.z;',
  'window.getVariables=()=>parent.scriptSettings;window.replaceVariables=value=>parent.scriptSettings=value;',
  'window.getScriptId=()=>"button-refresh-test";window.appendInexistentScriptButtons=()=>{};',
  'window.getButtonEvent=name=>name;window.toastr={success:()=>{}};',
  'window.errorCatched=fn=>fn;',
  'window.tavern_events={CHARACTER_MESSAGE_RENDERED:"character_message_rendered",USER_MESSAGE_RENDERED:"user_message_rendered",',
  'MESSAGE_SWIPED:"message_swiped",MORE_MESSAGES_LOADED:"more_messages_loaded",CHAT_CHANGED:"chat_changed",SETTINGS_UPDATED:"settings_updated"};',
  'window.eventOn=(name,callback)=>{const handlers=parent.events.get(name)||[];handlers.push(callback);parent.events.set(name,handlers);};',
  '</script><script src="/scroll.js"></script></body></html>',
].join('\n');

const server = http.createServer(async (request, response) => {
  try {
    const route = new URL(request.url, 'http://localhost').pathname;
    if (route === '/' || route === '/frame.html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(route === '/' ? html : frame);
      return;
    }
    if (route === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const files = {
      '/jquery.js': path.join(repo, 'node_modules/jquery/dist/jquery.min.js'),
      '/vue.js': path.join(repo, 'node_modules/vue/dist/vue.global.prod.js'),
      '/scroll.js': path.join(repo, 'dist/scroll-to-top/index.js'),
    };
    let file = files[route];
    if (route.startsWith('/zod/') && route.endsWith('.js')) {
      const root = path.join(repo, 'node_modules/zod');
      file = path.resolve(root, decodeURIComponent(route.slice(5)));
      assert.ok(file.startsWith(root + path.sep));
    }
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    response.end(await fs.readFile(file));
  } catch (error) {
    response.writeHead(500).end(error.message);
  }
});

const settle = page =>
  page.evaluate(
    () =>
      new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }),
  );

async function sample(page, session, action) {
  await settle(page);
  await page.evaluate(() => {
    window.stats = { heightReads: 0, mutations: { class: 0, style: 0 } };
  });
  const before = await session.send('Performance.getMetrics');
  await action();
  await settle(page);
  const after = await session.send('Performance.getMetrics');
  const layouts = metrics => metrics.metrics.find(item => item.name === 'LayoutCount').value;
  return { ...(await page.evaluate(() => window.stats)), layouts: layouts(after) - layouts(before) };
}

async function setSettings(page, settings) {
  await page.evaluate(value => {
    Object.assign(window.scriptSettings, value);
    const frameWindow = document.getElementById('script-frame').contentWindow;
    frameWindow.dispatchEvent(new frameWindow.CustomEvent('scroll-to-top-settings-changed'));
  }, settings);
  await page.waitForTimeout(140);
  await settle(page);
}

async function buttonStyle(page) {
  return page
    .locator('.mes_scroll_to_top')
    .first()
    .evaluate(button => {
      const style = getComputedStyle(button);
      const transform = new DOMMatrix(style.transform);
      return {
        left: parseFloat(style.left),
        right: parseFloat(style.right),
        width: parseFloat(style.width),
        height: parseFloat(style.height),
        fontSize: parseFloat(style.fontSize),
        lineHeight: parseFloat(style.lineHeight),
        marginLeft: parseFloat(style.marginLeft),
        translateX: transform.e,
        translateY: transform.f,
        visible: style.display !== 'none',
        messageWidth: button.parentElement.clientWidth,
      };
    });
}

async function runCase(browser, viewport, url) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const session = await context.newCDPSession(page);
  await session.send('Performance.enable');
  try {
    await page.goto(url);
    assert.equal(await page.title(), '回顶按钮刷新回归测试');
    await page.waitForFunction(() => window.z !== undefined);
    await page.evaluate(() => {
      window.scriptSettings = {};
      window.events = new Map();
      window.emit = (name, ...args) => {
        for (const callback of window.events.get(name) || []) callback(...args);
      };
      window.addMessages = count => {
        const chat = document.getElementById('chat');
        const first = chat.children.length;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
          const message = document.createElement('div');
          message.className = 'mes';
          message.setAttribute('mesid', String(first + i));
          message.innerHTML =
            '<div class="mes_block"><div class="mes_buttons"><div class="extraMesButtonsHint">更多</div></div>' +
            '<div class="mes_text">用于验证回顶按钮的测试消息</div></div><div class="swipe_left">左</div><div class="swipe_right">右</div>';
          fragment.append(message);
        }
        chat.append(fragment);
      };
      window.stats = { heightReads: 0, mutations: { class: 0, style: 0 } };
      const outerHeight = $.fn.outerHeight;
      $.fn.outerHeight = function (...args) {
        if (this[0]?.classList.contains('mes')) window.stats.heightReads++;
        return outerHeight.apply(this, args);
      };
      new MutationObserver(records => {
        for (const record of records) {
          if (record.type === 'attributes') window.stats.mutations[record.attributeName]++;
        }
      }).observe(document.getElementById('chat'), {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      window.addMessages(40);
      document.getElementById('script-frame').src = '/frame.html';
    });
    await page.waitForFunction(() => document.querySelectorAll('.mes_scroll_to_top').length === 40);
    await settle(page);

    const unchanged = await sample(page, session, () => page.evaluate(() => emit('settings_updated')));
    assert.equal(unchanged.mutations.class, 0, '无关设置保存不应清除、重加全部按钮的位置 class');
    assert.equal(unchanged.mutations.style, 0, '无关设置保存不应重写全部按钮的样式');
    assert.ok(unchanged.layouts <= 2, '高度检查不应逐条触发排版计算');

    const repeated = await sample(page, session, () =>
      page.evaluate(() => {
        emit('settings_updated');
        emit('settings_updated');
        emit('settings_updated');
      }),
    );
    assert.equal(repeated.mutations.class + repeated.mutations.style, 0, '连续设置通知不应反复重写按钮');
    assert.ok(repeated.layouts <= 2, '连续设置通知不应反复计算整页排版');

    const themeChanged = await sample(page, session, () =>
      page.evaluate(() => {
        document.getElementById('native-style').textContent +=
          '\n' +
          '.swipe_left,.swipe_right{width:48px;height:36px;font-size:24px;line-height:28px;bottom:34px}' +
          '.swipe_left{left:24px}.swipe_right{right:26px}';
        emit('settings_updated');
      }),
    );
    let style = await buttonStyle(page);
    assert.deepEqual(
      [style.width, style.height, style.fontSize, style.lineHeight],
      [48, 36, 24, 28],
      '主题改变后按钮仍应同步原生 swipe 按钮的尺寸和字体',
    );
    assert.ok(themeChanged.layouts <= 3, '主题变化应集中同步尺寸、集中读取高度');

    await setSettings(page, { position: 'left', opticalXOffset: 7, opticalYOffset: 9 });
    style = await buttonStyle(page);
    assert.equal(style.left, 61, '左侧位置保留原生间距与手动 X 偏移');
    assert.equal(style.translateY, 9, '保留手动 Y 偏移');

    await setSettings(page, { position: 'center' });
    style = await buttonStyle(page);
    assert.ok(Math.abs(style.left - style.messageWidth / 2) < 1, '中间位置保持水平居中');
    assert.equal(style.marginLeft, 7, '中间位置保留手动 X 偏移');
    assert.equal(style.translateX, -style.width / 2, '中间位置按按钮宽度居中');
    assert.equal(style.translateY, 9);

    await setSettings(page, { position: 'right' });
    style = await buttonStyle(page);
    assert.equal(style.right, 64, '右侧位置保留原生间距，正 X 偏移向右移动');
    await page.evaluate(() => {
      const frameWindow = document.getElementById('script-frame').contentWindow;
      frameWindow.dispatchEvent(
        new frameWindow.CustomEvent('scroll-to-top-settings-preview', { detail: { x: 13, y: -4 } }),
      );
    });
    style = await buttonStyle(page);
    assert.equal(style.right, 58, '微调预览立即移动按钮');
    assert.equal(style.translateY, -4);

    const rendered = await sample(page, session, () =>
      page.evaluate(() => {
        document.querySelector('.mes[mesid="39"] .mes_text').style.height = '100px';
        emit('character_message_rendered', 39);
      }),
    );
    assert.equal(rendered.heightReads, 1, '渲染完成只读取当前消息高度一次');
    assert.equal(await page.locator('.mes[mesid="39"] > .mes_scroll_to_top').isVisible(), false, '短消息隐藏回顶按钮');
    assert.equal(await page.locator('.mes[mesid="0"] > .mes_scroll_to_top').isVisible(), true, '其它长消息保持显示');
    await setSettings(page, { showBottomButton: false });
    assert.equal(
      await page.locator('.mes[mesid="0"] .mes_scroll_to_bottom').isVisible(),
      false,
      '保留显示回底按钮开关',
    );

    await page.evaluate(() => {
      window.existingButton = document.querySelector('.mes_scroll_to_top');
    });
    const more = await sample(page, session, () =>
      page.evaluate(() => {
        addMessages(10);
        emit('more_messages_loaded');
      }),
    );
    assert.equal(await page.locator('.mes_scroll_to_top').count(), 50, '新增消息各有一个回顶按钮');
    assert.equal(await page.locator('.mes_scroll_to_bottom').count(), 50, '新增消息各有一个回底按钮');
    assert.equal(
      await page.evaluate(() => existingButton === document.querySelector('.mes_scroll_to_top')),
      true,
      '加载更多消息保留已有按钮',
    );
    assert.ok(more.layouts <= 3, '批量注入消息按钮不应逐条计算排版');

    await setSettings(page, { showBottomButton: true });
    await page.evaluate(() => {
      const frameWindow = document.getElementById('script-frame').contentWindow;
      frameWindow.dispatchEvent(new frameWindow.CustomEvent('scroll-to-top-recalibrate'));
    });
    await settle(page);
    style = await buttonStyle(page);
    assert.equal(style.right, 64, '重新对齐保留已保存的手动偏移');
    assert.equal(style.translateY, 9);
    assert.equal(await page.locator('.mes_scroll_to_top').count(), 50);
    assert.equal(await page.locator('.mes_scroll_to_bottom').count(), 50);

    const firstTopButton = page.locator('.mes[mesid="0"] > .mes_scroll_to_top');
    await firstTopButton.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0 });
    await page.locator('.panel-title').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.panel-title').textContent(), '跳转按钮设置', '长按仍打开原有设置面板');
    await firstTopButton.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0 });
    await firstTopButton.dispatchEvent('click');
    await page.getByTitle('关闭设置').dispatchEvent('click');
    await page.locator('#mes-scroll-settings-container').waitFor({ state: 'detached' });

    for (const direction of ['top', 'bottom']) {
      const target = await page.evaluate(value => {
        const chat = document.getElementById('chat');
        chat.scrollTop = 10000;
        const message = document.querySelector('.mes[mesid="10"]');
        const messageRect = message.getBoundingClientRect(),
          chatRect = chat.getBoundingClientRect();
        const expected =
          chat.scrollTop + (value === 'top' ? messageRect.top - chatRect.top : messageRect.bottom - chatRect.bottom);
        message.querySelector('.mes_scroll_to_' + value).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return expected;
      }, direction);
      await page.waitForTimeout(400);
      const actual = await page.locator('#chat').evaluate(chat => chat.scrollTop);
      assert.ok(Math.abs(actual - target) <= 1, '点击跳转后消息边缘应与聊天区边缘对齐');
    }
    assert.deepEqual(errors, [], '页面不应出现运行错误');
    console.info(JSON.stringify({ viewport, unchanged, repeated, themeChanged, rendered, more, errors }));
  } finally {
    await context.close();
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL } : {}),
    });
    const url = 'http://127.0.0.1:' + server.address().port;
    for (const viewport of [
      { width: 1332, height: 896 },
      { width: 390, height: 844 },
    ]) {
      await runCase(browser, viewport, url);
    }
    console.info('button-refresh browser tests passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
