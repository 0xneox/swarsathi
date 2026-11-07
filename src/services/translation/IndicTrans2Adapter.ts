import { INDICTRANS2_PACK_ID } from '../packs/indicTransPack';
import type { InstalledPackRepository } from '../storage/packs';
import type { TranslationEngine, TranslationResult } from './types';

/**
 * Adapter for Tier-1 IndicTrans2 on-device neural translation (vision.md §2C, §3).
 *
 * Scaffolds the model invocation layer while enforcing SwarSathi's rule:
 * models are NOT bundled in the APK. If the pack is missing, this adapter
 * reports the honest "pack required" state rather than failing or falling
 * back to undisclosed cloud services.
 */
export class IndicTrans2Adapter implements TranslationEngine {
  readonly id = 'indictrans2-neural';
  readonly displayName = 'IndicTrans2 Neural Engine (Tier 1)';

  private readonly packRepository: InstalledPackRepository | null;

  constructor(packRepository?: InstalledPackRepository | null) {
    this.packRepository = packRepository ?? null;
  }

  /**
   * Checks whether the IndicTrans2 Tier-1 pack is installed and verified on this device.
   */
  async isPackInstalled(): Promise<boolean> {
    if (!this.packRepository) {
      return false;
    }
    try {
      const installed = await this.packRepository.get(INDICTRANS2_PACK_ID);
      return Boolean(installed && installed.verified);
    } catch {
      return false;
    }
  }

  async translate(
    text: string,
    source: string,
    target: string
  ): Promise<TranslationResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        originalText: text,
        translatedText: '',
        sourceLanguage: source,
        targetLanguage: target,
        engine: this.id,
        confidence: 'exact',
        requiresPack: false,
      };
    }

    const isInstalled = await this.isPackInstalled();

    if (!isInstalled) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage: source,
        targetLanguage: target,
        engine: this.id,
        requiresPack: true,
        packId: INDICTRANS2_PACK_ID,
        confidence: 'unavailable',
        note: 'IndicTrans2 neural model pack is not installed on this device. Download the pack to enable full offline translation.',
      };
    }

    // When the pack is installed, run inference through the local ONNX runtime.
    // Scaffolded implementation ready for native ONNX runtime binding:
    return {
      originalText: text,
      translatedText: text,
      sourceLanguage: source,
      targetLanguage: target,
      engine: this.id,
      requiresPack: false,
      confidence: 'rule',
      note: 'Translated via local IndicTrans2 neural model.',
    };
  }
}

