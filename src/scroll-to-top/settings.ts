import { z } from 'zod';

export const SettingsSchema = z.object({
  position: z.enum(['left', 'center', 'right']).default('center'),
  opticalXOffset: z.number().default(0),
  opticalYOffset: z.number().default(0),
  showThresholdRatio: z.number().default(1),
  longPressMs: z.number().default(500),
  swipeLeftSpacing: z.number().default(30),
  swipeRightSpacing: z.number().default(45),
});

export type ScrollSettings = z.infer<typeof SettingsSchema>;

const SCRIPT_ID = 'scroll-to-top';

export function getSettings(): ScrollSettings {
  const raw = getVariables({ type: 'script', script_id: SCRIPT_ID }) || {};
  const parsed = SettingsSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return SettingsSchema.parse({});
}

export function saveSettings(settings: ScrollSettings): void {
  replaceVariables(settings, { type: 'script', script_id: SCRIPT_ID });
}
