import type {
  CommunicationEntry,
  EmergencyMessage,
  FrequentMessage,
  HomeCardConfig,
  HomeCardEntry,
} from '../types';
import { normalizeForSpeech } from '../utils/text';
import {
  PHRASE_CATEGORY_LABELS,
  getBundledPhrase,
  resolvePhraseText,
  type BundledPhrase,
} from './phrases';

/**
 * The rapid-communication catalogue.
 *
 * Part 4 turns the Home screen into a board of one-tap messages. The wording is never duplicated
 * here: every quick card points at a phrase in the bundled library, so translations, the
 * "draft needs native review" disclosure and the offline guarantee all come from one place.
 *
 * Emergency messages are the one exception. They are short, fixed sentences that must be readable
 * at a glance and editable by the user, so they carry their own translations rather than borrowing
 * a phrase that says something slightly different.
 */

// region Quick communication cards

export interface QuickMessageDefinition {
  /** Stable card key, stored in SQLite. Never rename without a migration. */
  key: string;
  /** Short human label shown on the configuration screen. */
  label: string;
  /** Bundled phrase this card speaks. */
  phraseId: string;
}

/**
 * The cards a user can place on Home, in the order they are offered.
 *
 * These are the ten messages the Part 4 brief asks for; a user can hide or reorder them, but they
 * cannot type new ones here - that is what Saved Messages are for.
 */
export const QUICK_MESSAGE_CATALOGUE: QuickMessageDefinition[] = [
  { key: 'yes', label: 'Yes', phraseId: 'general-yes' },
  { key: 'no', label: 'No', phraseId: 'general-no' },
  { key: 'help', label: 'I need help', phraseId: 'emergency-help' },
  { key: 'pain', label: 'I am in pain', phraseId: 'medical-pain' },
  { key: 'water', label: 'I need water', phraseId: 'medical-water' },
  { key: 'food', label: 'I need food', phraseId: 'daily-food' },
  { key: 'bathroom', label: 'I need the bathroom', phraseId: 'daily-bathroom' },
  { key: 'wait', label: 'Please wait', phraseId: 'daily-wait' },
  { key: 'family', label: 'Call my family', phraseId: 'emergency-call-family' },
  { key: 'thanks', label: 'Thank you', phraseId: 'general-thanks' },
];

/** Every quick card key, in catalogue order. */
export const QUICK_MESSAGE_KEYS = QUICK_MESSAGE_CATALOGUE.map((definition) => definition.key);

/** The configuration a fresh install starts with: every card, in catalogue order. */
export function defaultHomeCardConfigs(): HomeCardConfig[] {
  return QUICK_MESSAGE_CATALOGUE.map((definition, index) => ({
    key: definition.key,
    sortOrder: index,
    enabled: true,
  }));
}

/**
 * Coerces stored configuration into a complete, ordered list.
 *
 * Storage is a boundary: a row can be missing (a build that shipped fewer cards), unknown (a card
 * that has since been removed) or duplicated. Every catalogue key is guaranteed to appear exactly
 * once, so the configuration screen can never lose a card or show one twice.
 */
export function normalizeHomeCardConfigs(stored: HomeCardConfig[]): HomeCardConfig[] {
  const known = new Set(QUICK_MESSAGE_KEYS);
  const byKey = new Map<string, HomeCardConfig>();
  for (const config of stored) {
    if (known.has(config.key) && !byKey.has(config.key)) {
      byKey.set(config.key, config);
    }
  }

  const configured = [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const seen = new Set(configured.map((config) => config.key));

  const complete = [...configured];
  // Missing keys are appended in catalogue order and left enabled, so an upgrade never hides a card
  // the user has always had.
  QUICK_MESSAGE_CATALOGUE.forEach((definition) => {
    if (!seen.has(definition.key)) {
      complete.push({ key: definition.key, sortOrder: complete.length, enabled: true });
    }
  });

  return complete.map((config, index) => ({
    key: config.key,
    sortOrder: index,
    enabled: config.enabled !== false,
  }));
}

/** Resolves one quick card for a language, or `null` when its phrase has left the library. */
export function resolveHomeCard(
  config: HomeCardConfig,
  language: string
): HomeCardEntry | null {
  const definition = QUICK_MESSAGE_CATALOGUE.find((entry) => entry.key === config.key);
  if (!definition) {
    return null;
  }
  const phrase: BundledPhrase | undefined = getBundledPhrase(definition.phraseId);
  if (!phrase) {
    return null;
  }
  return {
    key: definition.key,
    label: definition.label,
    text: resolvePhraseText(phrase, language),
    language,
    categoryLabel: PHRASE_CATEGORY_LABELS[phrase.category],
  };
}

/**
 * The cards to show on Home: enabled only, in the user's order, resolved for the language.
 *
 * A card whose phrase has disappeared is skipped rather than rendered blank, mirroring how
 * favourites behave.
 */
export function buildHomeCards(
  configs: HomeCardConfig[],
  language: string
): HomeCardEntry[] {
  return normalizeHomeCardConfigs(configs).flatMap((config) => {
    if (!config.enabled) {
      return [];
    }
    const entry = resolveHomeCard(config, language);
    return entry ? [entry] : [];
  });
}

// endregion

// region Emergency messages

export interface EmergencyMessageDefinition {
  /** Stable id, stored in SQLite. Never rename without a migration. */
  id: string;
  /** Canonical English wording. */
  text: string;
  /** Draft translations, keyed by BCP-47 tag. Same review status as the bundled phrase library. */
  translations: Record<string, string>;
}

/**
 * The Emergencies a user can speak with one tap.
 *
 * These never call anybody. SwarSathi only speaks the words aloud; the decision to dial or message
 * stays with the person listening.
 */
export const EMERGENCY_MESSAGE_CATALOGUE: EmergencyMessageDefinition[] = [
  {
    id: 'emergency-medical-help',
    text: 'I need medical help.',
    translations: {
      'ml-IN': 'എനിക്ക് വൈദ്യസഹായം വേണം.',
      'hi-IN': 'मुझे चिकित्सा सहायता चाहिए।',
      'ta-IN': 'எனக்கு மருத்துவ உதவி வேண்டும்.',
      'te-IN': 'నాకు వైద్య సహాయం కావాలి.',
      'kn-IN': 'ನನಗೆ ವೈದ್ಯಕೀಯ ಸಹಾಯ ಬೇಕು.',
    },
  },
  {
    id: 'emergency-call-ambulance',
    text: 'Please call an ambulance.',
    translations: {
      'ml-IN': 'ദയവായി ഒരു ആംബുലൻസ് വിളിക്കൂ.',
      'hi-IN': 'कृपया एम्बुलेंस बुलाइए।',
      'ta-IN': 'தயவுசெய்து ஒரு ஆம்புலன்ஸை அழையுங்கள்.',
      'te-IN': 'దయచేసి ఒక అంబులెన్స్ పిలవండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ಒಂದು ಆಂಬ್ಯುಲೆನ್ಸ್ ಕರೆಯಿರಿ.',
    },
  },
  {
    id: 'emergency-cannot-speak',
    text: 'I cannot speak.',
    translations: {
      'ml-IN': 'എനിക്ക് സംസാരിക്കാൻ കഴിയില്ല.',
      'hi-IN': 'मैं बोल नहीं सकता।',
      'ta-IN': 'என்னால் பேச முடியாது.',
      'te-IN': 'నేను మాట్లాడలేను.',
      'kn-IN': 'ನನಗೆ ಮಾತನಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.',
    },
  },
  {
    id: 'emergency-pain',
    text: 'I am in pain.',
    translations: {
      'ml-IN': 'എനിക്ക് വേദനയുണ്ട്.',
      'hi-IN': 'मुझे दर्द हो रहा है।',
      'ta-IN': 'எனக்கு வலி இருக்கிறது.',
      'te-IN': 'నాకు నొప్పిగా ఉంది.',
      'kn-IN': 'ನನಗೆ ನೋವಾಗುತ್ತಿದೆ.',
    },
  },
  {
    id: 'emergency-contact-family',
    text: 'Please contact my family.',
    translations: {
      'ml-IN': 'ദയവായി എന്റെ കുടുംബത്തെ ബന്ധപ്പെടുക.',
      'hi-IN': 'कृपया मेरे परिवार से संपर्क करें।',
      'ta-IN': 'தயவுசெய்து என் குடும்பத்தை தொடர்பு கொள்ளுங்கள்.',
      'te-IN': 'దయచేసి నా కుటుంబాన్ని సంప్రదించండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ನನ್ನ ಕುಟುಂಬವನ್ನು ಸಂಪರ್ಕಿಸಿ.',
    },
  },
  {
    id: 'emergency-immediate-assistance',
    text: 'I need immediate assistance.',
    translations: {
      'ml-IN': 'എനിക്ക് ഉടനടി സഹായം വേണം.',
      'hi-IN': 'मुझे तुरंत सहायता चाहिए।',
      'ta-IN': 'எனக்கு உடனடி உதவி வேண்டும்.',
      'te-IN': 'నాకు వెంటనే సహాయం కావాలి.',
      'kn-IN': 'ನನಗೆ ತಕ್ಷಣ ಸಹಾಯ ಬೇಕು.',
    },
  },
];

export const EMERGENCY_MESSAGE_IDS = EMERGENCY_MESSAGE_CATALOGUE.map(
  (definition) => definition.id
);

/** The canonical English wording for an emergency message id. */
export function getEmergencyDefinition(id: string): EmergencyMessageDefinition | undefined {
  return EMERGENCY_MESSAGE_CATALOGUE.find((definition) => definition.id === id);
}

/**
 * The wording to speak for an emergency message.
 *
 * Falls back to the canonical English rather than an empty string: silence is the one outcome an
 * emergency message cannot afford.
 */
export function resolveEmergencyText(
  definition: EmergencyMessageDefinition,
  language: string
): string {
  if (language === 'en-IN') {
    return definition.text;
  }
  const translation = definition.translations[language];
  return typeof translation === 'string' && translation.trim().length > 0
    ? translation
    : definition.text;
}

/**
 * Builds the emergency list for a language.
 *
 * `overrides` maps an id to user-edited wording; when one exists for the active language it wins,
 * because the user's own words are the ones they meant to say.
 */
export function buildEmergencyMessages(
  overrides: Map<string, string>,
  language: string
): EmergencyMessage[] {
  return EMERGENCY_MESSAGE_CATALOGUE.map((definition, index) => {
    const override = overrides.get(definition.id);
    return {
      id: definition.id,
      sortOrder: index,
      text: override ?? resolveEmergencyText(definition, language),
      language,
      edited: override !== undefined,
    };
  });
}

// endregion

// region Quick suggestions

/** The four parts of the day the Home screen offers suggestions for. */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** Maps a 24-hour clock hour onto the part of the day it belongs to. */
export function timeOfDayFor(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }
  if (hour >= 17 && hour < 22) {
    return 'evening';
  }
  return 'night';
}

/**
 * Three phrases offered above the editor, chosen for the time of day.
 *
 * These point at phrases in the bundled library rather than carrying their own wording, so the
 * translations, the offline guarantee and the "draft needs native review" disclosure all come from
 * the one place they already live.
 */
const QUICK_SUGGESTION_PHRASE_IDS: Record<TimeOfDay, readonly string[]> = {
  morning: ['general-hello', 'medical-water', 'daily-food'],
  afternoon: ['daily-food', 'medical-medication', 'daily-wait'],
  evening: ['general-thanks', 'daily-sleep', 'family-fine'],
  night: ['daily-sleep', 'medical-pain', 'emergency-help'],
};

export interface QuickSuggestion {
  id: string;
  text: string;
  categoryLabel: string;
}

/**
 * The suggestions to show for a language at a given hour.
 *
 * A suggestion whose phrase has left the library is skipped rather than rendered blank, so the list
 * can never show an empty chip.
 */
export function buildQuickSuggestions(language: string, hour: number): QuickSuggestion[] {
  return QUICK_SUGGESTION_PHRASE_IDS[timeOfDayFor(hour)].flatMap((id) => {
    const phrase = getBundledPhrase(id);
    return phrase
      ? [
          {
            id: phrase.id,
            text: resolvePhraseText(phrase, language),
            categoryLabel: PHRASE_CATEGORY_LABELS[phrase.category],
          },
        ]
      : [];
  });
}

// endregion

// region History helpers

/** Smallest and largest number of history rows a user may keep. */
export const HISTORY_LIMIT_MIN = 10;
export const HISTORY_LIMIT_MAX = 200;
export const HISTORY_LIMIT_STEP = 10;

/** Clamps a stored or user-chosen history limit into the supported range. */
export function clampHistoryLimit(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 50;
  }
  const stepped = Math.round(value / HISTORY_LIMIT_STEP) * HISTORY_LIMIT_STEP;
  return Math.min(HISTORY_LIMIT_MAX, Math.max(HISTORY_LIMIT_MIN, stepped));
}

/**
 * Language-aware identity of a spoken message.
 *
 * Two utterances with the same wording in different languages are counted separately: they are not
 * the same thing to say, and the frequent list must offer the right one back.
 */
export function communicationKey(text: string, language: string): string {
  return `${language}::${normalizeForSpeech(text).toLowerCase()}`;
}

/** Keeps the newest `limit` entries, preserving their order. */
export function trimHistory(
  entries: CommunicationEntry[],
  limit: number
): CommunicationEntry[] {
  const sorted = [...entries].sort((a, b) => b.spokenAt - a.spokenAt);
  return sorted.slice(0, clampHistoryLimit(limit));
}

/** Ranks the most frequently spoken messages; ties go to the most recently spoken. */
export function rankFrequent(entries: FrequentMessage[], limit = 10): FrequentMessage[] {
  return [...entries]
    .sort((a, b) => b.count - a.count || b.lastSpokenAt - a.lastSpokenAt)
    .slice(0, limit);
}

// endregion
