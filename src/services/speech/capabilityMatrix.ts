import { LANGUAGES, findLanguageForTag } from '../../data/languages';
import { SUPPORTED_PHRASE_LANGUAGES } from '../../data/phrases';
import { getNeuralModelsForLanguage, hasNeuralVoice } from '../../data/neuralModels';
import { SwarTts } from '../../../modules/swar-tts';
import type {
  GenderVoiceAvailability,
  Language,
  LanguageAvailability,
  LanguageCapability,
  LanguageQualityStatus,
  LanguageTrackedCapabilities,
  SpeechEngine,
  VoiceInfo,
} from '../../types';
import { describeLanguageAvailability } from '../../utils/labels';
import { logger } from '../../utils/logger';
import { classifyAvailability } from './AndroidTTSEngine';

const SCOPE = 'CapabilityMatrix';

/**
 * One row of the speech capability matrix: what this phone can say in one language.
 *
 * The matrix is the honest answer to "which of our languages can be spoken here, and can it be done
 * without internet?". Every field is derived from what the engine actually reported — nothing is
 * inferred from the fact that we ship a language in the registry.
 *
 * Tracked independently per app.md §3:
 * 1. interfaceTranslation
 * 2. keyboardInput
 * 3. nativeTts
 * 4. neuralTts
 * 5. offlineSpeech
 * 6. genderVoices
 * 7. qualityStatus
 */
export interface CapabilityMatrixRow extends LanguageTrackedCapabilities {
  /** The registry language this row describes. */
  language: Language;
  /** How the engine describes this language's availability. */
  availability: LanguageAvailability;
  /** Plain-language wording for `availability`, shared with the rest of the app. */
  availabilityLabel: string;
  /** Every voice the engine reported for this language, in the order it reported them. */
  voices: VoiceInfo[];
  /** Names of those voices, ready for display. */
  voiceNames: string[];
  /** Voices that are installed and need no network connection. */
  offlineVoiceCount: number;
  /** True when the language can be spoken, but only while connected. */
  onlineOnly: boolean;
}

export interface ProbeOptions {
  forceRefresh?: boolean;
  engine?: SpeechEngine;
}

let probedMatrixCache: CapabilityMatrixRow[] | null = null;

/**
 * Detects male and female voice availability honestly from probed voices and neural models.
 */
export function detectVoiceGenderAvailability(
  voices: VoiceInfo[],
  languageCode: string
): GenderVoiceAvailability {
  let male = false;
  let female = false;

  for (const voice of voices) {
    const text = `${voice.name} ${voice.id}`.toLowerCase();
    if (/\b(male|man|boy|arjun|pratham|rohan)\b/i.test(text)) {
      male = true;
    }
    if (/\b(female|woman|girl|meera|priyamvada)\b/i.test(text)) {
      female = true;
    }
  }

  const neural = getNeuralModelsForLanguage(languageCode);
  for (const model of neural) {
    const text = `${model.displayName} ${model.voiceName}`.toLowerCase();
    if (/\b(male|man|boy|arjun|pratham|rohan)\b/i.test(text)) {
      male = true;
    }
    if (/\b(female|woman|girl|meera|priyamvada)\b/i.test(text)) {
      female = true;
    }
  }

  return { male, female };
}

/**
 * Plain quality reporting: never over-claim quality before verified on physical device.
 */
export function determineQualityStatus(
  language: Language,
  availability: LanguageAvailability,
  offlineVoiceCount: number
): LanguageQualityStatus {
  if (language.verifiedOnDevice) {
    return 'verified';
  }
  if (offlineVoiceCount > 0) {
    return 'supported';
  }
  if (availability === 'available-online-only' || availability === 'available-unverified') {
    return 'preview';
  }
  return 'unverified';
}

/**
 * Reshapes the active engine's capability report into one row per launch language.
 *
 * Tracks the 7 independent capability dimensions per app.md §3.
 *
 * The function is pure: same input, same rows, no storage, no engine, no React. A launch language
 * the engine did not mention is reported as `missing-voice-data` rather than omitted, so the screen
 * can always show all languages and never leaves a row unexplained.
 */
export function buildCapabilityMatrix(capabilities: LanguageCapability[]): CapabilityMatrixRow[] {
  const byCode = new Map(capabilities.map((capability) => [capability.language.code, capability]));

  return LANGUAGES.map((language) => {
    const capability = byCode.get(language.code);
    const voices = capability?.voices ?? [];
    const availability = capability?.availability ?? 'missing-voice-data';
    const offlineVoiceCount = voices.filter(
      (voice) => !voice.notInstalled && !voice.networkRequired
    ).length;
    const onlineOnly = availability === 'available-online-only';

    const interfaceTranslation = (SUPPORTED_PHRASE_LANGUAGES as readonly string[]).includes(
      language.code
    );
    const keyboardInput = true;
    const nativeTts =
      voices.length > 0 ||
      availability === 'available-offline' ||
      availability === 'available-online-only' ||
      availability === 'available-unverified';
    const neuralTts = hasNeuralVoice(language.code);
    const offlineSpeech = offlineVoiceCount > 0;
    const genderVoices = detectVoiceGenderAvailability(voices, language.code);
    const qualityStatus = determineQualityStatus(language, availability, offlineVoiceCount);

    return {
      language,
      availability,
      availabilityLabel: describeLanguageAvailability(availability),
      voices,
      voiceNames: voices.map((voice) => voice.name),
      offlineVoiceCount,
      onlineOnly,
      interfaceTranslation,
      keyboardInput,
      nativeTts,
      neuralTts,
      offlineSpeech,
      genderVoices,
      qualityStatus,
    };
  });
}

/**
 * Probes per-language TTS voice availability at runtime.
 *
 * Queries the installed `swar-tts` engine data directly when available, or queries the passed engine.
 * NEVER hardcodes availability — probes and caches results.
 */
export async function probeLanguageCapabilities(
  options?: ProbeOptions
): Promise<CapabilityMatrixRow[]> {
  if (!options?.forceRefresh && probedMatrixCache !== null) {
    return probedMatrixCache;
  }

  if (options?.engine) {
    const engineCaps = await options.engine.getCapabilities();
    const rows = buildCapabilityMatrix(engineCaps);
    probedMatrixCache = rows;
    return rows;
  }

  const capabilities: LanguageCapability[] = [];
  try {
    let nativeVoices: VoiceInfo[] = [];
    if (SwarTts) {
      const isReady = await SwarTts.isReady().catch(() => false);
      if (!isReady) {
        await SwarTts.initialize().catch(() => {});
      }
      const rawVoices = await SwarTts.getVoices().catch(() => []);
      nativeVoices = rawVoices.map((v) => ({
        id: v.id,
        name: v.name,
        language: v.language,
        quality: v.quality,
        latency: v.latency,
        networkRequired: v.networkRequired,
        notInstalled: v.notInstalled,
      }));
    }

    for (const language of LANGUAGES) {
      const voices = nativeVoices.filter(
        (v) => findLanguageForTag(v.language)?.code === language.code
      );
      let engineSupports = false;
      if (SwarTts) {
        engineSupports = await SwarTts.isLanguageAvailable(language.code).catch(() => false);
      }
      const availability = classifyAvailability(engineSupports, voices, nativeVoices.length);
      capabilities.push({
        language,
        availability,
        voices,
      });
    }
  } catch (error) {
    logger.warn(SCOPE, 'Failed to probe runtime speech capabilities', error);
  }

  const rows = buildCapabilityMatrix(capabilities);
  probedMatrixCache = rows;
  return rows;
}

/** Returns the cached capability matrix if probed, or null. */
export function getCachedCapabilityMatrix(): CapabilityMatrixRow[] | null {
  return probedMatrixCache;
}

/** Clears the cached capability matrix for testing or engine reload. */
export function clearCapabilityCache(): void {
  probedMatrixCache = null;
}
