import {
  SOUND_TYPE_IDS,
  getSoundType,
  type AlertStyleId,
  type SensitivityId,
  type SoundTypeId,
  type VibrationPatternId,
} from './catalog';

/** Per-sound alert configuration the user can change. */
export interface SoundTypeAlert {
  enabled: boolean;
  alertStyle: AlertStyleId;
  vibrationPattern: VibrationPatternId;
}

/**
 * Everything the Sound Awareness feature remembers for one profile. Stored as a single JSON
 * payload, like `composed_messages.payload`, because the settings are always read and written
 * together.
 */
export interface SoundAwarenessSettings {
  /** Master switch: when false the microphone is never opened. */
  masterEnabled: boolean;
  /** Global detection threshold; higher sensitivity means more (and noisier) alerts. */
  sensitivity: SensitivityId;
  /** Flash the screen white while an alert is showing. */
  screenFlash: boolean;
  quietHoursEnabled: boolean;
  /** Minutes after midnight, 0-1439. */
  quietStartMinute: number;
  quietEndMinute: number;
  sounds: Record<SoundTypeId, SoundTypeAlert>;
}

export const ALERT_STYLES: readonly { id: AlertStyleId; label: string; description: string }[] = [
  { id: 'banner', label: 'Banner', description: 'A banner at the top of the screen.' },
  { id: 'banner-pulse', label: 'Pulsing banner', description: 'A banner with a pulsing border.' },
  { id: 'fullscreen', label: 'Full screen', description: 'A full-screen alert that stays until dismissed.' },
];

export const VIBRATION_PATTERNS: readonly { id: VibrationPatternId; label: string; description: string }[] = [
  { id: 'single', label: 'Single buzz', description: 'One short vibration.' },
  { id: 'double', label: 'Double buzz', description: 'Two short vibrations.' },
  { id: 'long', label: 'Long buzz', description: 'One long vibration.' },
  { id: 'urgent', label: 'Urgent', description: 'A repeating urgent pattern.' },
];

export const SENSITIVITIES: readonly { id: SensitivityId; label: string; description: string }[] = [
  { id: 'low', label: 'Low', description: 'Only clear, confident sounds alert.' },
  { id: 'medium', label: 'Medium', description: 'A balance of alerts and quiet.' },
  { id: 'high', label: 'High', description: 'More sensitive; may alert on similar sounds.' },
];

function defaultSoundAlerts(): Record<SoundTypeId, SoundTypeAlert> {
  const sounds = {} as Record<SoundTypeId, SoundTypeAlert>;
  for (const id of SOUND_TYPE_IDS) {
    const definition = getSoundType(id);
    sounds[id] = {
      enabled: true,
      alertStyle: definition.defaultAlertStyle,
      vibrationPattern: definition.defaultVibrationPattern,
    };
  }
  return sounds;
}

export const DEFAULT_SOUND_SETTINGS: SoundAwarenessSettings = {
  masterEnabled: false,
  sensitivity: 'medium',
  screenFlash: true,
  quietHoursEnabled: false,
  quietStartMinute: 22 * 60,
  quietEndMinute: 7 * 60,
  sounds: defaultSoundAlerts(),
};

/** Minimum model confidence before a detection can alert, per sensitivity. */
export function confidenceThreshold(sensitivity: SensitivityId): number {
  switch (sensitivity) {
    case 'low':
      return 0.5;
    case 'high':
      return 0.2;
    case 'medium':
    default:
      return 0.35;
  }
}

function toAlertStyle(value: unknown, fallback: AlertStyleId): AlertStyleId {
  return value === 'banner' || value === 'banner-pulse' || value === 'fullscreen'
    ? value
    : fallback;
}

function toVibrationPattern(value: unknown, fallback: VibrationPatternId): VibrationPatternId {
  return value === 'single' || value === 'double' || value === 'long' || value === 'urgent'
    ? value
    : fallback;
}

function toSensitivity(value: unknown): SensitivityId {
  return value === 'low' || value === 'high' ? value : 'medium';
}

function clampMinute(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(1439, Math.max(0, Math.round(value)));
}

function toSoundAlerts(candidate: unknown): Record<SoundTypeId, SoundTypeAlert> {
  const sounds = defaultSoundAlerts();
  if (candidate && typeof candidate === 'object') {
    const stored = candidate as Record<string, Partial<SoundTypeAlert>>;
    for (const id of SOUND_TYPE_IDS) {
      const entry = stored[id];
      if (entry && typeof entry === 'object') {
        sounds[id] = {
          enabled: entry.enabled !== false,
          alertStyle: toAlertStyle(entry.alertStyle, sounds[id].alertStyle),
          vibrationPattern: toVibrationPattern(
            entry.vibrationPattern,
            sounds[id].vibrationPattern
          ),
        };
      }
    }
  }
  return sounds;
}

/**
 * Coerces stored or partial settings into a valid `SoundAwarenessSettings`.
 *
 * Same rule as `normalizePreferences`: storage is a system boundary, so nothing stored by an older
 * or damaged build may push the feature into an unusable state.
 */
export function normalizeSoundSettings(
  candidate: Partial<SoundAwarenessSettings> | null | undefined
): SoundAwarenessSettings {
  const source = candidate ?? {};
  return {
    masterEnabled: source.masterEnabled === true,
    sensitivity: toSensitivity(source.sensitivity),
    screenFlash: source.screenFlash !== false,
    quietHoursEnabled: source.quietHoursEnabled === true,
    quietStartMinute: clampMinute(source.quietStartMinute, DEFAULT_SOUND_SETTINGS.quietStartMinute),
    quietEndMinute: clampMinute(source.quietEndMinute, DEFAULT_SOUND_SETTINGS.quietEndMinute),
    sounds: toSoundAlerts(source.sounds),
  };
}

/**
 * True when `minuteOfDay` falls inside the quiet-hours window.
 *
 * Windows may wrap past midnight (22:00 → 07:00), which is the common case; a window whose start
 * equals its end is treated as "always quiet" only when both are identical by user choice, so it
 * is handled as the full day.
 */
export function isQuietHour(
  settings: Pick<SoundAwarenessSettings, 'quietHoursEnabled' | 'quietStartMinute' | 'quietEndMinute'>,
  minuteOfDay: number
): boolean {
  if (!settings.quietHoursEnabled) {
    return false;
  }
  const start = clampMinute(settings.quietStartMinute, 0);
  const end = clampMinute(settings.quietEndMinute, 0);
  const minute = ((minuteOfDay % 1440) + 1440) % 1440;
  if (start === end) {
    return true;
  }
  if (start < end) {
    return minute >= start && minute < end;
  }
  return minute >= start || minute < end;
}

/** Android `Vibration.vibrate` pattern (ms) for each picker choice. The leading 0 is the delay. */
export function vibrationPatternMs(pattern: VibrationPatternId): number[] {
  switch (pattern) {
    case 'double':
      return [0, 250, 200, 250];
    case 'long':
      return [0, 900];
    case 'urgent':
      return [0, 200, 150, 200, 150, 200, 400];
    case 'single':
    default:
      return [0, 400];
  }
}

/** `HH:MM` for a minute-of-day value, used by the quiet-hours picker. */
export function formatMinuteOfDay(minute: number): string {
  const clamped = clampMinute(minute, 0);
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
