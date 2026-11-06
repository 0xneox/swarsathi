import type { Language } from '../types';

/**
 * Language registry.
 *
 * The list is data-driven: the home screen never hardcodes which languages work. It asks the
 * installed Android speech engine what it supports and matches the answer against these entries.
 *
 * `verifiedOnDevice` is intentionally `false` for every language until a human has listened to real
 * speech on a real phone. Until then the UI states plainly that on-device verification is pending
 * rather than claiming a language "works".
 */
export const LANGUAGES: Language[] = [
  {
    code: 'en-IN',
    englishName: 'English (India)',
    nativeName: 'English',
    verifiedOnDevice: false,
  },
  {
    code: 'ml-IN',
    englishName: 'Malayalam',
    nativeName: 'മലയാളം',
    verifiedOnDevice: false,
  },
  {
    code: 'hi-IN',
    englishName: 'Hindi',
    nativeName: 'हिन्दी',
    verifiedOnDevice: false,
  },
  {
    code: 'ta-IN',
    englishName: 'Tamil',
    nativeName: 'தமிழ்',
    verifiedOnDevice: false,
  },
  {
    code: 'te-IN',
    englishName: 'Telugu',
    nativeName: 'తెలుగు',
    verifiedOnDevice: false,
  },
  {
    code: 'kn-IN',
    englishName: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    verifiedOnDevice: false,
  },
];

const LANGUAGE_BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]));

/** The language SwarSathi falls back to when nothing is stored or detected. */
export const FALLBACK_LANGUAGE_CODE = 'en-IN';

export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGE_BY_CODE.get(code);
}

/**
 * Resolves a BCP-47 tag reported by the speech engine (which may be `ml`, `ml_IN` or `ml-IN`)
 * back to a registry entry, without inventing languages we do not ship.
 */
export function findLanguageForTag(tag: string): Language | undefined {
  const normalized = tag.replace(/_/g, '-').toLowerCase();
  const exact = LANGUAGE_BY_CODE.get(tag);
  if (exact) {
    return exact;
  }

  const direct = LANGUAGES.find((language) => language.code.toLowerCase() === normalized);
  if (direct) {
    return direct;
  }

  // Only match on the primary subtag when the registry entry has no region-specific rival.
  const primary = normalized.split('-')[0];
  const candidates = LANGUAGES.filter(
    (language) => language.code.toLowerCase().split('-')[0] === primary
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** Formats a language for display: `Malayalam (മലയാളം)`. */
export function formatLanguageLabel(language: Language): string {
  // Skip the native name when it adds nothing: "English (India) (English)" helps nobody.
  if (language.nativeName === language.englishName || language.englishName.includes(language.nativeName)) {
    return language.englishName;
  }
  return `${language.englishName} (${language.nativeName})`;
}
