import type { SpeechOptions } from '../../src/types';

/**
 * Tests for the "share as audio" pipeline.
 *
 * The Android engine and the filesystem are mocked so the interesting behaviour — one utterance
 * per segment language, joined into a single playable file, with real failure reasons — can be
 * asserted without a device.
 */

let mockEngineAvailable = true;
let mockSynthesizeError: unknown = null;
let mockSharingAvailable = true;
let mockShareActionResult: { action: string } = { action: 'sharedAction' };
const mockSynthesizeCalls: Array<{ text: string; options: SpeechOptions; fileName: string }> = [];
const mockShareAsyncCalls: Array<{ path: string; options: unknown }> = [];
const mockFileContents = new Map<string, Uint8Array>();
const mockWrittenFiles = new Map<string, Uint8Array>();
let mockAudioForText: (text: string) => Uint8Array = () => new Uint8Array();

jest.mock('react-native', () => ({
  Share: {
    dismissedAction: 'dismissedAction',
    share: async () => mockShareActionResult,
  },
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;

    constructor(...parts: Array<string | { uri: string }>) {
      const segments = parts.map((part) => (typeof part === 'string' ? part : part.uri));
      const [first, ...rest] = segments;
      this.uri =
        rest.length === 0
          ? first
          : `${first.replace(/\/+$/, '')}/${rest.map((segment) => segment.replace(/^\/+/, '')).join('/')}`;
    }

    get exists(): boolean {
      return mockFileContents.has(this.uri);
    }

    async bytes(): Promise<Uint8Array> {
      return mockFileContents.get(this.uri) ?? new Uint8Array();
    }

    create(): void {
      // Nothing to do: the mock filesystem creates paths lazily on write.
    }

    async write(content: Uint8Array): Promise<void> {
      mockWrittenFiles.set(this.uri, content);
    }
  }

  return { File: MockFile, Paths: { cache: { uri: 'file:///cache' } } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => mockSharingAvailable,
  shareAsync: async (path: string, options: unknown) => {
    mockShareAsyncCalls.push({ path, options });
  },
}));

jest.mock('../../src/services/speech/AndroidTTSBridge', () => ({
  AndroidTTSBridge: class {
    static isAvailable(): boolean {
      return mockEngineAvailable;
    }

    async initialize(): Promise<void> {
      // The engine is ready as soon as the mock says it is available.
    }

    async synthesizeToFile(text: string, options: SpeechOptions, fileName: string): Promise<string> {
      mockSynthesizeCalls.push({ text, options, fileName });
      if (mockSynthesizeError) {
        throw mockSynthesizeError;
      }
      const path = `file:///cache/${fileName}`;
      mockFileContents.set(path, mockAudioForText(text));
      return path;
    }
  },
}));

import { shareAudioPlan, shareText } from '../../src/services/share/share';
import { createSpeechError } from '../../src/services/speech/SpeechError';

function entry(text: string, language: string): { text: string; options: SpeechOptions } {
  return { text, options: { language, rate: 1, pitch: 1 } };
}

/** A minimal but structurally valid RIFF/WAVE file with the given payload bytes. */
function wavFile(payload: number[]): Uint8Array {
  const dataLength = payload.length;
  const bytes = new Uint8Array(44 + dataLength);
  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      bytes[offset + index] = text.charCodeAt(index);
    }
  };
  const uint32 = (offset: number, value: number) => {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
  };
  ascii(0, 'RIFF');
  uint32(4, 36 + dataLength);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  uint32(16, 16);
  ascii(36, 'data');
  uint32(40, dataLength);
  bytes.set(Uint8Array.from(payload), 44);
  return bytes;
}

function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>>
    0
  );
}

beforeEach(() => {
  mockEngineAvailable = true;
  mockSynthesizeError = null;
  mockSharingAvailable = true;
  mockShareActionResult = { action: 'sharedAction' };
  mockSynthesizeCalls.length = 0;
  mockShareAsyncCalls.length = 0;
  mockFileContents.clear();
  mockWrittenFiles.clear();
  mockAudioForText = () => new Uint8Array();
});

describe('shareAudioPlan', () => {
  it('renders each entry in its own language and joins them into one file', async () => {
    mockAudioForText = (text) => (text === 'എനിക്ക്' ? wavFile([1, 1, 1, 1]) : wavFile([2, 2, 2, 2, 2, 2]));

    const result = await shareAudioPlan([entry('എനിക്ക്', 'ml-IN'), entry('water', 'en-IN')]);

    expect(result).toEqual({ ok: true });
    expect(mockSynthesizeCalls.map((call) => call.options.language)).toEqual(['ml-IN', 'en-IN']);
    expect(mockSynthesizeCalls.map((call) => call.text)).toEqual(['എനിക്ക്', 'water']);

    expect(mockShareAsyncCalls).toHaveLength(1);
    const shared = mockShareAsyncCalls[0].path;
    const rendered = mockSynthesizeCalls.map((call) => `file:///cache/${call.fileName}`);
    expect(rendered).not.toContain(shared);

    const combined = mockWrittenFiles.get(shared);
    expect(combined).toBeDefined();
    expect(readTag(combined as Uint8Array, 0)).toBe('RIFF');
    expect(readTag(combined as Uint8Array, 8)).toBe('WAVE');
    // 44-byte header plus both payloads, with both size fields corrected.
    expect((combined as Uint8Array).length).toBe(54);
    expect(readUint32(combined as Uint8Array, 4)).toBe(46);
    expect(readUint32(combined as Uint8Array, 40)).toBe(10);
  });

  it('shares a single utterance without joining it', async () => {
    mockAudioForText = () => wavFile([9, 9, 9]);

    const result = await shareAudioPlan([entry('hello', 'en-IN')]);

    expect(result).toEqual({ ok: true });
    expect(mockShareAsyncCalls).toHaveLength(1);
    expect(mockShareAsyncCalls[0].path).toBe(`file:///cache/${mockSynthesizeCalls[0].fileName}`);
    expect(mockWrittenFiles.size).toBe(0);
  });

  it('reports the real reason when the engine is not in this build', async () => {
    mockEngineAvailable = false;

    const result = await shareAudioPlan([entry('hello', 'en-IN')]);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain('speech engine');
  });

  it('reports when the device has nowhere to share files', async () => {
    mockSharingAvailable = false;

    const result = await shareAudioPlan([entry('hello', 'en-IN')]);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toBe('This device has nowhere to share files.');
  });

  it('surfaces what the engine actually said when a language is unavailable', async () => {
    mockSynthesizeError = createSpeechError(
      'LANGUAGE_UNAVAILABLE',
      'No installed voice supports the language "ml-IN".',
      'Install the voice data from Android Settings.'
    );

    const result = await shareAudioPlan([entry('എനിക്ക്', 'ml-IN')]);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain('No installed voice supports the language "ml-IN".');
    expect(result.ok ? '' : result.reason).toContain('Install the voice data');
  });

  it('refuses to pretend when rendered audio cannot be joined', async () => {
    mockAudioForText = (text) => (text === 'എനിക്ക്' ? wavFile([1, 1]) : Uint8Array.from([0, 1, 2, 3]));

    const result = await shareAudioPlan([entry('എനിക്ക്', 'ml-IN'), entry('water', 'en-IN')]);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain('could not join');
    expect(mockShareAsyncCalls).toHaveLength(0);
  });

  it('reports nothing to share when every entry is blank', async () => {
    const result = await shareAudioPlan([entry('   ', 'en-IN')]);

    expect(result.ok).toBe(false);
    expect(mockSynthesizeCalls).toHaveLength(0);
  });
});

describe('shareText', () => {
  it('confirms a completed share', async () => {
    const result = await shareText('hello');

    expect(result).toEqual({ ok: true });
  });

  it('reports a dismissed sheet as a reason rather than a failure string', async () => {
    mockShareActionResult = { action: 'dismissedAction' };

    const result = await shareText('hello');

    expect(result).toEqual({ ok: false, reason: 'dismissed' });
  });
});
