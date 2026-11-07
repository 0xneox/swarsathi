import { ARASAAC_CORE_SYMBOLS, type ArasaacManifest } from '../../src/data/arasaac';
import { installArasaacPack, type ArasaacInstallDeps } from '../../src/services/symbols/arasaacInstaller';
import { PackSymbolProvider } from '../../src/services/symbols/PackSymbolProvider';
import { InMemoryInstalledPackRepository } from '../../src/services/storage/packs';
import type { InstalledPack } from '../../src/types';

const manifest: ArasaacManifest = {
  packId: 'pack-arasaac-core',
  version: 1,
  generatedAt: 1,
  categories: [{ id: 'needs', label: 'Needs' }],
  entries: [
    {
      id: 'arasaac-water',
      arasaacId: 2350,
      image: 'file:///packs/pack-arasaac-core/images/water.png',
      words: { 'en-IN': 'water' },
      category: 'needs',
    },
  ],
};

const pack: InstalledPack = {
  packId: 'pack-arasaac-core',
  kind: 'symbols',
  language: '',
  directory: 'file:///packs/pack-arasaac-core',
  bytes: 1,
  verified: true,
  installedAt: 1,
};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  readAsStringAsync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FileSystem = require('expo-file-system/legacy') as {
  readAsStringAsync: jest.Mock;
};

describe('PackSymbolProvider', () => {
  beforeEach(() => {
    FileSystem.readAsStringAsync.mockReset();
    FileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(manifest));
  });

  it('serves manifest entries as image symbols', async () => {
    const provider = new PackSymbolProvider(pack);
    const entries = await provider.list();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'arasaac-water',
      category: 'needs',
      words: { 'en-IN': 'water' },
      representation: { kind: 'image', uri: 'file:///packs/pack-arasaac-core/images/water.png' },
      providerId: 'arasaac',
    });
    expect(await provider.categories()).toEqual([{ id: 'needs', label: 'Needs' }]);
  });

  it('finds entries by their English wording and reports nothing for unknown ids', async () => {
    const provider = new PackSymbolProvider(pack);

    expect((await provider.search('water', 'en-IN')).map((e) => e.id)).toEqual(['arasaac-water']);
    expect(await provider.get('arasaac-water')).not.toBeNull();
    expect(await provider.get('nope')).toBeNull();
  });

  it('is unavailable when the manifest cannot be read', async () => {
    FileSystem.readAsStringAsync.mockRejectedValue(new Error('missing'));
    const provider = new PackSymbolProvider(pack);

    expect(await provider.isAvailable()).toBe(false);
    expect(await provider.list()).toEqual([]);
  });
});

describe('installArasaacPack', () => {
  function deps(overrides: Partial<ArasaacInstallDeps> = {}): ArasaacInstallDeps {
    return {
      packDir: 'file:///packs/pack-arasaac-core/',
      repository: new InMemoryInstalledPackRepository(),
      fetchJson: jest.fn(async () => [{ id: 1000 }]),
      download: jest.fn(async () => undefined),
      writeFile: jest.fn(async () => undefined),
      makeDir: jest.fn(async () => undefined),
      deleteDir: jest.fn(async () => undefined),
      now: () => 42,
      ...overrides,
    };
  }

  it('fetches every core term, downloads each pictogram and writes the manifest', async () => {
    const d = deps();
    const installed = await installArasaacPack(d);

    expect(installed).toMatchObject({ packId: 'pack-arasaac-core', kind: 'symbols', verified: true });
    expect(d.fetchJson).toHaveBeenCalledTimes(ARASAAC_CORE_SYMBOLS.length);
    expect(d.download).toHaveBeenCalledTimes(ARASAAC_CORE_SYMBOLS.length);

    const written = (d.writeFile as jest.Mock).mock.calls[0][1] as string;
    const parsed = JSON.parse(written) as ArasaacManifest;
    expect(parsed.entries).toHaveLength(ARASAAC_CORE_SYMBOLS.length);
    expect(parsed.entries[0]).toMatchObject({
      id: `arasaac-${ARASAAC_CORE_SYMBOLS[0].slug}`,
      arasaacId: 1000,
      words: { 'en-IN': ARASAAC_CORE_SYMBOLS[0].label },
    });
    expect(parsed.categories.length).toBeGreaterThan(0);
    await expect(d.repository.get('pack-arasaac-core')).resolves.toMatchObject({ kind: 'symbols' });
  });

  it('skips terms the API cannot resolve and still installs the rest', async () => {
    let call = 0;
    const d = deps({
      fetchJson: jest.fn(async () => {
        call += 1;
        return call === 1 ? [] : [{ id: 2000 + call }];
      }),
    });
    await installArasaacPack(d);

    const written = (d.writeFile as jest.Mock).mock.calls[0][1] as string;
    const parsed = JSON.parse(written) as ArasaacManifest;
    expect(parsed.entries).toHaveLength(ARASAAC_CORE_SYMBOLS.length - 1);
  });

  it('fails honestly when nothing can be downloaded', async () => {
    const d = deps({ fetchJson: jest.fn(async () => Promise.reject(new Error('offline'))) });
    await expect(installArasaacPack(d)).rejects.toThrow('No ARASAAC pictograms');
    await expect(d.repository.get('pack-arasaac-core')).resolves.toBeNull();
  });
});
