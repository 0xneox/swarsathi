import {
  BUNDLED_PHRASES,
  HOME_QUICK_PHRASE_IDS,
  PHRASE_CATEGORIES,
  PHRASE_CATEGORY_LABELS,
  SUPPORTED_PHRASE_LANGUAGES,
  buildAllPhraseRows,
  buildHomeQuickPhrases,
  buildPhraseRows,
  getBundledPhrase,
  hasTranslation,
  resolveFavouriteEntries,
  resolvePhraseText,
  sortPhrases,
} from '../../src/data/phrases';
import type { CustomMessage, Favourite } from '../../src/types';

const REQUIRED_CATEGORY_IDS = [
  'medical',
  'emergency',
  'daily-needs',
  'family',
  'banking',
  'travel',
  'personal-care',
  'general',
] as const;

describe('bundled phrase library', () => {
  it('ships all eight required categories', () => {
    const ids = PHRASE_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...REQUIRED_CATEGORY_IDS].sort());
  });

  it('gives every category a label and a description', () => {
    for (const category of PHRASE_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(0);
      expect(category.description.length).toBeGreaterThan(0);
      expect(PHRASE_CATEGORY_LABELS[category.id]).toBe(category.label);
    }
  });

  it('has at least one phrase in every category', () => {
    for (const category of PHRASE_CATEGORIES) {
      expect(BUNDLED_PHRASES.some((phrase) => phrase.category === category.id)).toBe(true);
    }
  });

  it('uses unique logical ids', () => {
    const ids = BUNDLED_PHRASES.map((phrase) => phrase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every phrase a known category and non-empty English text', () => {
    const known = new Set<string>(PHRASE_CATEGORIES.map((category) => category.id));
    for (const phrase of BUNDLED_PHRASES) {
      expect(known.has(phrase.category)).toBe(true);
      expect(phrase.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('translates every phrase into all five non-English languages', () => {
    const targets = SUPPORTED_PHRASE_LANGUAGES.filter((language) => language !== 'en-IN');
    for (const phrase of BUNDLED_PHRASES) {
      for (const language of targets) {
        expect(hasTranslation(phrase, language)).toBe(true);
        expect(resolvePhraseText(phrase, language).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('covers the required example phrases from the specification', () => {
    const required = [
      'I am experiencing pain.',
      'I need a doctor.',
      'Please explain the treatment.',
      'I cannot speak.',
      'Please give me some water.',
      'I need my medication.',
      'Please help me.',
      'Call an ambulance.',
      'Call my family.',
      'I am having difficulty breathing.',
      'This is an emergency.',
      'I need food.',
      'I am thirsty.',
      'I need to use the bathroom.',
      'I am feeling uncomfortable.',
      'Please wait.',
    ];
    const texts = new Set(BUNDLED_PHRASES.map((phrase) => phrase.text));
    for (const text of required) {
      expect(texts.has(text)).toBe(true);
    }
  });
});

describe('resolvePhraseText', () => {
  const phrase = BUNDLED_PHRASES[0];

  it('returns the canonical English wording for en-IN', () => {
    expect(resolvePhraseText(phrase, 'en-IN')).toBe(phrase.text);
  });

  it('returns the stored translation for another language', () => {
    expect(resolvePhraseText(phrase, 'ml-IN')).toBe(phrase.translations['ml-IN']);
  });

  it('falls back to English rather than returning nothing when a translation is missing', () => {
    const untranslated = { id: 'x', category: 'general' as const, text: 'Hello.', translations: {} };
    expect(resolvePhraseText(untranslated, 'ml-IN')).toBe('Hello.');
  });
});

describe('buildPhraseRows', () => {
  it('produces one row per bundled phrase for a language', () => {
    const rows = buildPhraseRows('ml-IN');
    expect(rows).toHaveLength(BUNDLED_PHRASES.length);
    expect(rows.every((row) => row.language === 'ml-IN' && row.isDefault)).toBe(true);
  });

  it('orders rows by category so the most urgent vocabulary comes first', () => {
    const rows = buildPhraseRows('en-IN');
    const firstCategory = rows[0].category;
    expect(firstCategory).toBe(PHRASE_CATEGORIES[0].id);
  });

  it('covers all six languages when building the full seed', () => {
    const languages = new Set(buildAllPhraseRows().map((row) => row.language));
    expect(languages.size).toBe(SUPPORTED_PHRASE_LANGUAGES.length);
  });

  it('keeps phrases in a stable order', () => {
    const rows = buildPhraseRows('en-IN');
    expect(sortPhrases(rows).map((row) => row.id)).toEqual(rows.map((row) => row.id));
  });
});

describe('buildHomeQuickPhrases', () => {
  it('builds the home strip in English by default', () => {
    const strip = buildHomeQuickPhrases('en-IN');
    expect(strip).toHaveLength(HOME_QUICK_PHRASE_IDS.length);

    const thanks = strip.find((entry) => entry.id === 'general-thanks');
    expect(thanks?.text).toBe('Thank you.');
    expect(thanks?.categoryLabel).toBe('General Conversation');
  });

  it('swaps the wording when the active language changes', () => {
    const english = buildHomeQuickPhrases('en-IN').find((entry) => entry.id === 'general-thanks');
    const malayalam = buildHomeQuickPhrases('ml-IN').find((entry) => entry.id === 'general-thanks');

    expect(malayalam?.text).not.toBe(english?.text);
    expect(malayalam?.text).toBe(getBundledPhrase('general-thanks')?.translations['ml-IN']);
  });
});

describe('resolveFavouriteEntries', () => {
  const favourites: Favourite[] = [
    { id: 'fav-1', phraseId: 'general-thanks', customMessageId: null, sortOrder: 0, createdAt: 1 },
    { id: 'fav-2', phraseId: null, customMessageId: 'cmsg-1', sortOrder: 1, createdAt: 2 },
    { id: 'fav-3', phraseId: 'does-not-exist', customMessageId: null, sortOrder: 2, createdAt: 3 },
  ];

  const customMessages: CustomMessage[] = [
    {
      id: 'cmsg-1',
      title: 'Morning',
      text: 'Good morning, everyone.',
      language: 'en-IN',
      category: 'general',
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  it('resolves a bundled phrase to the language the app is now speaking', () => {
    const entries = resolveFavouriteEntries(favourites, customMessages, 'ml-IN');
    const thanks = entries.find((entry) => entry.favourite.id === 'fav-1');

    expect(thanks?.text).toBe(getBundledPhrase('general-thanks')?.translations['ml-IN']);
    expect(thanks?.language).toBe('ml-IN');
    expect(thanks?.isCustom).toBe(false);
  });

  it('keeps a custom message in the language it was written in', () => {
    const entries = resolveFavouriteEntries(favourites, customMessages, 'ml-IN');
    const custom = entries.find((entry) => entry.favourite.id === 'fav-2');

    expect(custom?.text).toBe('Good morning, everyone.');
    expect(custom?.language).toBe('en-IN');
    expect(custom?.title).toBe('Morning');
    expect(custom?.isCustom).toBe(true);
  });

  it('skips a favourite whose target can no longer be found instead of rendering a blank row', () => {
    const entries = resolveFavouriteEntries(favourites, customMessages, 'en-IN');

    expect(entries.map((entry) => entry.favourite.id)).toEqual(['fav-1', 'fav-2']);
  });
});
