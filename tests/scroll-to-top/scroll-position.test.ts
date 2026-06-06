import { getMessageBottomScrollTop, getMessageTopScrollTop } from '../../src/scroll-to-top/scroll-position';

function assertEqual(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const chatRect = { top: 10, bottom: 610 };
const messageRect = { top: 40, bottom: 1400 };
const currentScrollTop = 120;

assertEqual(
  getMessageTopScrollTop({ currentScrollTop, chatRect, messageRect }),
  150,
  'top target aligns the message top with the chat viewport top',
);

assertEqual(
  getMessageBottomScrollTop({ currentScrollTop, chatRect, messageRect }),
  910,
  'bottom target aligns the message bottom with the chat viewport bottom',
);

console.info('scroll-position tests passed');
