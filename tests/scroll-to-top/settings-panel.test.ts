/* eslint-disable import-x/no-nodejs-modules */
import { readFileSync } from 'node:fs';

function assert(condition: boolean, label: string): void {
  if (!condition) {
    throw new Error(label);
  }
}

const source = readFileSync('src/scroll-to-top/SettingsPanel.vue', 'utf8');
const recalibrateButton = source.match(/<button class="calib-btn" @click="recalibrate">([\s\S]*?)<\/button>/)?.[1];
const recalibrateFunction = source.match(/const recalibrate = \(\) => \{([\s\S]*?)\n\};/)?.[1];

assert(recalibrateButton !== undefined, 'recalibrate button exists');
assert(recalibrateButton.includes('重新对齐美化'), 'recalibrate button uses the shorter requested label');
assert(!recalibrateButton.includes('和当前主题对齐'), 'old recalibrate label is removed');
assert(!recalibrateButton.includes('<i'), 'recalibrate button no longer renders an icon');
assert(!recalibrateButton.includes('fa-arrows-rotate'), 'recalibrate button no longer renders the rotate icon');

assert(recalibrateFunction !== undefined, 'recalibrate function exists');
assert(
  recalibrateFunction.includes("window.dispatchEvent(new CustomEvent('scroll-to-top-recalibrate'));"),
  'recalibrate still dispatches the alignment event',
);
assert(recalibrateFunction.includes('toastr.success('), 'recalibrate shows a success toast');
assert(recalibrateFunction.includes('已重新对齐美化'), 'recalibrate toast uses the requested title');
assert(
  recalibrateFunction.includes('已调整底部按钮位置和大小，保留并叠加之前的手动微调结果'),
  'recalibrate toast uses the requested message',
);

console.info('settings-panel tests passed');
