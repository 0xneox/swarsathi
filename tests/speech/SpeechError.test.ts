import {
  createSpeechError,
  isSpeechError,
  mapNativeError,
  toSpeechErrorInfo,
} from '../../src/services/speech/SpeechError';

describe('mapNativeError', () => {
  it('maps a known Kotlin error code to a user-facing code and hint', () => {
    const error = mapNativeError({
      code: 'ERR_SWAR_TTS_LANGUAGE_UNAVAILABLE',
      message: 'Language unavailable',
    });

    expect(error.code).toBe('LANGUAGE_UNAVAILABLE');
    expect(error.hint).toMatch(/Install voice data/i);
    expect(error.detail).toBe('ERR_SWAR_TTS_LANGUAGE_UNAVAILABLE');
  });

  it('falls back to UNKNOWN for a code it does not recognise', () => {
    const error = mapNativeError({ code: 'ERR_SOMETHING_NEW', message: 'Unexpected' });

    expect(error.code).toBe('UNKNOWN');
    expect(error.hint).toBeTruthy();
  });

  it('handles a plain string being thrown', () => {
    expect(mapNativeError('boom').message).toBe('boom');
  });

  it('handles a null being thrown', () => {
    expect(mapNativeError(null).code).toBe('UNKNOWN');
  });
});

describe('toSpeechErrorInfo', () => {
  it('returns the info of a SpeechError unchanged', () => {
    const error = createSpeechError('VOICE_UNAVAILABLE', 'No voice', 'Pick another voice');

    expect(toSpeechErrorInfo(error)).toEqual({
      code: 'VOICE_UNAVAILABLE',
      message: 'No voice',
      hint: 'Pick another voice',
      detail: undefined,
    });
  });

  it('normalises an arbitrary thrown value', () => {
    const info = toSpeechErrorInfo(new Error('Something odd'));

    expect(info.code).toBe('UNKNOWN');
    expect(info.message).toBe('Something odd');
  });
});

describe('isSpeechError', () => {
  it('recognises speech errors and rejects other values', () => {
    expect(isSpeechError(createSpeechError('SPEAK_FAILED', 'x'))).toBe(true);
    expect(isSpeechError(new Error('x'))).toBe(false);
    expect(isSpeechError('x')).toBe(false);
  });
});
