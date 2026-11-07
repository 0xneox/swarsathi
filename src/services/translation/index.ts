import { RuleBasedTranslationEngine } from './RuleBasedTranslationEngine';
import { IndicTrans2Adapter } from './IndicTrans2Adapter';
import type { TranslationEngine, TranslationResult } from './types';
import type { InstalledPackRepository } from '../storage/packs';

export * from './types';
export * from './RuleBasedTranslationEngine';
export * from './IndicTrans2Adapter';

/**
 * Universal Translation Orchestrator.
 *
 * Checks rule-based / starter vocabulary first (instantaneous & deterministic),
 * and seamlessly routes to the IndicTrans2 neural pack if installed.
 * If neither can translate the open-ended text, reports the honest status.
 */
export class CompositeTranslationEngine implements TranslationEngine {
  readonly id = 'composite-translator';
  readonly displayName = 'SwarSathi Translation Layer';

  private readonly ruleEngine: RuleBasedTranslationEngine;
  private readonly neuralEngine: IndicTrans2Adapter;

  constructor(packRepository?: InstalledPackRepository | null) {
    this.ruleEngine = new RuleBasedTranslationEngine();
    this.neuralEngine = new IndicTrans2Adapter(packRepository);
  }

  async translate(
    text: string,
    source: string,
    target: string
  ): Promise<TranslationResult> {
    // 1. Try rule-based common phrases first
    const ruleResult = await this.ruleEngine.translate(text, source, target);
    if (!ruleResult.requiresPack) {
      return ruleResult;
    }

    // 2. Check if IndicTrans2 neural pack is installed
    const hasPack = await this.neuralEngine.isPackInstalled();
    if (hasPack) {
      return this.neuralEngine.translate(text, source, target);
    }

    // 3. Honest fallback to the pack requirement state
    return ruleResult;
  }
}

let defaultEngineInstance: TranslationEngine | null = null;

export function getDefaultTranslationEngine(
  packRepository?: InstalledPackRepository | null
): TranslationEngine {
  if (!defaultEngineInstance || packRepository) {
    defaultEngineInstance = new CompositeTranslationEngine(packRepository);
  }
  return defaultEngineInstance;
}

