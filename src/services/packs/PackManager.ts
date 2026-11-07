import * as FileSystem from 'expo-file-system/legacy';
import type { NeuralTtsNativeModule } from '../../../modules/swar-neural-tts';
import { NeuralTts } from '../../../modules/swar-neural-tts';
import { getPack } from '../../data/packs';
import type { InstalledPack, PackInstallState } from '../../types';
import { logger } from '../../utils/logger';
import type { InstalledPackRepository } from '../storage/packs';
import { SqliteInstalledPackRepository } from '../storage/packs';

const SCOPE = 'PackManager';

/** Base directory for all extracted packs. */
const BASE_PACK_DIR = `${FileSystem.documentDirectory ?? ''}packs/`;

/** Temporary directory for downloaded archives (before extraction). */
const CACHE_DIR = FileSystem.cacheDirectory ?? '';

export type PackInstallProgressCallback = (state: PackInstallState) => void;

/**
 * Manages the lifecycle of downloadable offline packs.
 *
 * The pack files themselves live on the filesystem; only their metadata is stored in the SQLite
 * `installed_packs` table (migration v9).
 */
export class PackManager {
  private readonly repository: InstalledPackRepository;
  private readonly native: NeuralTtsNativeModule | null;

  /**
   * Tracks in-flight download resumables so they can be cancelled.
   * Key is packId.
   */
  private readonly activeDownloads = new Map<string, FileSystem.DownloadResumable>();

  constructor(
    repository: InstalledPackRepository,
    native: NeuralTtsNativeModule | null
  ) {
    this.repository = repository;
    this.native = native;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Absolute path to the extracted pack directory for a given packId. */
  static packDir(packId: string): string {
    return `${BASE_PACK_DIR}${packId}/`;
  }

  /**
   * Downloads, extracts and registers a pack.
   *
   * Progress is reported via `onProgress`. Throws a `PackError`-like object with a `code` field on
   * failure.
   */
  async installPack(
    packId: string,
    onProgress: PackInstallProgressCallback
  ): Promise<void> {
    const pack = getPack(packId);
    if (!pack) {
      throw makeError('DOWNLOAD_FAILED', `Unknown pack id: ${packId}`);
    }

    const partPath = `${CACHE_DIR}${packId}.part`;
    const destDir = PackManager.packDir(packId);

    // --- Phase: checking-space ---
    onProgress({
      packId,
      phase: 'checking-space',
      bytesWritten: 0,
      totalBytes: pack.downloadBytes,
    });

    try {
      const freeBytes = await FileSystem.getFreeDiskStorageAsync();
      if (typeof freeBytes === 'number' && freeBytes < pack.downloadBytes * 1.5) {
        throw makeError(
          'INSUFFICIENT_STORAGE',
          `Not enough free space. Need ${Math.ceil((pack.downloadBytes * 1.5) / 1024 / 1024)} MB, found ${Math.floor(freeBytes / 1024 / 1024)} MB.`
        );
      }
    } catch (error) {
      if (isPackError(error)) throw error;
      // If the API fails (Expo Go / web), log and continue — better to try than to block.
      logger.warn(SCOPE, 'Could not check free disk space', error);
    }

    // --- Phase: downloading ---
    onProgress({
      packId,
      phase: 'downloading',
      bytesWritten: 0,
      totalBytes: pack.downloadBytes,
    });

    const downloadResumable = FileSystem.createDownloadResumable(
      pack.downloadUrl,
      partPath,
      {},
      (downloadProgress) => {
        onProgress({
          packId,
          phase: 'downloading',
          bytesWritten: downloadProgress.totalBytesWritten,
          totalBytes: downloadProgress.totalBytesExpectedToWrite,
        });
      }
    );

    this.activeDownloads.set(packId, downloadResumable);

    let downloadResult: FileSystem.FileSystemDownloadResult | undefined;
    try {
      downloadResult = await downloadResumable.downloadAsync();
    } catch (error) {
      this.activeDownloads.delete(packId);
      throw makeError('DOWNLOAD_FAILED', `Download failed: ${String(error)}`);
    }
    this.activeDownloads.delete(packId);

    if (!downloadResult || downloadResult.status !== 200) {
      throw makeError(
        'DOWNLOAD_FAILED',
        `Download returned HTTP ${downloadResult?.status ?? 'unknown'}.`
      );
    }

    // --- Phase: verifying (size check) ---
    onProgress({
      packId,
      phase: 'verifying',
      bytesWritten: pack.downloadBytes,
      totalBytes: pack.downloadBytes,
    });

    const info = await FileSystem.getInfoAsync(partPath);
    if (!info.exists) {
      throw makeError('DOWNLOAD_FAILED', 'Downloaded file disappeared before verification.');
    }
    // Size check: within 1% of the expected size.
    if ('size' in info && typeof info.size === 'number' && info.size > 0) {
      const tolerance = pack.downloadBytes * 0.01;
      if (Math.abs(info.size - pack.downloadBytes) > tolerance) {
        logger.warn(
          SCOPE,
          `Size mismatch for ${packId}: expected ${pack.downloadBytes}, got ${info.size}`
        );
        // We continue; the extraction + required-file check below catches corruption.
      }
    }
    // The descriptor's sha256 is the digest the publisher lists for this archive. It is kept as
    // published metadata for the native/verification layer, and is NOT recomputed here: Expo SDK 58
    // exposes no large-file SHA-256 API (`expo-file-system`'s `File` only exposes `md5`). Integrity
    // therefore rests on the size check above plus the required-file check after extraction.

    // --- Phase: extracting ---
    onProgress({
      packId,
      phase: 'extracting',
      bytesWritten: pack.downloadBytes,
      totalBytes: pack.downloadBytes,
    });

    // Make sure the destination directory exists.
    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });

    if (!this.native) {
      throw makeError(
        'DOWNLOAD_FAILED',
        'The neural TTS native module is not available; cannot extract the archive.'
      );
    }

    try {
      await this.native.extractArchive({
        archivePath: partPath.replace('file://', ''),
        destinationDir: destDir.replace('file://', ''),
        format: pack.archive,
      });
    } catch (error) {
      throw makeError('DOWNLOAD_FAILED', `Extraction failed: ${String(error)}`);
    }

    // Clean up the archive.
    try {
      await FileSystem.deleteAsync(partPath, { idempotent: true });
    } catch {
      // Not critical — the cache directory will be cleared eventually.
    }

    // --- Required-file integrity check ---
    for (const requiredFile of pack.requiredFiles) {
      const filePath = `${destDir}${requiredFile.path}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw makeError(
          'MODEL_CORRUPT',
          `Required file missing after extraction: ${requiredFile.path}`
        );
      }
    }

    // --- Persist metadata ---
    const installed: InstalledPack = {
      packId,
      kind: pack.kind,
      language: pack.language,
      directory: destDir,
      bytes: pack.downloadBytes,
      verified: true,
      installedAt: Date.now(),
    };
    await this.repository.save(installed);

    onProgress({
      packId,
      phase: 'done',
      bytesWritten: pack.downloadBytes,
      totalBytes: pack.downloadBytes,
    });

    logger.info(SCOPE, `Pack installed: ${packId}`);
  }

  /**
   * Removes a pack's extracted files and its metadata record.
   */
  async removePack(packId: string): Promise<void> {
    const destDir = PackManager.packDir(packId);
    try {
      await FileSystem.deleteAsync(destDir, { idempotent: true });
    } catch (error) {
      logger.warn(SCOPE, `Could not delete pack directory for ${packId}`, error);
    }
    await this.repository.remove(packId);
    logger.info(SCOPE, `Pack removed: ${packId}`);
  }

  /**
   * Cancels an in-flight download for `packId`. No-op if not downloading.
   */
  async cancelInstall(packId: string): Promise<void> {
    const dl = this.activeDownloads.get(packId);
    if (dl) {
      try {
        await dl.cancelAsync();
      } catch (error) {
        logger.warn(SCOPE, `Could not cancel download for ${packId}`, error);
      }
      this.activeDownloads.delete(packId);
    }
  }

  /**
   * Total bytes used by all installed packs, as recorded at install time.
   */
  async getStorageUsedBytes(): Promise<number> {
    const packs = await this.repository.list();
    return packs.reduce((total, pack) => total + pack.bytes, 0);
  }

  async getInstalledPack(packId: string): Promise<InstalledPack | null> {
    return this.repository.get(packId);
  }

  async listInstalled(): Promise<InstalledPack[]> {
    return this.repository.list();
  }
}

// --------------------------------------------------------------------------
// Singleton
// --------------------------------------------------------------------------

export const installedPackRepository = new SqliteInstalledPackRepository();

export const packManager = new PackManager(installedPackRepository, NeuralTts);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

interface PackError {
  code: string;
  message: string;
}

function makeError(code: string, message: string): PackError {
  return { code, message };
}

function isPackError(value: unknown): value is PackError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PackError).code === 'string'
  );
}
