import { SettingsSchema } from '../../src/scroll-to-top/settings';

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const defaultSettings = SettingsSchema.parse({}) as { showBottomButton?: boolean };
assertEqual(defaultSettings.showBottomButton, true, 'bottom button is visible by default');

const disabledSettings = SettingsSchema.parse({ showBottomButton: false }) as { showBottomButton?: boolean };
assertEqual(disabledSettings.showBottomButton, false, 'bottom button visibility can be disabled');

console.info('settings-schema tests passed');
