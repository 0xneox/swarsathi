import {
  resetSoundAwarenessForTesting,
  setSoundAwarenessTestDoubles,
  useSoundAwareness,
} from '../../src/store/soundAwareness';
import type { SoundDetectionEngine, SoundEvent } from '../../src/services/sounds/engine';
import { DEFAULT_SOUND_SETTINGS } from '../../src/services/sounds/settings';
import { InMemorySoundEventRepository } from '../../src/services/storage/soundEvents';
import { InMemorySoundSettingsRepository as MemorySettings } from '../../src/services/storage/soundSettings';

/** Lets the async detection handler run to completion. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

class FakeEngine implements SoundDetectionEngine {
  readonly id = 'fake';
  readonly displayName = 'Fake engine';
  available = true;
  started = false;
  stopped = false;
  private callback: ((event: SoundEvent) => void) | null = null;

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }

  onDetection(callback: (event: SoundEvent) => void): void {
    this.callback = callback;
  }

  emit(event: SoundEvent): void {
    this.callback?.(event);
  }
}

function doorbellEvent(overrides: Partial<SoundEvent> = {}): SoundEvent {
  return {
    soundType: 'doorbell',
    label: 'Doorbell',
    confidence: 0.8,
    detectedAt: Date.now(),
    ...overrides,
  };
}

function settingsWithMasterOn() {
  return {
    ...DEFAULT_SOUND_SETTINGS,
    masterEnabled: true,
    sounds: {
      ...DEFAULT_SOUND_SETTINGS.sounds,
      doorbell: { enabled: true, alertStyle: 'banner' as const, vibrationPattern: 'double' as const },
    },
  };
}

describe('sound awareness store', () => {
  let engine: FakeEngine;
  let vibrate: jest.Mock;
  let settingsRepo: MemorySettings;
  let eventsRepo: InMemorySoundEventRepository;

  beforeEach(() => {
    engine = new FakeEngine();
    vibrate = jest.fn();
    settingsRepo = new MemorySettings();
    eventsRepo = new InMemorySoundEventRepository();
    resetSoundAwarenessForTesting();
    setSoundAwarenessTestDoubles({
      engine,
      settingsRepository: settingsRepo,
      eventsRepository: eventsRepo,
      vibrate,
    });
  });

  afterEach(() => {
    resetSoundAwarenessForTesting();
  });

  it('bootstraps to ready with the microphone reported denied when the native module is absent', async () => {
    await useSoundAwareness.getState().bootstrap();
    const state = useSoundAwareness.getState();
    expect(state.status).toBe('ready');
    // The native module is absent in tests, so the permission probe reports false -> 'denied'.
    expect(state.permission).toBe('denied');
    expect(state.availability).toBe('available'); // fake engine says it can classify
    expect(state.settings.masterEnabled).toBe(false);
  });

  it('reports unavailable when the engine cannot classify', async () => {
    engine.available = false;
    await useSoundAwareness.getState().bootstrap();
    expect(useSoundAwareness.getState().status).toBe('unavailable');
  });

  it('records a detection and fires the configured alert', async () => {
    await settingsRepo.save(settingsWithMasterOn());
    await useSoundAwareness.getState().bootstrap();

    engine.emit(doorbellEvent());
    await flush();

    const state = useSoundAwareness.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0].soundType).toBe('doorbell');
    expect(state.activeAlert?.soundType).toBe('doorbell');
    expect(state.activeAlert?.alertStyle).toBe('banner');
    expect(vibrate).toHaveBeenCalledWith([0, 250, 200, 250]);
  });

  it('ignores detections while the master switch is off', async () => {
    await settingsRepo.save(settingsWithMasterOn());
    await useSoundAwareness.getState().bootstrap();
    useSoundAwareness.setState({
      settings: { ...useSoundAwareness.getState().settings, masterEnabled: false },
    });
    engine.emit(doorbellEvent());
    await flush();
    expect(useSoundAwareness.getState().events).toHaveLength(0);
    expect(useSoundAwareness.getState().activeAlert).toBeNull();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('drops detections below the sensitivity threshold', async () => {
    await settingsRepo.save({
      ...settingsWithMasterOn(),
      sensitivity: 'high', // threshold 0.2
    });
    await useSoundAwareness.getState().bootstrap();
    engine.emit(doorbellEvent({ confidence: 0.1 }));
    await flush();
    expect(useSoundAwareness.getState().events).toHaveLength(0);
  });

  it('ignores sounds the user disabled', async () => {
    const settings = settingsWithMasterOn();
    settings.sounds.doorbell.enabled = false;
    await settingsRepo.save(settings);
    await useSoundAwareness.getState().bootstrap();
    engine.emit(doorbellEvent());
    await flush();
    expect(useSoundAwareness.getState().events).toHaveLength(0);
  });

  it('suppresses the alert during quiet hours but still records the event', async () => {
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();
    const settings = {
      ...settingsWithMasterOn(),
      quietHoursEnabled: true,
      quietStartMinute: (minute - 60 + 1440) % 1440,
      quietEndMinute: (minute + 60) % 1440,
    };
    await settingsRepo.save(settings);
    await useSoundAwareness.getState().bootstrap();

    engine.emit(doorbellEvent());
    await flush();

    const state = useSoundAwareness.getState();
    expect(state.events).toHaveLength(1);
    expect(state.activeAlert).toBeNull();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('cools down repeated alerts for the same sound type', async () => {
    await settingsRepo.save(settingsWithMasterOn());
    await useSoundAwareness.getState().bootstrap();

    engine.emit(doorbellEvent());
    engine.emit(doorbellEvent());
    await flush();

    const state = useSoundAwareness.getState();
    expect(state.events).toHaveLength(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('testAlert shows an alert without recording history', async () => {
    await useSoundAwareness.getState().bootstrap();
    useSoundAwareness.getState().testAlert('siren');
    const state = useSoundAwareness.getState();
    expect(state.activeAlert?.soundType).toBe('siren');
    expect(state.events).toHaveLength(0);
    expect(vibrate).toHaveBeenCalled();
  });

  it('dismissAlert clears the visible alert', async () => {
    await useSoundAwareness.getState().bootstrap();
    useSoundAwareness.getState().testAlert('knock');
    useSoundAwareness.getState().dismissAlert();
    expect(useSoundAwareness.getState().activeAlert).toBeNull();
  });

  it('persists settings changes through the repository', async () => {
    await useSoundAwareness.getState().bootstrap();
    await useSoundAwareness.getState().updateSoundAlert('alarm', {
      alertStyle: 'fullscreen',
      vibrationPattern: 'urgent',
    });
    const saved = await settingsRepo.load();
    expect(saved.sounds.alarm.alertStyle).toBe('fullscreen');
    expect(saved.sounds.alarm.vibrationPattern).toBe('urgent');
  });

  it('clearHistory empties the recorded events', async () => {
    await settingsRepo.save(settingsWithMasterOn());
    await useSoundAwareness.getState().bootstrap();
    engine.emit(doorbellEvent());
    await flush();
    await useSoundAwareness.getState().clearHistory();
    expect(useSoundAwareness.getState().events).toHaveLength(0);
    await expect(eventsRepo.list()).resolves.toHaveLength(0);
  });
});
