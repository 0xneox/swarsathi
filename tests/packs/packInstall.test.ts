import * as FileSystem from 'expo-file-system/legacy';
import type { NeuralTtsNativeModule } from '../../modules/swar-neural-tts';
import { PACKS, getAvailablePacks, getPack } from '../../src/data/packs';
import { PackManager } from '../../src/services/packs/PackManager';
import { InMemoryInstalledPackRepository } from '../../src/services/storage/packs';
import type { InstalledPack, PackInstallState } from '../../src/types';

/**
 * `expo-file-system/legacy` needs the native module, so it is replaced with a factory of jest mocks.
 * The paths under test are the ones PackManager derives from `documentDirectory` / `cacheDirectory`,
 * so those values are fixed here rather than left to the host platform.
 */
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  getFreeDiskStorageAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

const PACK_ID = 'pack-ml-arjun-neural-voice';

function makeInstalled(overrides: Partial<InstalledPack> = {}): InstalledPack {
  return {
    packId: PACK_ID,
    kind: 'voice',
    language: 'ml-IN',
    directory: 'file:///documents/packs/pack-ml-arjun-neural-voice/',
    bytes: 67_222_458,
    verified: true,
    installedAt: 1_000_000,
    ...overrides,
  };
}

function makeNative(): { extractArchive: jest.Mock; module: NeuralTtsNativeModule } {
  const extractArchive = jest.fn(async () => ({ bytes: 67_222_458, fileCount: 2 }));
  // Only `extractArchive` is exercised during installation; the rest of the native surface is not
  // needed by this test, so a partial object is cast to the full module type.
  const module = { extractArchive } as unknown as NeuralTtsNativeModule;
  return { extractArchive, module };
}

describe('getAvailablePacks', () => {
  it('returns every catalogue pack when nothing is installed', () => {
    expect(getAvailablePacks([])).toEqual(PACKS);
  });

  it('excludes packs that already have an install record', () => {
    expect(getAvailablePacks([makeInstalled()])).toEqual([]);
  });

  it('leaves other catalogue packs available when only one is installed', () => {
    const installed = [makeInstalled({ packId: 'some-other-pack' })];
    expect(getAvailablePacks(installed)).toEqual(PACKS);
  });
});

describe('PackManager.installPack', () => {
  let repo: InMemoryInstalledPackRepository;
  let manager: PackManager;
  let native: ReturnType<typeof makeNative>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new InMemoryInstalledPackRepository();
    native = makeNative();
    manager = new PackManager(repo, native.module);

    const pack = getPack(PACK_ID);
    if (!pack) throw new Error('test fixture pack is missing from the catalogue');

    jest.mocked(FileSystem.getFreeDiskStorageAsync).mockResolvedValue(1_000_000_000);
    jest.mocked(FileSystem.createDownloadResumable).mockReturnValue({
      downloadAsync: jest.fn(async () => ({
        status: 200,
        uri: `file:///cache/${PACK_ID}.part`,
        headers: {},
        md5: null,
      })),
      cancelAsync: jest.fn(async () => undefined),
    } as unknown as FileSystem.DownloadResumable);
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true,
      size: pack.downloadBytes,
      uri: '',
      isDirectory: false,
      modificationTime: 0,
    });
    jest.mocked(FileSystem.makeDirectoryAsync).mockResolvedValue(undefined);
    jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
  });

  it('reports the phases in order and reaches done', async () => {
    const phases: PackInstallState['phase'][] = [];
    await manager.installPack(PACK_ID, (state) => phases.push(state.phase));

    expect(phases).toEqual([
      'checking-space',
      'downloading',
      'verifying',
      'extracting',
      'done',
    ]);
  });

  it('persists an InstalledPack once the install completes', async () => {
    const pack = getPack(PACK_ID);
    await manager.installPack(PACK_ID, () => {});

    await expect(repo.get(PACK_ID)).resolves.toMatchObject({
      packId: PACK_ID,
      kind: 'voice',
      language: 'ml-IN',
      directory: PackManager.packDir(PACK_ID),
      bytes: pack?.downloadBytes,
      verified: true,
    });
  });

  it('hands the native extractor scheme-stripped paths', async () => {
    await manager.installPack(PACK_ID, () => {});

    expect(native.extractArchive).toHaveBeenCalledWith({
      archivePath: `/cache/${PACK_ID}.part`,
      destinationDir: `/documents/packs/${PACK_ID}/`,
      format: 'tar.bz2',
    });
  });

  it('throws for an unknown pack id', async () => {
    await expect(manager.installPack('does-not-exist', () => {})).rejects.toEqual({
      code: 'DOWNLOAD_FAILED',
      message: 'Unknown pack id: does-not-exist',
    });
  });

  it('throws DOWNLOAD_FAILED when the download resolves with a non-200 status', async () => {
    jest.mocked(FileSystem.createDownloadResumable).mockReturnValue({
      downloadAsync: jest.fn(async () => ({ status: 404, uri: '', headers: {}, md5: null })),
      cancelAsync: jest.fn(async () => undefined),
    } as unknown as FileSystem.DownloadResumable);

    await expect(manager.installPack(PACK_ID, () => {})).rejects.toEqual({
      code: 'DOWNLOAD_FAILED',
      message: 'Download returned HTTP 404.',
    });
  });

  it('throws MODEL_CORRUPT when a required file is missing after extraction', async () => {
    // The archive itself verifies, but `model.onnx` never lands on disk.
    jest.mocked(FileSystem.getInfoAsync).mockImplementation(async (path: string) => {
      if (String(path).endsWith('model.onnx')) {
        return { exists: false, uri: String(path), isDirectory: false };
      }
      return {
        exists: true,
        size: 67_222_458,
        uri: String(path),
        isDirectory: false,
        modificationTime: 0,
      };
    });

    await expect(manager.installPack(PACK_ID, () => {})).rejects.toMatchObject({
      code: 'MODEL_CORRUPT',
    });
  });
});
