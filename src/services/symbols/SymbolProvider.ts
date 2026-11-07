import type { CustomSymbol, SymbolCategory, SymbolEntry, SymbolProvider } from '../../types';
import { keywordsForSymbol } from '../../data/symbolKeywords';
import {
  STARTER_PROVIDER_ID,
  STARTER_SYMBOL_ENTRIES,
  SYMBOL_CATEGORIES,
  symbolEntryText,
} from '../../data/symbols';
import type { CustomSymbolRepository } from '../storage/customSymbols';

/**
 * The seam between the board and wherever its pictures come from.
 *
 * This mirrors `SpeechEngine` on purpose: an interface, a real implementation, an implementation
 * that never pretends to have data, and a factory that picks between them. The board only ever sees
 * `SymbolEntry`, so the bundled emoji set, a user's own photographs and (later) a downloaded
 * ARASAAC library are interchangeable, and adding a provider is a new file rather than a new branch
 * inside the screen.
 *
 * `search` takes the language rather than reading it from a global because the board is the only
 * thing that knows which language the person is working in.
 */

/** Id of the provider that serves the bundled set. Matches `STARTER_PROVIDER_ID` in the data layer. */
export const CUSTOM_PROVIDER_ID = 'custom';

/** Category id every custom picture is filed under. Not one of the bundled category ids. */
export const CUSTOM_CATEGORY_ID = 'custom';

const CUSTOM_CATEGORY_LABEL = 'My pictures';

/**
 * Matches entries against what the person typed.
 *
 * A match is a case-insensitive substring of either the word the symbol contributes in the active
 * language or in English, plus any recorded synonyms in either language. English is included so a
 * bilingual user is not forced to switch the board's language to find a picture, and synonyms are
 * included because a person searching for "ജലം" should still find the water symbol, which
 * contributes "വെള്ളം".
 *
 * An empty query matches everything, so the board can use one code path for browsing and searching.
 */
export function filterSymbolEntries(
  entries: SymbolEntry[],
  query: string,
  language: string
): SymbolEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return entries;
  }
  return entries.filter((entry) => {
    const candidates = [
      symbolEntryText(entry, language),
      symbolEntryText(entry, 'en-IN'),
      ...keywordsForSymbol(entry.id, language),
      ...keywordsForSymbol(entry.id, 'en-IN'),
    ];
    return candidates.some((candidate) => candidate.toLowerCase().includes(needle));
  });
}

/**
 * The bundled emoji set, presented as a provider.
 *
 * It is first only in the order the board asks providers for pictures, not in privilege: the board
 * treats it exactly like any other.
 */
export class StarterSymbolProvider implements SymbolProvider {
  readonly id = STARTER_PROVIDER_ID;
  readonly displayName = 'SwarSathi pictures';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async list(): Promise<SymbolEntry[]> {
    return STARTER_SYMBOL_ENTRIES;
  }

  async categories(): Promise<SymbolCategory[]> {
    return SYMBOL_CATEGORIES;
  }

  async get(id: string): Promise<SymbolEntry | null> {
    return STARTER_SYMBOL_ENTRIES.find((entry) => entry.id === id) ?? null;
  }

  async search(query: string, language: string): Promise<SymbolEntry[]> {
    return filterSymbolEntries(STARTER_SYMBOL_ENTRIES, query, language);
  }
}

/**
 * Provider used when there is nothing to serve.
 *
 * Exactly like `UnavailableSpeechEngine`, it never pretends: an empty board is honest, whereas a
 * fallback that invented pictures would be a bug the person tapping could not see.
 */
export class UnavailableSymbolProvider implements SymbolProvider {
  readonly id = 'unavailable';
  readonly displayName = 'No pictures';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async list(): Promise<SymbolEntry[]> {
    return [];
  }

  async categories(): Promise<SymbolCategory[]> {
    return [];
  }

  async get(_id: string): Promise<SymbolEntry | null> {
    return null;
  }

  async search(_query: string, _language: string): Promise<SymbolEntry[]> {
    return [];
  }
}

/**
 * Pictures the person photographed or chose themselves.
 *
 * These are personal data living in the application's own storage, scoped to the active profile by
 * the repository, so one person's family photographs never appear on another person's board.
 */
export class CustomSymbolProvider implements SymbolProvider {
  readonly id = CUSTOM_PROVIDER_ID;
  readonly displayName = 'My pictures';

  private readonly repository: CustomSymbolRepository;

  constructor(repository: CustomSymbolRepository) {
    this.repository = repository;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async list(): Promise<SymbolEntry[]> {
    const symbols = await this.repository.list();
    return symbols.map(customSymbolToEntry);
  }

  async categories(): Promise<SymbolCategory[]> {
    // The chip only appears once there is something behind it.
    const entries = await this.list();
    return entries.length > 0 ? [{ id: CUSTOM_CATEGORY_ID, label: CUSTOM_CATEGORY_LABEL }] : [];
  }

  async get(id: string): Promise<SymbolEntry | null> {
    const entries = await this.list();
    return entries.find((entry) => entry.id === id) ?? null;
  }

  async search(query: string, language: string): Promise<SymbolEntry[]> {
    return filterSymbolEntries(await this.list(), query, language);
  }
}

/**
 * Presents a stored picture as a board entry.
 *
 * A custom picture carries exactly one label, in the language it was written in. It is mirrored to
 * English as well, so that changing the board's language later shows the person's own word rather
 * than an empty tile - a blank picture is worse than a word in the "wrong" language.
 */
export function customSymbolToEntry(symbol: CustomSymbol): SymbolEntry {
  return {
    id: symbol.id,
    category: CUSTOM_CATEGORY_ID,
    words: { [symbol.language]: symbol.label, 'en-IN': symbol.label },
    representation: { kind: 'image', uri: symbol.imageUri },
    providerId: CUSTOM_PROVIDER_ID,
  };
}

/**
 * The providers the board draws from, in display order.
 *
 * Bundled pictures first, then the person's own. The custom provider is only added when there is a
 * repository to read, so a caller that has none gets an empty list rather than an empty promise.
 */
export function createSymbolProviders(
  customRepository: CustomSymbolRepository | null
): SymbolProvider[] {
  const providers: SymbolProvider[] = [new StarterSymbolProvider()];
  if (customRepository) {
    providers.push(new CustomSymbolProvider(customRepository));
  }
  return providers;
}

/** Every entry every provider has, concatenated in provider order. */
export async function listSymbolEntries(providers: SymbolProvider[]): Promise<SymbolEntry[]> {
  const lists = await Promise.all(providers.map((provider) => provider.list()));
  return lists.flat();
}

/** Every category every provider offers, concatenated in provider order. */
export async function listSymbolCategories(
  providers: SymbolProvider[]
): Promise<SymbolCategory[]> {
  const lists = await Promise.all(providers.map((provider) => provider.categories()));
  return lists.flat();
}

/** Searches every provider at once, so a query reaches pictures from all of them. */
export async function searchSymbolEntries(
  providers: SymbolProvider[],
  query: string,
  language: string
): Promise<SymbolEntry[]> {
  const results = await Promise.all(
    providers.map((provider) => provider.search(query, language))
  );
  return results.flat();
}
