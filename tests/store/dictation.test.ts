import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  setSpeechRecognitionForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
  type DictationState,
} from '../../src/store/appStore';
import {
  DEFAULT_PREFERENCES,
  type RecognitionErrorInfo,
  type SpeechRecognition,
  type SpeechRecognitionCallbacks,
} from '../../src/types';
import { DEFAULT_PROFILE_ID } from '../../src/services/storage/profileScope';

/** A dictation adapter a test can drive by hand, standing in for the native recogniser. */
class FakeRecognition implements SpeechRecognition {
  readonly id = 'fake';
  readonly displayName = 'Fake dictation';

  available = true;
  languageAnswer: boolean | null = true;
  startCalls: { language: string }[] = [];
  stopCalls = 0;
  cancelCalls = 0;

  private callbacks: SpeechRecognitionCallbacks | null = null;

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async isLanguageAvailable(): Promise<boolean | null> {
    return this.languageAnswer;
  }

  async start(languageTag: string, callbacks: SpeechRecognitionCallbacks): Promise<void> {
    this.startCalls.push({ language: languageTag });
    this.callbacks = callbacks;
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
  }

  async cancel(): Promise<void> {
    this.cancelCalls += 1;
    this.callbacks = null;
  }

  async dispose(): Promise<void> {
    this.callbacks = null;
  }

  /** Test helper: pretend the recogniser heard something interim. */
  hearPartial(text: string): void {
    this.callbacks?.onPartial?.(text);
  }

  /** Test helper: pretend the recogniser settled on a final wording. */
  hearFinal(text: string): void {
    this.callbacks?.onFinal?.(text);
  }

  /** Test helper: pretend the session failed. */
  fail(error: RecognitionErrorInfo): void {
    this.callbacks?.onError?.(error);
  }

  /** Test helper: pretend the native session ended. */
  end(): void {
    this.callbacks?.onEnd?.();
  }
}

function dictation(): DictationState {
  return useAppStore.getState().dictation;
}

function setAvailability(availability: DictationState['availability']): void {
  useAppStore.setState({ dictation: { ...dictation(), availability } });
}

describe('store dictation', () => {
  let recognition: FakeRecognition;

  beforeEach(() => {
    recognition = new FakeRecognition();
    setSpeechRecognitionForTesting(recognition);
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), new InMemoryPreferencesRepository());
    useAppStore.setState({
      preferences: { ...DEFAULT_PREFERENCES },
      activeProfileId: DEFAULT_PROFILE_ID,
      composeDraft: null,
      dictation: { availability: 'unknown', active: false, interim: null, error: null },
    });
  });

  afterEach(() => {
    setSpeechRecognitionForTesting(null);
    setStorageRepositoriesForTesting(null, null);
  });

  describe('availability gate', () => {
    it('records the device as available when the adapter can listen', async () => {
      recognition.available = true;
      await useAppStore.getState().refreshDictationAvailability();
      expect(dictation().availability).toBe('available');
    });

    it('records the device as unavailable rather than pretending', async () => {
      recognition.available = false;
      await useAppStore.getState().refreshDictationAvailability();
      expect(dictation().availability).toBe('unavailable');
    });

    it('refuses to start on a device that cannot listen offline', async () => {
      setAvailability('unavailable');
      await useAppStore.getState().startDictation();

      expect(recognition.startCalls).toHaveLength(0);
      expect(dictation().active).toBe(false);
      expect(dictation().error?.code).toBe('RECOGNITION_UNAVAILABLE');
    });

    it('refuses a language the phone has no offline model for', async () => {
      setAvailability('available');
      recognition.languageAnswer = false;
      useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, language: 'ml-IN' } });

      await useAppStore.getState().startDictation();

      expect(recognition.startCalls).toHaveLength(0);
      expect(dictation().error?.code).toBe('LANGUAGE_UNAVAILABLE');
    });

    it('starts in the active profile language when the phone cannot tell us', async () => {
      setAvailability('available');
      recognition.languageAnswer = null;
      useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, language: 'ta-IN' } });

      await useAppStore.getState().startDictation();

      expect(recognition.startCalls).toEqual([{ language: 'ta-IN' }]);
      expect(dictation().active).toBe(true);
    });
  });

  describe('partial and final results', () => {
    beforeEach(() => {
      setAvailability('available');
    });

    it('shows interim wording live without committing it to the draft', async () => {
      await useAppStore.getState().startDictation();
      recognition.hearPartial('hel');

      expect(dictation().interim).toBe('hel');
      expect(useAppStore.getState().composeDraft).toBeNull();
    });

    it('commits the final wording as a dictation segment in the active language', async () => {
      useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, language: 'ml-IN' } });
      await useAppStore.getState().startDictation();
      recognition.hearPartial('ജലം');
      recognition.hearFinal('ജലം വേണം');

      const draft = useAppStore.getState().composeDraft;
      expect(draft?.segments).toHaveLength(1);
      expect(draft?.segments[0].text).toBe('ജലം വേണം');
      expect(draft?.segments[0].origin.kind).toBe('dictation');
      expect(draft?.segments[0].language).toBe('ml');
      expect(draft?.segments[0].script).toBe('Mlym');
      expect(draft?.meta.source).toBe('compose');
      expect(draft?.meta.profileId).toBe(DEFAULT_PROFILE_ID);

      // The session is over and the interim line is gone.
      expect(dictation().active).toBe(false);
      expect(dictation().interim).toBeNull();
      expect(dictation().error).toBeNull();
    });

    it('keeps the active profile language for romanised words but detects their script', async () => {
      useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, language: 'ml-IN' } });
      await useAppStore.getState().startDictation();
      recognition.hearFinal('vello vennam');

      const segment = useAppStore.getState().composeDraft?.segments[0];
      // Manglish stays Malayalam-in-Latin-script rather than being spoken as English.
      expect(segment?.language).toBe('ml');
      expect(segment?.script).toBe('Latn');
    });

    it('appends to an existing draft without losing earlier parts', async () => {
      useAppStore.getState().appendComposeText('Hello');
      await useAppStore.getState().startDictation();
      recognition.hearFinal('world');

      const draft = useAppStore.getState().composeDraft;
      expect(draft?.segments.map((segment) => segment.text)).toEqual(['Hello', 'world']);
      expect(draft?.segments[1].origin.kind).toBe('dictation');
    });

    it('ignores a late partial after the session has finished', async () => {
      await useAppStore.getState().startDictation();
      recognition.hearFinal('done');
      recognition.hearPartial('late');

      expect(dictation().interim).toBeNull();
      expect(useAppStore.getState().composeDraft?.segments).toHaveLength(1);
    });

    it('surfaces a failure and stops listening', async () => {
      await useAppStore.getState().startDictation();
      recognition.fail({ code: 'NO_MATCH', message: 'Nothing heard' });

      expect(dictation().active).toBe(false);
      expect(dictation().interim).toBeNull();
      expect(dictation().error?.code).toBe('NO_MATCH');
      expect(useAppStore.getState().composeDraft).toBeNull();
    });

    it('clears the session on end without inventing a final result', async () => {
      await useAppStore.getState().startDictation();
      recognition.end();

      expect(dictation().active).toBe(false);
      expect(dictation().interim).toBeNull();
      expect(useAppStore.getState().composeDraft).toBeNull();
    });
  });

  describe('stop and cancel', () => {
    beforeEach(() => {
      setAvailability('available');
    });

    it('stop keeps whatever was heard and asks the recogniser to finish', async () => {
      await useAppStore.getState().startDictation();
      await useAppStore.getState().stopDictation();
      expect(recognition.stopCalls).toBe(1);
      // Still listening until the final result arrives.
      expect(dictation().active).toBe(true);

      recognition.hearFinal('kept');
      expect(useAppStore.getState().composeDraft?.segments[0].text).toBe('kept');
    });

    it('cancel commits nothing and clears the interim wording', async () => {
      await useAppStore.getState().startDictation();
      recognition.hearPartial('half');
      await useAppStore.getState().cancelDictation();

      expect(recognition.cancelCalls).toBe(1);
      expect(dictation().active).toBe(false);
      expect(dictation().interim).toBeNull();
      expect(dictation().error).toBeNull();
      expect(useAppStore.getState().composeDraft).toBeNull();
    });

    it('cancelling when idle is safe and leaves no error behind', async () => {
      await useAppStore.getState().cancelDictation();
      expect(dictation().active).toBe(false);
      expect(dictation().error).toBeNull();
    });

    it('a background cancel discards a session in flight', async () => {
      await useAppStore.getState().startDictation();
      recognition.hearPartial('half');
      // Leaving the foreground has the same rule as speech: the session ends.
      await useAppStore.getState().cancelDictation();

      expect(recognition.cancelCalls).toBe(1);
      expect(dictation().active).toBe(false);
      expect(dictation().interim).toBeNull();
    });
  });
});
