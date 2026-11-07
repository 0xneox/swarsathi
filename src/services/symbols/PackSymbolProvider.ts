import * as FileSystem from 'expo-file-system/legacy';
import { ARASAAC_MANIFEST_PATH, ARASAAC_PROVIDER_ID, type ArasaacManifest } from '../../data/arasaac';
import type { InstalledPack, SymbolCategory, SymbolEntry, SymbolProvider } from '../../types';
import { filterSymbolEntries } from './SymbolProvider';

/**
 * Serves the installed ARASAAC pack as board symbols.
 *
 * The pack is just a directory: PNGs under `images/` plus a `manifest.json` written at install
 * time. This provider reads the manifest once and answers the same questions every other provider
 * does, so the board cannot tell an ARASAAC pictogram from an emoji — which is the point of the
 * provider seam.
 *
 * ARASAAC carries no Indic wording, so entries only ever contribute their English label. Tiles in
 * other languages show the honest "Shown in English" badge the board already renders.
 */
export class PackSymbolProvider implements SymbolProvider {
  readonly id = ARASAAC_PROVIDER_ID;
  readonly displayName = 'ARASAAC pictures';

  private readonly directory: string;
  private manifest: ArasaacManifest | null | undefined;

  constructor(pack: InstalledPack) {
    this.directory = pack.directory.endsWith('/') ? pack.directory : `${pack.directory}/`;
  }

  private async loadManifest(): Promise<ArasaacManifest | null> {
    if (this.manifest !== undefined) {
      return this.manifest;
    }
    try {
      const raw = await FileSystem.readAsStringAsync(`${this.directory}${ARASAAC_MANIFEST_PATH}`);
      this.manifest = JSON.parse(raw) as ArasaacManifest;
    } catch {
      this.manifest = null;
    }
    return this.manifest;
  }

  async isAvailable(): Promise<boolean> {
    return (await this.loadManifest()) !== null;
  }

  private async entries(): Promise<SymbolEntry[]> {
    const manifest = await this.loadManifest();
    if (!manifest) {
      return [];
    }
    return manifest.entries.map((entry) => ({
      id: entry.id,
      category: entry.category,
      words: entry.words,
      representation: { kind: 'image' as const, uri: entry.image },
      providerId: this.id,
    }));
  }

  async list(): Promise<SymbolEntry[]> {
    return this.entries();
  }

  async categories(): Promise<SymbolCategory[]> {
    const manifest = await this.loadManifest();
    return manifest?.categories ?? [];
  }

  async get(id: string): Promise<SymbolEntry | null> {
    return (await this.entries()).find((entry) => entry.id === id) ?? null;
  }

  async search(query: string, language: string): Promise<SymbolEntry[]> {
    return filterSymbolEntries(await this.entries(), query, language);
  }
}
