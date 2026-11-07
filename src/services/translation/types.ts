/**
 * Translation service interfaces and contracts per vision.md §3.
 *
 * Designed as provider-independent adapters so the UI and messaging layers
 * never depend directly on a specific engine or model architecture.
 */

export interface TranslationResult {
  /** The original input text before translation. */
  originalText: string;
  /** The translated output text. */
  translatedText: string;
  /** BCP-47 or ISO language tag of the source text. */
  sourceLanguage: string;
  /** BCP-47 or ISO language tag of the target text. */
  targetLanguage: string;
  /** The identifier of the engine that produced this result. */
  engine: string;
  /** True when full translation could not be completed because a pack is required. */
  requiresPack?: boolean;
  /** Suggested pack identifier (e.g. IndicTrans2) when a pack is required. */
  packId?: string;
  /** Explanation or honest status notice for the user. */
  note?: string;
  /** Confidence classification of the result. */
  confidence?: 'exact' | 'rule' | 'fallback' | 'unavailable';
}

export interface TranslationEngine {
  readonly id: string;
  readonly displayName: string;

  /**
   * Translates text from source language to target language.
   *
   * Must never fail silently: if a language pair or phrase is unsupported without
   * a downloadable pack, it must return an honest status in TranslationResult.
   */
  translate(
    text: string,
    source: string,
    target: string
  ): Promise<TranslationResult>;
}

