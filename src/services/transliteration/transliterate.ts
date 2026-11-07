import { BRAHMIC_SCRIPTS } from './scripts/brahmic';
import { PERSO_ARABIC_SCRIPT } from './scripts/persoArabic';
import type { BrahmicScriptDefinition, SupportedTransliterationScript } from './types';

const BRAHMIC_VOWELS = [
  'aa',
  'ii',
  'ee',
  'uu',
  'oo',
  'ai',
  'au',
  'ou',
  'ri',
  'a',
  'i',
  'u',
  'e',
  'o',
];

const BRAHMIC_CONSONANTS = [
  'chh',
  'shh',
  'kh',
  'gh',
  'ng',
  'ch',
  'jh',
  'th',
  'dh',
  'ph',
  'bh',
  'sh',
  'zh',
  'k',
  'g',
  'c',
  'j',
  't',
  'd',
  'n',
  'p',
  'f',
  'b',
  'm',
  'y',
  'r',
  'l',
  'v',
  'w',
  's',
  'h',
  'z',
  'q',
  'T',
  'Th',
  'D',
  'Dh',
  'N',
  'L',
  'R',
  'S',
];

const COMMON_ARABIC_WORDS: Record<string, string> = {
  shukriya: '\u0634\u06A9\u0631\u06CC\u06C1',
  shukria: '\u0634\u06A9\u0631\u06CC\u06C1',
  salaam: '\u0633\u0644\u0627\u0645',
  salam: '\u0633\u0644\u0627\u0645',
  namaste: '\u0646\u0645\u0633\u062A\u06D2',
  aap: '\u0622\u067E',
  theek: '\u0679\u06BE\u06CC\u06A9',
  meherbani: '\u0645\u06C1\u0631\u0628\u0627\u0646\u06CC',
  alvida: '\u0627\u0644\u0648\u062F\u0627\u0639',
};

const LANGUAGE_TO_SCRIPT: Record<string, SupportedTransliterationScript> = {
  hi: 'Deva',
  mr: 'Deva',
  sa: 'Deva',
  ne: 'Deva',
  brx: 'Deva',
  doi: 'Deva',
  mai: 'Deva',
  kok: 'Deva',
  bn: 'Beng',
  as: 'Beng',
  mni: 'Beng',
  ta: 'Taml',
  te: 'Telu',
  kn: 'Knda',
  ml: 'Mlym',
  gu: 'Gujr',
  pa: 'Guru',
  or: 'Orya',
  ur: 'Arab',
  ks: 'Arab',
  sd: 'Arab',
  sat: 'Deva',
};

/**
 * Resolves a script code from a script name or language code (e.g. 'ml-IN' -> 'Mlym', 'hi' -> 'Deva').
 */
export function getScriptForLanguage(
  scriptOrLanguage: string
): SupportedTransliterationScript | null {
  const normalized = scriptOrLanguage.trim();
  const subtag = normalized.split('-')[0].toLowerCase();

  // If already a supported script name
  if (
    normalized === 'Deva' ||
    normalized === 'Beng' ||
    normalized === 'Taml' ||
    normalized === 'Telu' ||
    normalized === 'Knda' ||
    normalized === 'Mlym' ||
    normalized === 'Gujr' ||
    normalized === 'Guru' ||
    normalized === 'Orya' ||
    normalized === 'Arab'
  ) {
    return normalized as SupportedTransliterationScript;
  }

  return LANGUAGE_TO_SCRIPT[subtag] ?? null;
}

export function isTransliterationSupported(scriptOrLanguage: string): boolean {
  return getScriptForLanguage(scriptOrLanguage) !== null;
}

export function getSupportedTransliterationScripts(): SupportedTransliterationScript[] {
  return [
    'Deva',
    'Beng',
    'Taml',
    'Telu',
    'Knda',
    'Mlym',
    'Gujr',
    'Guru',
    'Orya',
    'Arab',
  ];
}

/**
 * Transliterates Roman ASCII text to the requested native script using deterministic rules.
 *
 * Tier 0 transliteration (vision.md §2C): deterministic, zero ML dependencies, zero network fetch.
 * Explicitly imperfect for difficult ambiguous words, but provides immediate native-script input.
 */
export function transliterate(
  text: string,
  targetScriptOrLanguage: SupportedTransliterationScript | string
): string {
  const targetScript = getScriptForLanguage(targetScriptOrLanguage);
  if (!targetScript) {
    return text;
  }

  if (targetScript === 'Arab') {
    return transliteratePersoArabic(text);
  }

  const def = BRAHMIC_SCRIPTS[targetScript];
  if (!def) {
    return text;
  }

  return transliterateBrahmic(text, def);
}

function isAlpha(char: string): boolean {
  return /^[a-zA-Z]$/.test(char);
}

function matchToken(text: string, pos: number, tokens: string[]): string | null {
  for (const token of tokens) {
    const slice = text.slice(pos, pos + token.length);
    if (slice.toLowerCase() === token.toLowerCase()) {
      return token;
    }
  }
  return null;
}

function transliterateBrahmic(text: string, def: BrahmicScriptDefinition): string {
  let output = '';
  let i = 0;
  const n = text.length;
  let atWordStart = true;

  while (i < n) {
    const char = text[i];

    if (!isAlpha(char)) {
      output += char;
      atWordStart = true;
      i += 1;
      continue;
    }

    // 1. If at the start of a word or after an independent vowel, check for independent vowels
    if (atWordStart) {
      const vowel = matchToken(text, i, BRAHMIC_VOWELS);
      if (vowel) {
        const key = vowel.toLowerCase();
        output += def.independentVowels[key] ?? vowel;
        i += vowel.length;
        atWordStart = false;
        continue;
      }
    }

    // 2. Check for consonant token
    const consonant = matchToken(text, i, BRAHMIC_CONSONANTS);
    if (consonant) {
      const cKey = consonant.length === 1 && consonant === consonant.toUpperCase()
        ? consonant
        : consonant.toLowerCase();

      let baseChar = def.consonants[cKey] ?? def.consonants[consonant.toLowerCase()] ?? consonant;

      // Special Tamil medial 'n' -> ண (retroflex nasal)
      if (def.script === 'Taml' && consonant.toLowerCase() === 'n' && !atWordStart) {
        baseChar = '\u0BA3';
      }

      const afterConsonant = i + consonant.length;

      // Check if followed by a vowel
      const nextVowel = matchToken(text, afterConsonant, BRAHMIC_VOWELS);
      if (nextVowel) {
        const vKey = nextVowel.toLowerCase();
        const matra = def.matras[vKey] ?? '';
        output += baseChar + matra;
        i = afterConsonant + nextVowel.length;
        atWordStart = false;
        continue;
      }

      // Not followed by a vowel: check if followed by another letter (consonant)
      if (afterConsonant < n && isAlpha(text[afterConsonant])) {
        output += baseChar + def.virama;
        i = afterConsonant;
        atWordStart = false;
        continue;
      }

      // Followed by non-alpha or end of string
      // In Tamil, word-final consonants take pulli (virama)
      if (def.script === 'Taml') {
        output += baseChar + def.virama;
      } else {
        output += baseChar;
      }
      i = afterConsonant;
      atWordStart = false;
      continue;
    }

    // Standalone vowel inside a word
    const standaloneVowel = matchToken(text, i, BRAHMIC_VOWELS);
    if (standaloneVowel) {
      const vKey = standaloneVowel.toLowerCase();
      output += def.independentVowels[vKey] ?? standaloneVowel;
      i += standaloneVowel.length;
      atWordStart = false;
      continue;
    }

    // Fallback: pass through character
    output += char;
    i += 1;
    atWordStart = false;
  }

  return output;
}

function transliteratePersoArabic(text: string): string {
  let output = '';
  let i = 0;
  const n = text.length;

  const vowels = ['aa', 'ii', 'ee', 'uu', 'oo', 'ai', 'au', 'ou', 'a', 'i', 'u', 'e', 'o'];
  const consonants = [
    'chh',
    'shh',
    'kh',
    'gh',
    'sh',
    'ch',
    'zh',
    'th',
    'bh',
    'ph',
    'dh',
    'jh',
    'k',
    'g',
    'j',
    'b',
    'p',
    't',
    'T',
    's',
    'd',
    'D',
    'r',
    'R',
    'z',
    'f',
    'q',
    'l',
    'm',
    'n',
    'w',
    'v',
    'h',
    'y',
    'c',
  ];

  while (i < n) {
    const char = text[i];

    if (!isAlpha(char)) {
      output += char;
      i += 1;
      continue;
    }

    // Extract word
    let wordEnd = i;
    while (wordEnd < n && isAlpha(text[wordEnd])) {
      wordEnd += 1;
    }
    const word = text.slice(i, wordEnd);
    const lowerWord = word.toLowerCase();

    // Check common words dictionary first
    if (COMMON_ARABIC_WORDS[lowerWord]) {
      output += COMMON_ARABIC_WORDS[lowerWord];
      i = wordEnd;
      continue;
    }

    // Otherwise transliterate character by character
    let wIdx = 0;
    let atWordStart = true;
    while (wIdx < word.length) {
      if (atWordStart) {
        const vowel = matchToken(word, wIdx, vowels);
        if (vowel) {
          const key = vowel.toLowerCase();
          output += PERSO_ARABIC_SCRIPT.initialVowels[key] ?? vowel;
          wIdx += vowel.length;
          atWordStart = false;
          continue;
        }
      }

      const consonant = matchToken(word, wIdx, consonants);
      if (consonant) {
        const cKey = consonant.length === 1 && consonant === consonant.toUpperCase()
          ? consonant
          : consonant.toLowerCase();
        const cChar =
          PERSO_ARABIC_SCRIPT.letters[cKey] ??
          PERSO_ARABIC_SCRIPT.letters[consonant.toLowerCase()] ??
          consonant;
        output += cChar;
        wIdx += consonant.length;
        atWordStart = false;

        // Check if immediately followed by a vowel
        const nextVowel = matchToken(word, wIdx, vowels);
        if (nextVowel) {
          const vKey = nextVowel.toLowerCase();
          const vChar = PERSO_ARABIC_SCRIPT.medialVowels[vKey] ?? '';
          output += vChar;
          wIdx += nextVowel.length;
        }
        continue;
      }

      const medialVowel = matchToken(word, wIdx, vowels);
      if (medialVowel) {
        const vKey = medialVowel.toLowerCase();
        output += PERSO_ARABIC_SCRIPT.medialVowels[vKey] ?? medialVowel;
        wIdx += medialVowel.length;
        atWordStart = false;
        continue;
      }

      output += word[wIdx];
      wIdx += 1;
      atWordStart = false;
    }

    i = wordEnd;
  }

  return output;
}
