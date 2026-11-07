import { LANGUAGES } from '../../data/languages';
import type { Language, LanguageAvailability, LanguageCapability, VoiceInfo } from '../../types';
import { describeLanguageAvailability } from '../../utils/labels';

/**
 * One row of the speech capability matrix: what this phone can say in one language.
 *
 * The matrix is the honest answer to "which of our languages can be spoken here, and can it be done
 * without internet?". Every field is derived from what the engine actually reported — nothing is
 * inferred from the fact that we ship a language in the registry.
 */
export interface CapabilityMatrixRow {
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

/**
 * Reshapes the active engine's capability report into one row per launch language.
 *
 * ## Single-engine limitation, stated plainly
 *
 * The matrix reflects **one engine**: whatever `getCapabilities()` reported for the device. SwarSathi
 * ships two speech engines — the Android system engine and the optional offline neural engine — and
 * only the active one is ever probed. Neural-offline models are a separate catalogue: they are shown
 * on their own (see the "Available Voices" list) and are never probed here, because an uninstalled
 * model has no data to report and must not be advertised as if it were present.
 *
 * The function is pure: same input, same rows, no storage, no engine, no React. A launch language
 * the engine did not mention is reported as `missing-voice-data` rather than omitted, so the screen
 * can always show all six languages and never leaves a row unexplained.
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

    return {
      language,
      availability,
      availabilityLabel: describeLanguageAvailability(availability),
      voices,
      voiceNames: voices.map((voice) => voice.name),
      offlineVoiceCount,
      onlineOnly: availability === 'available-online-only',
    };
  });
}
