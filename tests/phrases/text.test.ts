import { countCharacters, isBlankMessage, normalizeForSpeech } from '../../src/utils/text';

describe('normalizeForSpeech', () => {
  it('collapses whitespace runs into single spaces', () => {
    expect(normalizeForSpeech('I   need\n\nwater')).toBe('I need water');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeForSpeech('   hello   ')).toBe('hello');
  });

  it('never changes words or punctuation', () => {
    const original = 'എനിക്ക് വെള്ളം വേണം! ദയവായി.';
    expect(normalizeForSpeech(original)).toBe(original);
  });

  it('treats non-breaking and tab whitespace as whitespace', () => {
    expect(normalizeForSpeech('a\tb\u00a0c')).toBe('a b c');
  });
});

describe('isBlankMessage', () => {
  it('is true for whitespace only input', () => {
    expect(isBlankMessage('   \n\t ')).toBe(true);
  });

  it('is false for any real content', () => {
    expect(isBlankMessage('അ')).toBe(false);
    expect(isBlankMessage('a')).toBe(false);
  });
});

describe('countCharacters', () => {
  it('counts exactly what the user typed, including spaces', () => {
    expect(countCharacters('hello world')).toBe(11);
    expect(countCharacters('')).toBe(0);
  });
});
