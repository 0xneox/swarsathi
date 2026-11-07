import type { RecognitionErrorCode, RecognitionErrorInfo } from '../../../types';

/**
 * A dictation failure that is safe to show to the user.
 *
 * Mirrors `SpeechError`, but for recognition: the UI never has to interpret a raw
 * `SpeechRecognizer.ERROR_*` code or a native exception message.
 */
export class RecognitionError extends Error implements RecognitionErrorInfo {
  readonly code: RecognitionErrorCode;
  readonly hint?: string;
  readonly detail?: string;

  constructor(info: RecognitionErrorInfo) {
    super(info.message);
    this.name = 'RecognitionError';
    this.code = info.code;
    this.hint = info.hint;
    this.detail = info.detail;
    // Required so `instanceof` keeps working after TypeScript down-levelling.
    Object.setPrototypeOf(this, RecognitionError.prototype);
  }

  toInfo(): RecognitionErrorInfo {
    return {
      code: this.code,
      message: this.message,
      hint: this.hint,
      detail: this.detail,
    };
  }
}

/** Concrete next step for the user, keyed by what went wrong. */
const HINTS: Record<RecognitionErrorCode, string | undefined> = {
  RECOGNITION_UNAVAILABLE:
    'This phone cannot listen without internet. Typing and symbols still work as normal.',
  MICROPHONE_PERMISSION_DENIED:
    'Allow microphone access in Android Settings to use dictation, or keep typing.',
  NO_MATCH: 'Try again, a little closer to the microphone.',
  SPEECH_TIMEOUT: 'Try again and start speaking a little sooner.',
  RECOGNIZER_BUSY: 'Wait a moment, then try again.',
  LANGUAGE_UNAVAILABLE:
    'Offline recognition for this language is not installed. Typing and symbols still work.',
  CANCELLED: undefined,
  UNKNOWN: 'Try again; if it keeps happening, use typing or the symbol board instead.',
};

export function createRecognitionError(
  code: RecognitionErrorCode,
  message: string,
  detail?: string
): RecognitionError {
  return new RecognitionError({ code, message, hint: HINTS[code], detail });
}

/**
 * Maps a raw `SpeechRecognizer.ERROR_*` code to our own vocabulary.
 *
 * The numbers are the Android constants; they are written out rather than referenced so this file
 * stays free of a native dependency and can be unit tested on its own.
 */
const ANDROID_ERROR_MAP: Record<number, RecognitionErrorCode> = {
  1: 'SPEECH_TIMEOUT', // ERROR_NETWORK_TIMEOUT
  2: 'UNKNOWN', // ERROR_NETWORK — should never happen: we only ever use the on-device recogniser.
  3: 'UNKNOWN', // ERROR_AUDIO
  4: 'UNKNOWN', // ERROR_SERVER
  5: 'CANCELLED', // ERROR_CLIENT
  6: 'SPEECH_TIMEOUT', // ERROR_SPEECH_TIMEOUT
  7: 'NO_MATCH', // ERROR_NO_MATCH
  8: 'RECOGNIZER_BUSY', // ERROR_RECOGNIZER_BUSY
  9: 'MICROPHONE_PERMISSION_DENIED', // ERROR_INSUFFICIENT_PERMISSIONS
  12: 'LANGUAGE_UNAVAILABLE', // ERROR_LANGUAGE_NOT_SUPPORTED
  13: 'LANGUAGE_UNAVAILABLE', // ERROR_LANGUAGE_UNAVAILABLE
};

/** Turns an Android recognition error code plus its native message into a user-facing error. */
export function recognitionErrorFromAndroidCode(
  errorCode: number,
  message: string
): RecognitionError {
  const code = ANDROID_ERROR_MAP[errorCode] ?? 'UNKNOWN';
  return createRecognitionError(code, message, `android-error-${errorCode}`);
}

/** Error codes our Kotlin module raises. */
const NATIVE_THROW_MAP: Record<string, RecognitionErrorCode> = {
  ERR_SWAR_ASR_UNAVAILABLE: 'RECOGNITION_UNAVAILABLE',
  ERR_SWAR_ASR_START_FAILED: 'UNKNOWN',
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
  return 'Dictation stopped unexpectedly.';
}

/** Converts anything thrown by the native bridge into a `RecognitionError`. */
export function mapNativeRecognitionError(error: unknown): RecognitionError {
  if (error instanceof RecognitionError) {
    return error;
  }
  const nativeCode = readNativeCode(error);
  const message = readMessage(error);
  const code = nativeCode ? NATIVE_THROW_MAP[nativeCode] : undefined;
  return createRecognitionError(code ?? 'UNKNOWN', message, nativeCode);
}

/** Normalises any thrown value into a plain, serialisable description for the store. */
export function toRecognitionErrorInfo(error: unknown): RecognitionErrorInfo {
  if (error instanceof RecognitionError) {
    return error.toInfo();
  }
  return mapNativeRecognitionError(error).toInfo();
}
