import type { Language } from '../types';

/**
 * Language registry.
 *
 * Covers all 22 Eighth Schedule languages of India plus English.
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
    id: 'en-IN',
    englishName: 'English (India)',
    nativeName: 'English',
    autonym: 'English',
    verifiedOnDevice: false,
  },
  {
    code: 'ml-IN',
    id: 'ml-IN',
    englishName: 'Malayalam',
    nativeName: 'മലയാളം',
    autonym: 'മലയാളം',
    verifiedOnDevice: false,
  },
  {
    code: 'hi-IN',
    id: 'hi-IN',
    englishName: 'Hindi',
    nativeName: 'हिन्दी',
    autonym: 'हिन्दी',
    verifiedOnDevice: false,
  },
  {
    code: 'ta-IN',
    id: 'ta-IN',
    englishName: 'Tamil',
    nativeName: 'தமிழ்',
    autonym: 'தமிழ்',
    verifiedOnDevice: false,
  },
  {
    code: 'te-IN',
    id: 'te-IN',
    englishName: 'Telugu',
    nativeName: 'తెలుగు',
    autonym: 'తెలుగు',
    verifiedOnDevice: false,
  },
  {
    code: 'kn-IN',
    id: 'kn-IN',
    englishName: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    autonym: 'ಕನ್ನಡ',
    verifiedOnDevice: false,
  },
  {
    code: 'as-IN',
    id: 'as-IN',
    englishName: 'Assamese',
    nativeName: 'অসমীয়া',
    autonym: 'অসমীয়া',
    verifiedOnDevice: false,
  },
  {
    code: 'bn-IN',
    id: 'bn-IN',
    englishName: 'Bengali',
    nativeName: 'বাংলা',
    autonym: 'বাংলা',
    verifiedOnDevice: false,
  },
  {
    code: 'brx-IN',
    id: 'brx-IN',
    englishName: 'Bodo',
    nativeName: 'बड़ो',
    autonym: 'बड़ो',
    verifiedOnDevice: false,
  },
  {
    code: 'doi-IN',
    id: 'doi-IN',
    englishName: 'Dogri',
    nativeName: 'डोगरी',
    autonym: 'डोगरी',
    verifiedOnDevice: false,
  },
  {
    code: 'gu-IN',
    id: 'gu-IN',
    englishName: 'Gujarati',
    nativeName: 'ગુજરાતી',
    autonym: 'ગુજરાતી',
    verifiedOnDevice: false,
  },
  {
    code: 'ks-IN',
    id: 'ks-IN',
    englishName: 'Kashmiri',
    nativeName: 'कॉशुर',
    autonym: 'कॉशुर',
    verifiedOnDevice: false,
  },
  {
    code: 'kok-IN',
    id: 'kok-IN',
    englishName: 'Konkani',
    nativeName: 'कोंकणी',
    autonym: 'कोंकणी',
    verifiedOnDevice: false,
  },
  {
    code: 'mai-IN',
    id: 'mai-IN',
    englishName: 'Maithili',
    nativeName: 'मैथिली',
    autonym: 'मैथिली',
    verifiedOnDevice: false,
  },
  {
    code: 'mni-IN',
    id: 'mni-IN',
    englishName: 'Manipuri',
    nativeName: 'মৈতৈলোন্',
    autonym: 'মৈতৈলোন্',
    verifiedOnDevice: false,
  },
  {
    code: 'mr-IN',
    id: 'mr-IN',
    englishName: 'Marathi',
    nativeName: 'मराठी',
    autonym: 'मराठी',
    verifiedOnDevice: false,
  },
  {
    code: 'ne-IN',
    id: 'ne-IN',
    englishName: 'Nepali',
    nativeName: 'नेपाली',
    autonym: 'नेपाली',
    verifiedOnDevice: false,
  },
  {
    code: 'or-IN',
    id: 'or-IN',
    englishName: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    autonym: 'ଓଡ଼ିଆ',
    verifiedOnDevice: false,
  },
  {
    code: 'pa-IN',
    id: 'pa-IN',
    englishName: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    autonym: 'ਪੰਜਾਬੀ',
    verifiedOnDevice: false,
  },
  {
    code: 'sa-IN',
    id: 'sa-IN',
    englishName: 'Sanskrit',
    nativeName: 'संस्कृतम्',
    autonym: 'संस्कृतम्',
    verifiedOnDevice: false,
  },
  {
    code: 'sat-IN',
    id: 'sat-IN',
    englishName: 'Santali',
    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',
    autonym: 'ᱥᱟᱱᱛᱟᱲᱤ',
    verifiedOnDevice: false,
  },
  {
    code: 'sd-IN',
    id: 'sd-IN',
    englishName: 'Sindhi',
    nativeName: 'سنڌي',
    autonym: 'سنڌي',
    verifiedOnDevice: false,
  },
  {
    code: 'ur-IN',
    id: 'ur-IN',
    englishName: 'Urdu',
    nativeName: 'اردو',
    autonym: 'اردو',
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
