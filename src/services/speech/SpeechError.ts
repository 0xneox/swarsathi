import type { SpeechErrorCode, SpeechErrorInfo } from '../../types';

/**
 * A speech failure that is safe to show to the user.
 *
 * Every engine failure is funnelled through this type so the UI never has to interpret raw native
 * error strings, and so a missing voice can never crash the app.
 */
export class SpeechError extends Error implements SpeechErrorInfo {
  readonly code: SpeechErrorCode;
  readonly hint?: string;
  readonly detail?: string;

  constructor(info: SpeechErrorInfo) {
    super(info.message);
    this.name = 'SpeechError';
    this.code = info.code;
    this.hint = info.hint;
    this.detail = info.detail;
    // Required so `instanceof` keeps working after TypeScript down-levelling.
    Object.setPrototypeOf(this, SpeechError.prototype);
  }

  toInfo(): SpeechErrorInfo {
    return {
      code: this.code,
      message: this.message,
      hint: this.hint,
      detail: this.detail,
    };
  }
}

export function isSpeechError(value: unknown): value is SpeechError {
  return value instanceof SpeechError;
}

export function createSpeechError(
  code: SpeechErrorCode,
  message: string,
  hint?: string,
  detail?: string
): SpeechError {
  return new SpeechError({ code, message, hint, detail });
}

/** Error codes raised by the Kotlin module, mapped to user-facing guidance. */
const NATIVE_ERROR_MAP: Record<string, { code: SpeechErrorCode; hint?: string }> = {
  ERR_SWAR_TTS_UNAVAILABLE: {
    code: 'ENGINE_UNAVAILABLE',
    hint: 'Turn on a text-to-speech engine in Android Settings, then Accessibility, then Text-to-speech output.',
  },
  ERR_SWAR_TTS_NOT_INITIALIZED: {
    code: 'ENGINE_NOT_INITIALIZED',
    hint: 'Wait a moment for the speech engine to finish starting, then try again.',
  },
  ERR_SWAR_TTS_LANGUAGE_UNAVAILABLE: {
    code: 'LANGUAGE_UNAVAILABLE',
    hint: 'Download this language in Android Settings, then Accessibility, then Text-to-speech output, then Install voice data.',
  },
  ERR_SWAR_TTS_VOICE_UNAVAILABLE: {
    code: 'VOICE_UNAVAILABLE',
    hint: 'Choose a different voice in SwarSathi Settings.',
  },
  ERR_SWAR_TTS_INVALID_REQUEST: {
    code: 'INVALID_REQUEST',
    hint: 'Type a message before pressing Speak.',
  },
  ERR_SWAR_TTS_SPEAK_FAILED: {
    code: 'SPEAK_FAILED',
    hint: 'Try again, or pick a different voice in Settings.',
  },
};

function readNativeCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const candidate = (error as { code?: unknown }).code;
  return typeof candidate === 'string' ? candidate : undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'The speech engine reported an unknown error.';
}

/** Converts anything thrown by the native bridge into a `SpeechError`. */
export function mapNativeError(error: unknown): SpeechError {
  const nativeCode = readNativeCode(error);
  const message = readMessage(error);
  const mapped = nativeCode ? NATIVE_ERROR_MAP[nativeCode] : undefined;

  if (mapped) {
    return new SpeechError({
      code: mapped.code,
      message,
      hint: mapped.hint,
      detail: nativeCode,
    });
  }

  return new SpeechError({
    code: 'UNKNOWN',
    message,
    hint: 'Close and reopen SwarSathi, then try again.',
    detail: nativeCode ?? (error instanceof Error ? error.name : undefined),
  });
}

/** Normalises any thrown value into a plain, serialisable description for the store. */
export function toSpeechErrorInfo(error: unknown): SpeechErrorInfo {
  if (isSpeechError(error)) {
    return error.toInfo();
  }
  return mapNativeError(error).toInfo();
}
