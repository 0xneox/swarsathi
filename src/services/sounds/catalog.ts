import type { Ionicons } from '@expo/vector-icons';

/**
 * The sound types SwarSathi knows how to watch for.
 *
 * These are the household alert sounds from vision.md §2D. Each entry lists the AudioSet labels the
 * bundled YAMNet model can emit that should count as this sound. The mapping lives here - in
 * TypeScript, where it is unit-tested - rather than in the native module, so a future model or
 * adapter only has to report AudioSet labels.
 */
export type SoundTypeId =
  | 'doorbell'
  | 'knock'
  | 'alarm'
  | 'siren'
  | 'dog-bark'
  | 'crying-baby'
  | 'smoke-alarm';

/** How the on-screen alert is presented when this sound fires. */
export type AlertStyleId = 'banner' | 'banner-pulse' | 'fullscreen';

/** A vibration pattern id; the millisecond pattern lives in `settings.ts`. */
export type VibrationPatternId = 'single' | 'double' | 'long' | 'urgent';

export type SensitivityId = 'low' | 'medium' | 'high';

export interface SoundTypeDefinition {
  id: SoundTypeId;
  /** Short name shown in the UI. */
  label: string;
  /** One-line explanation of what the detector listens for. */
  description: string;
  /** Decorative icon; the label always carries the meaning. */
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * AudioSet labels (lower-cased substring match) that count as this sound. Order inside the
   * catalogue matters: `matchSoundType` returns the first type whose keywords match.
   */
  keywords: string[];
  defaultAlertStyle: AlertStyleId;
  defaultVibrationPattern: VibrationPatternId;
}

export const SOUND_TYPES: readonly SoundTypeDefinition[] = [
  {
    id: 'smoke-alarm',
    label: 'Smoke alarm',
    description: 'A smoke detector or fire alarm sounding.',
    icon: 'flame-outline',
    keywords: ['smoke detector', 'smoke alarm', 'fire alarm'],
    defaultAlertStyle: 'fullscreen',
    defaultVibrationPattern: 'urgent',
  },
  {
    id: 'siren',
    label: 'Siren',
    description: 'An emergency vehicle or warning siren.',
    icon: 'megaphone-outline',
    keywords: ['siren', 'ambulance', 'police car', 'fire engine', 'fire truck', 'civil defense'],
    defaultAlertStyle: 'fullscreen',
    defaultVibrationPattern: 'urgent',
  },
  {
    id: 'alarm',
    label: 'Alarm',
    description: 'An alarm clock, appliance alarm or car alarm.',
    icon: 'alarm-outline',
    keywords: ['alarm'],
    defaultAlertStyle: 'banner-pulse',
    defaultVibrationPattern: 'urgent',
  },
  {
    id: 'doorbell',
    label: 'Doorbell',
    description: 'A doorbell or bell ringing at the door.',
    icon: 'notifications-outline',
    keywords: [
      'doorbell',
      'bell',
      'door bell',
      'jingle bell',
      'church bell',
      'bicycle bell',
      'telephone bell',
      'tubular bells',
      'cowbell',
    ],
    defaultAlertStyle: 'banner',
    defaultVibrationPattern: 'double',
  },
  {
    id: 'knock',
    label: 'Knock',
    description: 'Someone knocking on a door or window.',
    icon: 'hand-left-outline',
    keywords: ['knock'],
    defaultAlertStyle: 'banner',
    defaultVibrationPattern: 'single',
  },
  {
    id: 'dog-bark',
    label: 'Dog barking',
    description: 'A dog barking or whining.',
    icon: 'paw-outline',
    keywords: ['dog', 'bark', 'canidae', 'whimper', 'growling', 'yip'],
    defaultAlertStyle: 'banner',
    defaultVibrationPattern: 'single',
  },
  {
    id: 'crying-baby',
    label: 'Crying baby',
    description: 'A baby or person crying.',
    icon: 'woman-outline',
    keywords: ['baby cry', 'infant cry', 'crying', 'cry', 'sob', 'wail', 'whimper'],
    defaultAlertStyle: 'banner-pulse',
    defaultVibrationPattern: 'long',
  },
] as const;

const SOUND_TYPE_BY_ID = new Map<SoundTypeId, SoundTypeDefinition>(
  SOUND_TYPES.map((definition) => [definition.id, definition])
);

export function getSoundType(id: SoundTypeId): SoundTypeDefinition {
  const found = SOUND_TYPE_BY_ID.get(id);
  if (!found) {
    // Every id in the union is in the catalogue; this only fails if the catalogue and the type
    // drift apart, which the unit tests catch.
    return SOUND_TYPES[0];
  }
  return found;
}

export const SOUND_TYPE_IDS: readonly SoundTypeId[] = SOUND_TYPES.map(
  (definition) => definition.id
);

/**
 * Maps a raw AudioSet label from the classifier to the sound type the user cares about.
 *
 * Matching is a case-insensitive substring test against each type's keyword list, evaluated in
 * catalogue order so the more specific types (smoke alarm, siren) win over generic ones
 * (`alarm`, `bell`). Returns `null` for labels that are not one of the tracked sounds - most of
 * the 521 AudioSet classes, like music or traffic, are deliberately ignored.
 */
export function matchSoundType(label: string): SoundTypeId | null {
  const normalized = label.toLowerCase();
  for (const definition of SOUND_TYPES) {
    for (const keyword of definition.keywords) {
      if (normalized.includes(keyword)) {
        return definition.id;
      }
    }
  }
  return null;
}
