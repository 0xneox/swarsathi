import type { LanguageCapability, VoiceGender, VoiceInfo, VoicePersonaId } from '../types';

/**
 * The seven voice personas.
 *
 * A persona is a named way of sounding, not a specific engine voice. Each one carries a suggested
 * speaking rate and pitch — the two controls every speech engine SwarSathi ships can honour — plus
 * a one-line description of who it is for. Voice *character* is resolved separately and honestly:
 * see `matchVoiceForGender`.
 *
 * Per the product brief these are intended characteristics, not guarantees: a persona is only ever
 * advertised for controls the active engine actually supports.
 */
export interface VoicePersona {
  id: VoicePersonaId;
  /** Short name shown on the picker card. */
  label: string;
  /** What the persona sounds like, in one line. */
  description: string;
  /** Who the persona is recommended for. */
  recommendedFor: string;
  /** Suggested speaking rate, 0.5x–2.0x, applied when the persona is chosen. */
  rate: number;
  /** Suggested pitch, 0.5–2.0, applied when the persona is chosen. */
  pitch: number;
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Warm, approachable and natural.',
    recommendedFor: 'Everyday conversations. The default recommendation.',
    rate: 1.0,
    pitch: 1.0,
  },
  {
    id: 'gentle',
    label: 'Gentle',
    description: 'Soft, reassuring and delicate.',
    recommendedFor: 'Comfortable personal communication.',
    rate: 0.9,
    pitch: 0.9,
  },
  {
    id: 'confident',
    label: 'Confident',
    description: 'Clear, assertive and composed.',
    recommendedFor: 'Expressing opinions and making requests.',
    rate: 1.0,
    pitch: 1.0,
  },
  {
    id: 'expressive',
    label: 'Expressive',
    description: 'More dynamic intonation and lively delivery.',
    recommendedFor: 'Storytelling and emotional expression.',
    rate: 1.05,
    pitch: 1.05,
  },
  {
    id: 'mature',
    label: 'Mature',
    description: 'Steady, measured and grounded.',
    recommendedFor: 'Users preferring a mature-sounding voice.',
    rate: 0.95,
    pitch: 0.95,
  },
  {
    id: 'youthful',
    label: 'Youthful',
    description: 'Light, energetic and contemporary.',
    recommendedFor: 'A younger conversational character.',
    rate: 1.0,
    pitch: 1.1,
  },
  {
    id: 'clear',
    label: 'Clear',
    description: 'Neutral, articulate and consistent pronunciation.',
    recommendedFor: 'Everyday accessibility and maximum intelligibility.',
    rate: 0.95,
    pitch: 1.0,
  },
];

const PERSONA_BY_ID = new Map<VoicePersonaId, VoicePersona>(
  VOICE_PERSONAS.map((persona) => [persona.id, persona])
);

/** The catalogue entry for a persona id, or `null` when the id is not one we ship. */
export function getVoicePersona(id: string | null | undefined): VoicePersona | null {
  if (!id) {
    return null;
  }
  return PERSONA_BY_ID.get(id as VoicePersonaId) ?? null;
}

/** Gender words a speech engine might embed in a voice name, per preference. */
const GENDER_NAME_PATTERNS: Record<Exclude<VoiceGender, 'any'>, RegExp> = {
  male: /\b(male|man|masculine|guy)\b/i,
  female: /\b(female|woman|feminine|gal)\b/i,
};

/**
 * Finds a voice whose *name* states the requested gender, for one language.
 *
 * This is deliberately conservative: Android voice names often carry no gender information at all,
 * and guessing would mean silently picking a voice the user did not choose. `null` therefore means
 * "no voice on this device advertises that gender" — the caller keeps the automatic choice and says
 * so, rather than pretending the preference was honoured.
 */
export function matchVoiceForGender(
  voices: VoiceInfo[],
  gender: VoiceGender
): VoiceInfo | null {
  if (gender === 'any') {
    return null;
  }
  const pattern = GENDER_NAME_PATTERNS[gender];
  return voices.find((voice) => pattern.test(voice.name)) ?? null;
}

/** The usable (installed, offline-capable) voices for one language in a capability report. */
export function offlineVoicesForLanguage(
  capabilities: LanguageCapability[],
  languageCode: string
): VoiceInfo[] {
  const capability = capabilities.find((entry) => entry.language.code === languageCode);
  return (capability?.voices ?? []).filter(
    (voice) => !voice.notInstalled && !voice.networkRequired
  );
}
