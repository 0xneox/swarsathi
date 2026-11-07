import { create } from 'zustand';
import { Platform, Vibration } from 'react-native';
import {
  getSoundType,
  type AlertStyleId,
  type SensitivityId,
  type SoundTypeId,
} from '../services/sounds/catalog';
import {
  type SoundDetectionEngine,
  type SoundEvent,
} from '../services/sounds/engine';
import { createSoundDetectionEngine } from '../services/sounds/YamnetSoundDetectionEngine';
import {
  confidenceThreshold,
  isQuietHour,
  normalizeSoundSettings,
  vibrationPatternMs,
  type SoundAwarenessSettings,
  type SoundTypeAlert,
} from '../services/sounds/settings';
import { SwarSoundBridge } from '../services/sounds/SwarSoundBridge';
import {
  InMemorySoundEventRepository,
  SqliteSoundEventRepository,
  type SoundEventRecord,
  type SoundEventRepository,
} from '../services/storage/soundEvents';
import {
  InMemorySoundSettingsRepository,
  SqliteSoundSettingsRepository,
  type SoundSettingsRepository,
} from '../services/storage/soundSettings';
import { getDatabase, initializeDatabase } from '../services/storage/database';
import { createId } from '../utils/id';
import { logger } from '../utils/logger';

const SCOPE = 'SoundAwareness';

/** Re-alert cooldown per sound type, so a repeating sound does not strobe the screen. */
const ALERT_COOLDOWN_MS = 8000;
/** How many history rows the UI keeps in memory. */
const HISTORY_LIMIT = 50;

export type SoundAwarenessStatus =
  | 'idle'
  | 'loading'
  | 'unavailable'
  | 'ready'
  | 'listening'
  | 'error';

export type SoundPermissionState = 'unknown' | 'granted' | 'denied';

/** The alert currently on screen, if any. Rendered by `SoundAlertOverlay`. */
export interface ActiveSoundAlert {
  id: string;
  soundType: SoundTypeId;
  /** Human label, e.g. "Smoke alarm". */
  label: string;
  /** Raw classifier label, e.g. "Smoke detector, smoke alarm". */
  detectorLabel: string;
  confidence: number;
  detectedAt: number;
  alertStyle: AlertStyleId;
}

export interface SoundAwarenessState {
  status: SoundAwarenessStatus;
  /** Last engine error message, for the status card. */
  statusMessage: string | null;
  /** Whether this device can classify sounds on-device at all. */
  availability: 'unknown' | 'available' | 'unavailable';
  permission: SoundPermissionState;
  settings: SoundAwarenessSettings;
  events: SoundEventRecord[];
  activeAlert: ActiveSoundAlert | null;

  /** Loads settings + history and probes engine/permission. Idempotent. */
  bootstrap: () => Promise<void>;
  /** Re-checks the microphone permission without prompting. */
  refreshPermission: () => Promise<void>;
  /** Master switch. Turning on asks for the microphone permission if needed. */
  setMasterEnabled: (enabled: boolean) => Promise<void>;
  updateSoundAlert: (
    soundType: SoundTypeId,
    patch: Partial<Pick<SoundTypeAlert, 'enabled' | 'alertStyle' | 'vibrationPattern'>>
  ) => Promise<void>;
  setSensitivity: (sensitivity: SensitivityId) => Promise<void>;
  setScreenFlash: (enabled: boolean) => Promise<void>;
  setQuietHours: (quiet: {
    enabled: boolean;
    startMinute: number;
    endMinute: number;
  }) => Promise<void>;
  /** Shows a preview alert (and vibration) without recording a detection. */
  testAlert: (soundType: SoundTypeId) => void;
  dismissAlert: () => void;
  clearHistory: () => Promise<void>;
}

// region Injectable internals (test seams live at the bottom of this file)

let engineOverride: SoundDetectionEngine | null = null;
let settingsRepositoryOverride: SoundSettingsRepository | null = null;
let eventsRepositoryOverride: SoundEventRepository | null = null;
let vibrateOverride: ((pattern: number[]) => void) | null = null;

let engine: SoundDetectionEngine | null = null;
let settingsRepository: SoundSettingsRepository | null = null;
let eventsRepository: SoundEventRepository | null = null;
let detectionArmed = false;
const lastAlertAt = new Map<SoundTypeId, number>();

function resolveEngine(): SoundDetectionEngine {
  if (!engine) {
    engine = engineOverride ?? createSoundDetectionEngine();
  }
  return engine as SoundDetectionEngine;
}

async function resolveRepositories(): Promise<{
  settings: SoundSettingsRepository;
  events: SoundEventRepository;
}> {
  if (settingsRepositoryOverride && eventsRepositoryOverride) {
    return { settings: settingsRepositoryOverride, events: eventsRepositoryOverride };
  }
  if (settingsRepository && eventsRepository) {
    return { settings: settingsRepository, events: eventsRepository };
  }
  // Prefer SQLite; fall back to memory when storage cannot be opened, matching how the rest of
  // the app treats persistence as best-effort.
  const storageReady = await initializeDatabase().catch(() => false);
  if (storageReady) {
    try {
      await getDatabase();
      settingsRepository = new SqliteSoundSettingsRepository();
      eventsRepository = new SqliteSoundEventRepository();
    } catch {
      settingsRepository = new InMemorySoundSettingsRepository();
      eventsRepository = new InMemorySoundEventRepository();
    }
  } else {
    settingsRepository = new InMemorySoundSettingsRepository();
    eventsRepository = new InMemorySoundEventRepository();
  }
  return {
    settings: settingsRepository as SoundSettingsRepository,
    events: eventsRepository as SoundEventRepository,
  };
}

function vibrate(pattern: number[]): void {
  if (vibrateOverride) {
    vibrateOverride(pattern);
    return;
  }
  if (Platform.OS === 'android' && typeof Vibration?.vibrate === 'function') {
    try {
      Vibration.vibrate(pattern, false);
    } catch (error) {
      logger.warn(SCOPE, 'Vibration failed', error);
    }
  }
}

function minuteOfDay(now: number): number {
  const date = new Date(now);
  return date.getHours() * 60 + date.getMinutes();
}

// endregion

export const useSoundAwareness = create<SoundAwarenessState>((set, get) => {
  const persist = async (settings: SoundAwarenessSettings) => {
    const normalized = normalizeSoundSettings(settings);
    set({ settings: normalized });
    const repos = await resolveRepositories();
    try {
      await repos.settings.save(normalized);
    } catch (error) {
      logger.warn(SCOPE, 'Could not save sound awareness settings', error);
    }
  };

  const refreshEvents = async () => {
    const repos = await resolveRepositories();
    try {
      const events = await repos.events.list(HISTORY_LIMIT);
      set({ events });
    } catch (error) {
      logger.warn(SCOPE, 'Could not read sound event history', error);
    }
  };

  const startEngine = async () => {
    const current = resolveEngine();
    try {
      await current.start();
      set({ status: 'listening', statusMessage: null });
    } catch (error) {
      logger.warn(SCOPE, 'Sound engine failed to start', error);
      set({
        status: 'error',
        statusMessage: 'Sound listening could not be started on this device.',
      });
      await persist({ ...get().settings, masterEnabled: false });
    }
  };

  const stopEngine = async () => {
    try {
      await resolveEngine().stop();
    } catch (error) {
      logger.warn(SCOPE, 'Sound engine failed to stop', error);
    }
    if (get().status === 'listening') {
      set({ status: 'ready' });
    }
  };

  /** Records the detection and, outside quiet hours, fires the configured alert. */
  const handleDetection = async (event: SoundEvent) => {
    const { settings } = get();
    const config = settings.sounds[event.soundType];
    if (!settings.masterEnabled || !config?.enabled) {
      return;
    }
    if (event.confidence < confidenceThreshold(settings.sensitivity)) {
      return;
    }
    const now = Date.now();
    const last = lastAlertAt.get(event.soundType) ?? 0;
    if (now - last < ALERT_COOLDOWN_MS) {
      return;
    }
    lastAlertAt.set(event.soundType, now);

    const record: SoundEventRecord = {
      id: createId('snd'),
      soundType: event.soundType,
      label: event.label,
      confidence: event.confidence,
      detectedAt: now,
    };
    try {
      const repos = await resolveRepositories();
      await repos.events.record(record);
    } catch (error) {
      logger.warn(SCOPE, 'Could not record a sound event', error);
    }
    set({ events: [record, ...get().events].slice(0, HISTORY_LIMIT) });

    const quiet =
      settings.quietHoursEnabled && isQuietHour(settings, minuteOfDay(now));
    if (quiet) {
      // Quiet hours silence the alert, not the history: the event is still recorded above so the
      // user can see what happened overnight.
      return;
    }
    fireAlert(record, config);
  };

  const fireAlert = (record: SoundEventRecord, config: SoundTypeAlert) => {
    vibrate(vibrationPatternMs(config.vibrationPattern));
    const definition = getSoundType(record.soundType);
    set({
      activeAlert: {
        id: record.id,
        soundType: record.soundType,
        label: definition.label,
        detectorLabel: record.label,
        confidence: record.confidence,
        detectedAt: record.detectedAt,
        alertStyle: config.alertStyle,
      },
    });
  };

  const armDetection = () => {
    if (detectionArmed) {
      return;
    }
    detectionArmed = true;
    resolveEngine().onDetection((event) => {
      void handleDetection(event);
    });
  };

  return {
    status: 'idle',
    statusMessage: null,
    availability: 'unknown',
    permission: 'unknown',
    settings: normalizeSoundSettings(null),
    events: [],
    activeAlert: null,

    bootstrap: async () => {
      set({ status: 'loading' });
      armDetection();
      const repos = await resolveRepositories();
      const loadedSettings = await repos.settings.load();
      const settings = normalizeSoundSettings(loadedSettings);
      set({ settings });
      await refreshEvents();

      const bridge = new SwarSoundBridge();
      const [available, granted] = await Promise.all([
        resolveEngine().isAvailable(),
        bridge.isMicrophonePermissionGranted(),
      ]);
      set({
        availability: available ? 'available' : 'unavailable',
        permission: granted ? 'granted' : 'denied',
      });
      if (!available) {
        set({ status: 'unavailable', statusMessage: null });
        return;
      }
      if (settings.masterEnabled && granted) {
        await startEngine();
      } else {
        // masterEnabled with a revoked permission stays honest: ready + denied, switch off in
        // practice because setMasterEnabled is the only path that turns it on.
        set({ status: 'ready' });
      }
    },

    refreshPermission: async () => {
      if (!SwarSoundBridge.isNativeModulePresent()) {
        set({ permission: 'unknown' });
        return;
      }
      const granted = await new SwarSoundBridge().isMicrophonePermissionGranted();
      set({ permission: granted ? 'granted' : 'denied' });
    },

    setMasterEnabled: async (enabled) => {
      if (enabled) {
        let granted = get().permission === 'granted';
        if (!granted && SwarSoundBridge.isNativeModulePresent()) {
          granted = await new SwarSoundBridge().requestMicrophonePermission();
          set({ permission: granted ? 'granted' : 'denied' });
        }
        if (!granted) {
          // Listening cannot start without the microphone; keep the switch off and let the UI
          // show the permission hint instead of a switch that lies.
          await persist({ ...get().settings, masterEnabled: false });
          return;
        }
        await persist({ ...get().settings, masterEnabled: true });
        await startEngine();
        return;
      }
      await persist({ ...get().settings, masterEnabled: false });
      await stopEngine();
    },

    updateSoundAlert: async (soundType, patch) => {
      const sounds = { ...get().settings.sounds };
      sounds[soundType] = { ...sounds[soundType], ...patch };
      await persist({ ...get().settings, sounds });
    },

    setSensitivity: async (sensitivity) => {
      await persist({ ...get().settings, sensitivity });
    },

    setScreenFlash: async (screenFlash) => {
      await persist({ ...get().settings, screenFlash });
    },

    setQuietHours: async (quiet) => {
      await persist({
        ...get().settings,
        quietHoursEnabled: quiet.enabled,
        quietStartMinute: quiet.startMinute,
        quietEndMinute: quiet.endMinute,
      });
    },

    testAlert: (soundType) => {
      const config = get().settings.sounds[soundType];
      if (!config) {
        return;
      }
      vibrate(vibrationPatternMs(config.vibrationPattern));
      const definition = getSoundType(soundType);
      const now = Date.now();
      set({
        activeAlert: {
          id: createId('sndtest'),
          soundType,
          label: definition.label,
          detectorLabel: 'Test alert',
          confidence: 1,
          detectedAt: now,
          alertStyle: config.alertStyle,
        },
      });
    },

    dismissAlert: () => {
      set({ activeAlert: null });
    },

    clearHistory: async () => {
      const repos = await resolveRepositories();
      try {
        await repos.events.clear();
      } catch (error) {
        logger.warn(SCOPE, 'Could not clear sound event history', error);
      }
      set({ events: [] });
    },
  };
});

// region Test seams

/**
 * Replaces the engine, repositories and vibration sink for unit tests. Passing `null` for a
 * field restores the production default on the next use.
 */
export function setSoundAwarenessTestDoubles(doubles: {
  engine?: SoundDetectionEngine | null;
  settingsRepository?: SoundSettingsRepository | null;
  eventsRepository?: SoundEventRepository | null;
  vibrate?: ((pattern: number[]) => void) | null;
}): void {
  if ('engine' in doubles) engineOverride = doubles.engine ?? null;
  if ('settingsRepository' in doubles) {
    settingsRepositoryOverride = doubles.settingsRepository ?? null;
  }
  if ('eventsRepository' in doubles) {
    eventsRepositoryOverride = doubles.eventsRepository ?? null;
  }
  if ('vibrate' in doubles) vibrateOverride = doubles.vibrate ?? null;
}

/** Resets every module-level singleton so tests start from a clean slate. */
export function resetSoundAwarenessForTesting(): void {
  engine = null;
  settingsRepository = null;
  eventsRepository = null;
  detectionArmed = false;
  lastAlertAt.clear();
  engineOverride = null;
  settingsRepositoryOverride = null;
  eventsRepositoryOverride = null;
  vibrateOverride = null;
  useSoundAwareness.setState({
    status: 'idle',
    statusMessage: null,
    availability: 'unknown',
    permission: 'unknown',
    settings: normalizeSoundSettings(null),
    events: [],
    activeAlert: null,
  });
}
// endregion
