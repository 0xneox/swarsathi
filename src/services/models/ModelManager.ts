import * as FileSystem from 'expo-file-system/legacy';
import type { NeuralTtsNativeModule } from '../../../modules/swar-neural-tts';
import { NeuralTts } from '../../../modules/swar-neural-tts';
import { NEURAL_MODELS, getNeuralModel } from '../../data/neuralModels';
import type { InstalledModel, ModelInstallState } from '../../types';
import { logger } from '../../utils/logger';
import type { InstalledModelRepository } from '../storage/database';
import { SqliteInstalledModelRepository } from '../storage/database';

const SCOPE = 'ModelManager';

/** Base directory for all extracted voice models. */
const BASE_MODEL_DIR = `${FileSystem.documentDirectory ?? ''}neural-models/`;

/** Shared espeak-ng phonemiser data directory (required by every Piper voice). */
const ESPEAK_DATA_DIR = `${FileSystem.documentDirectory ?? ''}neural-shared/espeak-ng-data/`;

/** Temporary directory for downloaded archives (before extraction). */
const CACHE_DIR = FileSystem.cacheDirectory ?? '';

export type ModelInstallProgressCallback = (state: ModelInstallState) => void;

/**
 * Manages the lifecycle of downloadable offline voice models.
 *
 * The model files themselves live on the filesystem; only their metadata is stored
 * in the SQLite `installed_models` table (migration v3).
 */
export class ModelManager {
  private readonly repository: InstalledModelRepository;
  private readonly native: NeuralTtsNativeModule | null;

  /**
   * Tracks in-flight download resumables so they can be cancelled.
   * Key is modelId.
   */
  private readonly activeDownloads = new Map<
    string,
    FileSystem.DownloadResumable
  >();

  constructor(
    repository: InstalledModelRepository,
    native: NeuralTtsNativeModule | null
  ) {
    this.repository = repository;
    this.native = native;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Absolute path to the extracted model directory for a given modelId. */
  static modelDir(modelId: string): string {
    return `${BASE_MODEL_DIR}${modelId}/`;
  }

  /** Absolute path to the shared espeak-ng-data directory. */
  static espeakDataDir(): string {
    return ESPEAK_DATA_DIR;
  }

  /**
   * Downloads, extracts and registers a model.
   *
   * Progress is reported via `onProgress`. Throws a `SpeechError`-like object
   * with a `code` field on failure.
   */
  async installModel(
    modelId: string,
    onProgress: ModelInstallProgressCallback
  ): Promise<void> {
    const model = getNeuralModel(modelId);
    if (!model) {
      throw makeError('DOWNLOAD_FAILED', `Unknown model id: ${modelId}`);
    }

    const partPath = `${CACHE_DIR}${modelId}.part`;
    const destDir = ModelManager.modelDir(modelId);

    // --- Phase: checking-space ---
    onProgress({
      modelId,
      phase: 'checking-space',
      bytesWritten: 0,
      totalBytes: model.downloadBytes,
    });

    try {
      const freeBytes = await FileSystem.getFreeDiskStorageAsync();
      if (typeof freeBytes === 'number' && freeBytes < model.downloadBytes * 1.5) {
        throw makeError(
          'INSUFFICIENT_STORAGE',
          `Not enough free space. Need ${Math.ceil((model.downloadBytes * 1.5) / 1024 / 1024)} MB, found ${Math.floor(freeBytes / 1024 / 1024)} MB.`
        );
      }
    } catch (error) {
      if (isModelError(error)) throw error;
      // If the API fails (Expo Go / web), log and continue — better to try than to block.
      logger.warn(SCOPE, 'Could not check free disk space', error);
    }

    // --- Phase: downloading ---
    onProgress({
      modelId,
      phase: 'downloading',
      bytesWritten: 0,
      totalBytes: model.downloadBytes,
    });

    const downloadResumable = FileSystem.createDownloadResumable(
      model.downloadUrl,
      partPath,
      {},
      (downloadProgress) => {
        onProgress({
          modelId,
          phase: 'downloading',
          bytesWritten: downloadProgress.totalBytesWritten,
          totalBytes: downloadProgress.totalBytesExpectedToWrite,
        });
      }
    );

    this.activeDownloads.set(modelId, downloadResumable);

    let downloadResult: FileSystem.FileSystemDownloadResult | undefined;
    try {
      downloadResult = await downloadResumable.downloadAsync();
    } catch (error) {
      this.activeDownloads.delete(modelId);
      throw makeError('DOWNLOAD_FAILED', `Download failed: ${String(error)}`);
    }
    this.activeDownloads.delete(modelId);

    if (!downloadResult || downloadResult.status !== 200) {
      throw makeError(
        'DOWNLOAD_FAILED',
        `Download returned HTTP ${downloadResult?.status ?? 'unknown'}.`
      );
    }

    // --- Phase: verifying (size check) ---
    onProgress({
      modelId,
      phase: 'verifying',
      bytesWritten: model.downloadBytes,
      totalBytes: model.downloadBytes,
    });

    const info = await FileSystem.getInfoAsync(partPath);
    if (!info.exists) {
      throw makeError('DOWNLOAD_FAILED', 'Downloaded file disappeared before verification.');
    }
    // Size check: within 1% of the expected size.
    if ('size' in info && typeof info.size === 'number' && info.size > 0) {
      const tolerance = model.downloadBytes * 0.01;
      if (Math.abs(info.size - model.downloadBytes) > tolerance) {
        logger.warn(
          SCOPE,
          `Size mismatch for ${modelId}: expected ${model.downloadBytes}, got ${info.size}`
        );
        // We continue; the extraction + required-file check below catches corruption.
      }
    }

    // --- Phase: extracting ---
    onProgress({
      modelId,
      phase: 'extracting',
      bytesWritten: model.downloadBytes,
      totalBytes: model.downloadBytes,
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
        format: model.archive,
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
    for (const requiredFile of model.requiredFiles) {
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
    const installed: InstalledModel = {
      modelId,
      language: model.language,
      directory: destDir,
      bytes: model.downloadBytes,
      verified: true,
      installedAt: Date.now(),
    };
    await this.repository.save(installed);

    onProgress({
      modelId,
      phase: 'done',
      bytesWritten: model.downloadBytes,
      totalBytes: model.downloadBytes,
    });

    logger.info(SCOPE, `Model installed: ${modelId}`);
  }

  /**
   * Removes a model's extracted files and its metadata record.
   */
  async removeModel(modelId: string): Promise<void> {
    const destDir = ModelManager.modelDir(modelId);
    try {
      await FileSystem.deleteAsync(destDir, { idempotent: true });
    } catch (error) {
      logger.warn(SCOPE, `Could not delete model directory for ${modelId}`, error);
    }
    await this.repository.remove(modelId);
    logger.info(SCOPE, `Model removed: ${modelId}`);
  }

  /**
   * Cancels an in-flight download for `modelId`. No-op if not downloading.
   */
  async cancelInstall(modelId: string): Promise<void> {
    const dl = this.activeDownloads.get(modelId);
    if (dl) {
      try {
        await dl.cancelAsync();
      } catch (error) {
        logger.warn(SCOPE, `Could not cancel download for ${modelId}`, error);
      }
      this.activeDownloads.delete(modelId);
    }
  }

  /**
   * Total bytes used by all installed models, as recorded at install time.
   */
  async getStorageUsedBytes(): Promise<number> {
    const models = await this.repository.list();
    return models.reduce((total, model) => total + model.bytes, 0);
  }

  async getInstalledModel(modelId: string): Promise<InstalledModel | null> {
    return this.repository.get(modelId);
  }

  async listInstalled(): Promise<InstalledModel[]> {
    return this.repository.list();
  }
}

// --------------------------------------------------------------------------
// Singleton
// --------------------------------------------------------------------------

export const installedModelRepository = new SqliteInstalledModelRepository();

export const modelManager = new ModelManager(installedModelRepository, NeuralTts);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

interface ModelError {
  code: string;
  message: string;
}

function makeError(code: string, message: string): ModelError {
  return { code, message };
}

function isModelError(value: unknown): value is ModelError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ModelError).code === 'string'
  );
}

/** All catalogue models that have no install record and are therefore available to download. */
export function getAvailableModels(installed: InstalledModel[]): typeof NEURAL_MODELS {
  const installedIds = new Set(installed.map((m) => m.modelId));
  return NEURAL_MODELS.filter((m) => !installedIds.has(m.id));
}
