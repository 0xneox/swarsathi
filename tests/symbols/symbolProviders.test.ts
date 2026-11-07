import {
  CUSTOM_CATEGORY_ID,
  CUSTOM_PROVIDER_ID,
  CustomSymbolProvider,
  StarterSymbolProvider,
  UnavailableSymbolProvider,
  createSymbolProviders,
  customSymbolToEntry,
  filterSymbolEntries,
  listSymbolCategories,
  listSymbolEntries,
  searchSymbolEntries,
} from '../../src/services/symbols/SymbolProvider';
import { keywordsForSymbol } from '../../src/data/symbolKeywords';
import {
  STARTER_PROVIDER_ID,
  STARTER_SYMBOL_ENTRIES,
  STARTER_SYMBOLS,
  SYMBOL_CATEGORIES,
  symbolEntryTranslationMissing,
} from '../../src/data/symbols';
import { InMemoryCustomSymbolRepository } from '../../src/services/storage/customSymbols';
import { DEFAULT_PROFILE_ID } from '../../src/services/storage/profileScope';
import type { CustomSymbol } from '../../src/types';

/**
 * Sprint C: the symbol provider seam and the Indic keyword layer.
 *
 * These pin the two behaviours the board now depends on: that a query in any of SwarSathi's languages
 * finds a picture, and that the bundled set, the "unavailable" placeholder and a person's own
 * photographs are interchangeable behind one interface.
 */

function makeCustomSymbol(overrides: Partial<CustomSymbol> = {}): CustomSymbol {
  return {
    id: 'sym-photo-1',
    profileId: DEFAULT_PROFILE_ID,
    label: 'Grandma',
    language: 'en-IN',
    imageUri: 'file:///documents/custom-symbols/pic_1.jpg',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

/** Every language a bundled symbol must carry a word for. */
const BUNDLED_LANGUAGES = ['en-IN', 'ml-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN'];

describe('the bundled symbol set', () => {
  it('gives every symbol its own picture, so no glyph means two things', () => {
    const glyphs = STARTER_SYMBOLS.map((symbol) => symbol.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('carries a word in all six languages for every symbol', () => {
    for (const entry of STARTER_SYMBOL_ENTRIES) {
      for (const language of BUNDLED_LANGUAGES) {
        expect(entry.words[language]).toBeTruthy();
      }
    }
  });

  it('reports the English fallback only when the language is genuinely absent', () => {
    const entry = STARTER_SYMBOL_ENTRIES[0];
    expect(symbolEntryTranslationMissing(entry, 'ml-IN')).toBe(false);
    // Bengali is not one of the six, so the tile would be showing English.
    expect(symbolEntryTranslationMissing(entry, 'bn-IN')).toBe(true);
  });
});

describe('keywordsForSymbol', () => {
  it('returns the recorded synonyms for a symbol and language', () => {
    expect(keywordsForSymbol('sym-water', 'ml-IN')).toEqual(['ജലം']);
    expect(keywordsForSymbol('sym-mother', 'ta-IN')).toEqual(['அம்மா']);
  });

  it('returns nothing for a symbol with no recorded synonyms', () => {
    // `sym-please` is deliberately absent from the keyword table; it stays findable by its own word.
    expect(keywordsForSymbol('sym-please', 'ml-IN')).toEqual([]);
  });

  it('returns nothing for a language the symbol did not record', () => {
    expect(keywordsForSymbol('sym-water', 'bn-IN')).toEqual([]);
  });

  it('returns nothing for an unknown symbol id', () => {
    expect(keywordsForSymbol('sym-not-a-symbol', 'ml-IN')).toEqual([]);
  });
});

describe('filterSymbolEntries', () => {
  const entries = STARTER_SYMBOL_ENTRIES;

  it('returns every entry for an empty query', () => {
    expect(filterSymbolEntries(entries, '', 'en-IN')).toBe(entries);
  });

  it('treats a whitespace-only query as empty', () => {
    expect(filterSymbolEntries(entries, '   ', 'en-IN')).toBe(entries);
  });

  it('matches the word a symbol contributes in the active language', () => {
    const found = filterSymbolEntries(entries, 'വെള്ളം', 'ml-IN');
    expect(found.map((entry) => entry.id)).toEqual(['sym-water']);
  });

  it('matches the English word whichever language the board is in', () => {
    const found = filterSymbolEntries(entries, 'water', 'ml-IN');
    expect(found.map((entry) => entry.id)).toContain('sym-water');
  });

  it('matches a synonym that is not the symbol\u2019s own word', () => {
    // The water symbol contributes "വെള്ളം"; "ജലം" is a recorded synonym, so it must still find it.
    const found = filterSymbolEntries(entries, 'ജലം', 'ml-IN');
    expect(found.map((entry) => entry.id)).toEqual(['sym-water']);
  });

  it('matches a synonym only in the board\u2019s own language', () => {
    // Synonyms are language-scoped: a Hindi keyword reaches the board only when Hindi is active.
    expect(filterSymbolEntries(entries, 'जल', 'hi-IN').map((entry) => entry.id)).toEqual([
      'sym-water',
    ]);
    expect(filterSymbolEntries(entries, 'जल', 'ml-IN')).toEqual([]);
  });

  it('ignores case and surrounding spaces', () => {
    expect(filterSymbolEntries(entries, '  WATER  ', 'en-IN').map((entry) => entry.id)).toEqual([
      'sym-water',
    ]);
    expect(filterSymbolEntries(entries, 'WaTeR', 'en-IN').map((entry) => entry.id)).toEqual([
      'sym-water',
    ]);
  });

  it('returns nothing when no entry matches', () => {
    expect(filterSymbolEntries(entries, 'zzzzz', 'en-IN')).toEqual([]);
  });
});

describe('StarterSymbolProvider', () => {
  const provider = new StarterSymbolProvider();

  it('identifies itself as the bundled set', async () => {
    expect(provider.id).toBe(STARTER_PROVIDER_ID);
    await expect(provider.isAvailable()).resolves.toBe(true);
  });

  it('lists the bundled entries, unchanged', async () => {
    await expect(provider.list()).resolves.toBe(STARTER_SYMBOL_ENTRIES);
  });

  it('offers the bundled categories', async () => {
    await expect(provider.categories()).resolves.toBe(SYMBOL_CATEGORIES);
  });

  it('looks an entry up by id and reports a miss as null', async () => {
    await expect(provider.get('sym-water')).resolves.toMatchObject({ id: 'sym-water' });
    await expect(provider.get('sym-none')).resolves.toBeNull();
  });

  it('searches its own entries', async () => {
    const found = await provider.search('water', 'en-IN');
    expect(found.map((entry) => entry.id)).toEqual(['sym-water']);
  });
});

describe('UnavailableSymbolProvider', () => {
  const provider = new UnavailableSymbolProvider();

  it('never pretends to hold pictures', async () => {
    await expect(provider.isAvailable()).resolves.toBe(false);
    await expect(provider.list()).resolves.toEqual([]);
    await expect(provider.categories()).resolves.toEqual([]);
    await expect(provider.get('sym-water')).resolves.toBeNull();
    await expect(provider.search('water', 'en-IN')).resolves.toEqual([]);
  });
});

describe('CustomSymbolProvider', () => {
  it('presents a stored picture as a board entry', () => {
    const entry = customSymbolToEntry(makeCustomSymbol({ label: 'Amma' }));

    expect(entry).toMatchObject({
      id: 'sym-photo-1',
      category: CUSTOM_CATEGORY_ID,
      providerId: CUSTOM_PROVIDER_ID,
      representation: { kind: 'image', uri: 'file:///documents/custom-symbols/pic_1.jpg' },
    });
    // The word is mirrored to English so the picture is never blank in a different board language.
    expect(entry.words).toMatchObject({ 'en-IN': 'Amma' });
  });

  it('hides its category until a picture exists', async () => {
    const repository = new InMemoryCustomSymbolRepository();
    const provider = new CustomSymbolProvider(repository);

    await expect(provider.categories()).resolves.toEqual([]);

    await repository.save(makeCustomSymbol());

    await expect(provider.categories()).resolves.toEqual([
      { id: CUSTOM_CATEGORY_ID, label: 'My pictures' },
    ]);
  });

  it('lists, gets and searches the person\u2019s own pictures', async () => {
    const repository = new InMemoryCustomSymbolRepository();
    await repository.save(makeCustomSymbol({ id: 'sym-a', label: 'Grandma' }));
    await repository.save(makeCustomSymbol({ id: 'sym-b', label: 'Grandpa' }));
    const provider = new CustomSymbolProvider(repository);

    await expect(provider.list()).resolves.toHaveLength(2);
    await expect(provider.get('sym-b')).resolves.toMatchObject({ id: 'sym-b' });

    const found = await provider.search('grandma', 'en-IN');
    expect(found.map((entry) => entry.id)).toEqual(['sym-a']);
  });

  it('reports itself as available', async () => {
    await expect(new CustomSymbolProvider(new InMemoryCustomSymbolRepository()).isAvailable()).resolves.toBe(
      true
    );
  });
});

describe('createSymbolProviders', () => {
  it('returns only the bundled set when there is no custom repository', () => {
    const providers = createSymbolProviders(null);
    expect(providers.map((provider) => provider.id)).toEqual([STARTER_PROVIDER_ID]);
  });

  it('puts the bundled set before the person\u2019s own pictures', () => {
    const providers = createSymbolProviders(new InMemoryCustomSymbolRepository());
    expect(providers.map((provider) => provider.id)).toEqual([
      STARTER_PROVIDER_ID,
      CUSTOM_PROVIDER_ID,
    ]);
  });
});

describe('aggregate helpers', () => {
  it('concatenates every provider\u2019s entries and categories in order', async () => {
    const repository = new InMemoryCustomSymbolRepository();
    await repository.save(makeCustomSymbol({ id: 'sym-photo-1' }));
    const providers = createSymbolProviders(repository);

    const entries = await listSymbolEntries(providers);
    expect(entries.map((entry) => entry.id)).toEqual([
      ...STARTER_SYMBOL_ENTRIES.map((entry) => entry.id),
      'sym-photo-1',
    ]);

    const categories = await listSymbolCategories(providers);
    expect(categories.map((category) => category.id)).toEqual([
      ...SYMBOL_CATEGORIES.map((category) => category.id),
      CUSTOM_CATEGORY_ID,
    ]);
  });

  it('reaches pictures from every provider with one query', async () => {
    const repository = new InMemoryCustomSymbolRepository();
    await repository.save(makeCustomSymbol({ id: 'sym-photo-1', label: 'Grandma' }));
    const providers = createSymbolProviders(repository);

    const found = await searchSymbolEntries(providers, 'grandma', 'en-IN');
    expect(found.map((entry) => entry.id)).toEqual(['sym-photo-1']);
  });
});
