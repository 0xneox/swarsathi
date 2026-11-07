import * as FileSystem from 'expo-file-system/legacy';
import {
  ARASAAC_CORE_SYMBOLS,
  ARASAAC_IMAGES_DIR,
  ARASAAC_MANIFEST_PATH,
  ARASAAC_PACK_CATEGORIES,
  ARASAAC_PACK_DIR,
  ARASAAC_PACK_ID,
  type ArasaacManifest,
  type ArasaacManifestEntry,
} from '../../data/arasaac';
import type { InstalledPack } from '../../types';
import type { InstalledPackRepository } from '../storage/packs';

/**
 * Installs the ARASAAC core picture pack.
 *
 * Unlike the neural voice packs there is no single archive to download: ARASAAC only serves
 * pictograms one at a time, so "install" means one best-search call per core word plus one image
 * download per hit. Everything lands in the pack directory as PNGs plus a `manifest.json` the
 * board's provider reads afterwards — after this runs once, the board is fully offline.
 *
 * The filesystem and network are injected so tests can drive the whole flow without a device.
 */

const API_BASE = 'https://api.arasaac.org/api';
const SEARCH_URL = (term: string) =>
  `${API_BASE}/pictograms/en/bestsearch/${encodeURIComponent(term)}`;
export const arasaacImageUrl = (id: number) =>
  `https://static.arasaac.org/pictograms/${id}/${id}_500.png`;

export interface ArasaacInstallDeps {
  /** GET a JSON endpoint. */
  fetchJson: (url: string) => Promise<unknown>;
  /** Download `url` to `destPath`; throws on non-200. */
  download: (url: string, destPath: string) => Promise<void>;
  writeFile: (path: string, contents: string) => Promise<void>;
  makeDir: (path: string) => Promise<void>;
  deleteDir: (path: string) => Promise<void>;
  /** Where the pack lives; defaults to the app's document directory. */
  packDir: string;
  repository: InstalledPackRepository;
  now?: () => number;
}

interface ApiPictogram {
  id?: number;
  _id?: number;
  keywords?: unknown;
}

function pictogramId(item: unknown): number | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  const candidate = item as ApiPictogram;
  const id = candidate.id ?? candidate._id;
  return typeof id === 'number' ? id : null;
}

/** Pulls the pictogram list out of whatever shape the endpoint returns. */
function pictogramIds(payload: unknown): number[] {
  const list = Array.isArray(payload)
    ? payload
    : ((payload as { pictograms?: unknown[]; items?: unknown[] } | null)?.pictograms ??
      (payload as { items?: unknown[] } | null)?.items ??
      []);
  return (Array.isArray(list) ? list : [])
    .map(pictogramId)
    .filter((id): id is number => id !== null);
}

/**
 * Downloads every core pictogram and writes the manifest.
 *
 * A term that finds no pictogram is skipped rather than failing the whole install: a partial
 * library of 60 real pictograms is more useful than none. The install only fails when *nothing*
 * could be fetched, which almost always means there is no network.
 */
export async function installArasaacPack(deps: ArasaacInstallDeps): Promise<InstalledPack> {
  const now = deps.now ?? Date.now;
  const imagesDir = `${deps.packDir}${ARASAAC_IMAGES_DIR}`;

  // A reinstall starts clean so stale images from an older vocabulary cannot linger.
  await deps.deleteDir(deps.packDir);
  await deps.makeDir(imagesDir);

  const entries: ArasaacManifestEntry[] = [];
  for (const symbol of ARASAAC_CORE_SYMBOLS) {
    let arasaacId: number | null = null;
    try {
      const payload = await deps.fetchJson(SEARCH_URL(symbol.term));
      arasaacId = pictogramIds(payload)[0] ?? null;
    } catch {
      arasaacId = null;
    }
    if (arasaacId === null) {
      continue;
    }

    const imagePath = `${imagesDir}${symbol.slug}.png`;
    try {
      await deps.download(arasaacImageUrl(arasaacId), imagePath);
    } catch {
      continue;
    }

    entries.push({
      id: `arasaac-${symbol.slug}`,
      arasaacId,
      image: imagePath,
      words: { 'en-IN': symbol.label },
      category: symbol.category,
    });
  }

  if (entries.length === 0) {
    throw new Error('No ARASAAC pictograms could be downloaded. Check the connection and try again.');
  }

  const manifest: ArasaacManifest = {
    packId: ARASAAC_PACK_ID,
    version: 1,
    generatedAt: now(),
    categories: ARASAAC_PACK_CATEGORIES,
    entries,
  };
  await deps.writeFile(`${deps.packDir}${ARASAAC_MANIFEST_PATH}`, JSON.stringify(manifest));

  const installed: InstalledPack = {
    packId: ARASAAC_PACK_ID,
    kind: 'symbols',
    language: '',
    directory: deps.packDir,
    bytes: entries.length,
    verified: true,
    installedAt: now(),
  };
  await deps.repository.save(installed);
  return installed;
}

/** The real dependencies: fetch plus the app's document directory. */
export function arasaacInstallDeps(repository: InstalledPackRepository): ArasaacInstallDeps {
  const base = `${FileSystem.documentDirectory ?? ''}${ARASAAC_PACK_DIR}`;
  return {
    packDir: base,
    repository,
    fetchJson: async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ARASAAC request failed: HTTP ${response.status}`);
      }
      return response.json();
    },
    download: async (url, destPath) => {
      const result = await FileSystem.downloadAsync(url, destPath);
      if (result.status !== 200) {
        throw new Error(`Image download failed: HTTP ${result.status}`);
      }
    },
    writeFile: (path, contents) => FileSystem.writeAsStringAsync(path, contents),
    makeDir: (path) => FileSystem.makeDirectoryAsync(path, { intermediates: true }),
    deleteDir: (path) => FileSystem.deleteAsync(path, { idempotent: true }),
  };
}
