import type {
  CustomMessage,
  Favourite,
  FavouriteEntry,
  Phrase,
  PhraseCategoryId,
} from '../types';

/**
 * The bundled phrase library.
 *
 * This file is the canonical source of SwarSathi's starter vocabulary. It is bundled into the
 * application binary (no network fetch, no cloud service) and seeded into the on-device database on
 * first run, so the phrases are available offline from the very first launch.
 *
 * ## Translation status - read this before shipping
 *
 * Every non-English string below is a **draft written for this codebase and has not been reviewed
 * by a native speaker**. `TRANSLATION_REVIEW_STATUS` records that fact, the Quick Phrases screen
 * shows it to the user, and the README documents it. Do not remove that disclosure until a native
 * speaker has reviewed each language, because a wrong translation in an AAC device is worse than
 * no translation at all: it makes the user say something they did not mean.
 *
 * The English strings are treated as the canonical meaning; `resolvePhraseText` falls back to them
 * when a translation is missing, so the app can never speak an empty phrase.
 */

/** How far the bundled translations have been verified. */
export const TRANSLATION_REVIEW_STATUS = 'draft-needs-native-review' as const;

/**
 * True once a native speaker has reviewed every non-English translation.
 *
 * Typed as `boolean` on purpose: the screens read it to decide whether to warn the user that the
 * wording is a draft, and keeping it wide stops a literal-type comparison that TypeScript would
 * reject as having no overlap.
 */
export const TRANSLATIONS_REVIEWED: boolean = false;

/**
 * Revision of the bundled library.
 *
 * Bump this whenever phrases are added, removed or reworded. The database seeding step compares it
 * with the value stored on the device and re-seeds when they differ, so a user who installs an
 * update receives any new starter phrases without losing their own data.
 */
export const PHRASE_LIBRARY_VERSION = 1;

export interface PhraseCategory {
  id: PhraseCategoryId;
  /** English label shown in the category filter. */
  label: string;
  /** One-line explanation used as the screen-reader description. */
  description: string;
}

/** Category order shown in the UI: the most urgent vocabulary comes first. */
export const PHRASE_CATEGORIES: PhraseCategory[] = [
  {
    id: 'emergency',
    label: 'Emergency',
    description: 'Asking for urgent help.',
  },
  {
    id: 'medical',
    label: 'Medical',
    description: 'Talking to a doctor, nurse or chemist.',
  },
  {
    id: 'daily-needs',
    label: 'Daily Needs',
    description: 'Everyday things like food, water and the bathroom.',
  },
  {
    id: 'personal-care',
    label: 'Personal Care',
    description: 'Asking for help with washing, dressing and comfort.',
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Words for the people closest to you.',
  },
  {
    id: 'travel',
    label: 'Travel',
    description: 'Getting around, tickets and directions.',
  },
  {
    id: 'banking',
    label: 'Banking',
    description: 'Money, accounts and cards.',
  },
  {
    id: 'general',
    label: 'General Conversation',
    description: 'Polite everyday words.',
  },
];

export const PHRASE_CATEGORY_LABELS: Record<PhraseCategoryId, string> = PHRASE_CATEGORIES.reduce(
  (labels, category) => {
    labels[category.id] = category.label;
    return labels;
  },
  {} as Record<PhraseCategoryId, string>
);

export function getPhraseCategory(id: PhraseCategoryId): PhraseCategory | undefined {
  return PHRASE_CATEGORIES.find((category) => category.id === id);
}

/** Resolves a stored category string back to a known category id, defaulting to `general`. */
export function coercePhraseCategory(value: string): PhraseCategoryId {
  return PHRASE_CATEGORIES.some((category) => category.id === value)
    ? (value as PhraseCategoryId)
    : 'general';
}

/** Languages every bundled phrase is translated into, in display order. */
export const SUPPORTED_PHRASE_LANGUAGES = ['en-IN', 'ml-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN'] as const;

export interface BundledPhrase {
  /** Logical key, shared by all language variants. */
  id: string;
  category: PhraseCategoryId;
  /** Canonical English text. Also the fallback for any missing translation. */
  text: string;
  /**
   * Overrides keyed by BCP-47 tag. English is intentionally absent: `resolvePhraseText` returns
   * `text` for `en-IN`, so the canonical wording is written down exactly once.
   */
  translations: Partial<Record<(typeof SUPPORTED_PHRASE_LANGUAGES)[number], string>>;
}

export const BUNDLED_PHRASES: BundledPhrase[] = [
  // region Emergency
  {
    id: 'emergency-help',
    category: 'emergency',
    text: 'Please help me.',
    translations: {
      'ml-IN': 'ദയവായി എന്നെ സഹായിക്കൂ.',
      'hi-IN': 'कृपया मेरी मदद करें।',
      'ta-IN': 'தயவுசெய்து எனக்கு உதவுங்கள்.',
      'te-IN': 'దయచేసి నాకు సహాయం చేయండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ನನಗೆ ಸಹಾಯ ಮಾಡಿ.',
    },
  },
  {
    id: 'emergency-ambulance',
    category: 'emergency',
    text: 'Call an ambulance.',
    translations: {
      'ml-IN': 'ഒരു ആംബുലൻസ് വിളിക്കൂ.',
      'hi-IN': 'एम्बुलेंस बुलाइए।',
      'ta-IN': 'ஒரு ஆம்புலன்ஸை அழையுங்கள்.',
      'te-IN': 'ఒక అంబులెన్స్ పిలవండి.',
      'kn-IN': 'ಒಂದು ಆಂಬ್ಯುಲೆನ್ಸ್ ಕರೆಯಿರಿ.',
    },
  },
  {
    id: 'emergency-call-family',
    category: 'emergency',
    text: 'Call my family.',
    translations: {
      'ml-IN': 'എന്റെ കുടുംബത്തെ വിളിക്കൂ.',
      'hi-IN': 'मेरे परिवार को बुलाइए।',
      'ta-IN': 'என் குடும்பத்தை அழையுங்கள்.',
      'te-IN': 'నా కుటుంబాన్ని పిలవండి.',
      'kn-IN': 'ನನ್ನ ಕುಟುಂಬವನ್ನು ಕರೆಯಿರಿ.',
    },
  },
  {
    id: 'emergency-breathing',
    category: 'emergency',
    text: 'I am having difficulty breathing.',
    translations: {
      'ml-IN': 'എനിക്ക് ശ്വസിക്കാൻ ബുദ്ധിമുട്ടുണ്ട്.',
      'hi-IN': 'मुझे सांस लेने में तकलीफ हो रही है।',
      'ta-IN': 'எனக்கு மூச்சு விட சிரமமாக உள்ளது.',
      'te-IN': 'నాకు శ్వాస తీసుకోవడం కష్టంగా ఉంది.',
      'kn-IN': 'ನನಗೆ ಉಸಿರಾಡಲು ಕಷ್ಟವಾಗುತ್ತಿದೆ.',
    },
  },
  {
    id: 'emergency-this-is-emergency',
    category: 'emergency',
    text: 'This is an emergency.',
    translations: {
      'ml-IN': 'ഇത് ഒരു അടിയന്തിരാവസ്ഥയാണ്.',
      'hi-IN': 'यह एक आपातकाल है।',
      'ta-IN': 'இது ஒரு அவசரநிலை.',
      'te-IN': 'ఇది ఒక అత్యవసర పరిస్థితి.',
      'kn-IN': 'ಇದು ಒಂದು ತುರ್ತು ಪರಿಸ್ಥಿತಿ.',
    },
  },
  {
    id: 'emergency-police',
    category: 'emergency',
    text: 'Call the police.',
    translations: {
      'ml-IN': 'പോലീസിനെ വിളിക്കൂ.',
      'hi-IN': 'पुलिस को बुलाइए।',
      'ta-IN': 'காவல்துறையை அழையுங்கள்.',
      'te-IN': 'పోలీసులను పిలవండి.',
      'kn-IN': 'ಪೊಲೀಸರನ್ನು ಕರೆಯಿರಿ.',
    },
  },
  // endregion

  // region Medical
  {
    id: 'medical-pain',
    category: 'medical',
    text: 'I am experiencing pain.',
    translations: {
      'ml-IN': 'എനിക്ക് വേദന അനുഭവപ്പെടുന്നു.',
      'hi-IN': 'मुझे दर्द हो रहा है।',
      'ta-IN': 'எனக்கு வலி இருக்கிறது.',
      'te-IN': 'నాకు నొప్పిగా ఉంది.',
      'kn-IN': 'ನನಗೆ ನೋವಾಗುತ್ತಿದೆ.',
    },
  },
  {
    id: 'medical-doctor',
    category: 'medical',
    text: 'I need a doctor.',
    translations: {
      'ml-IN': 'എനിക്ക് ഒരു ഡോക്ടറെ വേണം.',
      'hi-IN': 'मुझे एक डॉक्टर की जरूरत है।',
      'ta-IN': 'எனக்கு ஒரு மருத்துவர் தேவை.',
      'te-IN': 'నాకు ఒక వైద్యుడు కావాలి.',
      'kn-IN': 'ನನಗೆ ಒಬ್ಬ ವೈದ್ಯರು ಬೇಕು.',
    },
  },
  {
    id: 'medical-explain',
    category: 'medical',
    text: 'Please explain the treatment.',
    translations: {
      'ml-IN': 'ചികിത്സയെക്കുറിച്ച് ദയവായി വിശദീകരിക്കുക.',
      'hi-IN': 'कृपया इलाज के बारे में समझाइए।',
      'ta-IN': 'சிகிச்சையைப் பற்றி தயவுசெய்து விளக்குங்கள்.',
      'te-IN': 'చికిత్స గురించి దయచేసి వివరించండి.',
      'kn-IN': 'ಚಿಕಿತ್ಸೆಯ ಬಗ್ಗೆ ದಯವಿಟ್ಟು ವಿವರಿಸಿ.',
    },
  },
  {
    id: 'medical-cannot-speak',
    category: 'medical',
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
    id: 'medical-water',
    category: 'medical',
    text: 'Please give me some water.',
    translations: {
      'ml-IN': 'ദയവായി എനിക്ക് കുറച്ച് വെള്ളം തരൂ.',
      'hi-IN': 'कृपया मुझे थोड़ा पानी दीजिए।',
      'ta-IN': 'தயவுசெய்து எனக்கு கொஞ்சம் தண்ணீர் கொடுங்கள்.',
      'te-IN': 'దయచేసి నాకు కొంచెం నీళ్లు ఇవ్వండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ನನಗೆ ಸ್ವಲ್ಪ ನೀರು ಕೊಡಿ.',
    },
  },
  {
    id: 'medical-medication',
    category: 'medical',
    text: 'I need my medication.',
    translations: {
      'ml-IN': 'എനിക്ക് എന്റെ മരുന്ന് വേണം.',
      'hi-IN': 'मुझे मेरी दवा चाहिए।',
      'ta-IN': 'எனக்கு என் மருந்து வேண்டும்.',
      'te-IN': 'నాకు నా మందు కావాలి.',
      'kn-IN': 'ನನಗೆ ನನ್ನ ಔಷಧಿ ಬೇಕು.',
    },
  },
  {
    id: 'medical-allergic',
    category: 'medical',
    text: 'I am allergic to some medicines.',
    translations: {
      'ml-IN': 'ചില മരുന്നുകളോട് എനിക്ക് അലർജിയുണ്ട്.',
      'hi-IN': 'मुझे कुछ दवाओं से एलर्जी है।',
      'ta-IN': 'எனக்கு சில மருந்துகளால் ஒவ்வாமை உள்ளது.',
      'te-IN': 'నాకు కొన్ని మందులతో అలర్జీ ఉంది.',
      'kn-IN': 'ನನಗೆ ಕೆಲವು ಔಷಧಿಗಳಿಂದ ಅಲರ್ಜಿ ಇದೆ.',
    },
  },
  // endregion

  // region Daily Needs
  {
    id: 'daily-food',
    category: 'daily-needs',
    text: 'I need food.',
    translations: {
      'ml-IN': 'എനിക്ക് ഭക്ഷണം വേണം.',
      'hi-IN': 'मुझे खाना चाहिए।',
      'ta-IN': 'எனக்கு உணவு வேண்டும்.',
      'te-IN': 'నాకు ఆహారం కావాలి.',
      'kn-IN': 'ನನಗೆ ಊಟ ಬೇಕು.',
    },
  },
  {
    id: 'daily-thirsty',
    category: 'daily-needs',
    text: 'I am thirsty.',
    translations: {
      'ml-IN': 'എനിക്ക് ദാഹിക്കുന്നു.',
      'hi-IN': 'मुझे प्यास लगी है।',
      'ta-IN': 'எனக்கு தாகம் இருக்கிறது.',
      'te-IN': 'నాకు దాహం వేస్తోంది.',
      'kn-IN': 'ನನಗೆ ಬಾಯಾರಿಕೆ ಆಗುತ್ತಿದೆ.',
    },
  },
  {
    id: 'daily-bathroom',
    category: 'daily-needs',
    text: 'I need to use the bathroom.',
    translations: {
      'ml-IN': 'എനിക്ക് ശൗചാലയം ഉപയോഗിക്കണം.',
      'hi-IN': 'मुझे शौचालय जाना है।',
      'ta-IN': 'எனக்கு கழிவறை செல்ல வேண்டும்.',
      'te-IN': 'నాకు మరుగుదొడ్డి వెళ్లాలి.',
      'kn-IN': 'ನನಗೆ ಶೌಚಾಲಯಕ್ಕೆ ಹೋಗಬೇಕು.',
    },
  },
  {
    id: 'daily-uncomfortable',
    category: 'daily-needs',
    text: 'I am feeling uncomfortable.',
    translations: {
      'ml-IN': 'എനിക്ക് അസ്വസ്ഥത അനുഭവപ്പെടുന്നു.',
      'hi-IN': 'मुझे असहज महसूस हो रहा है।',
      'ta-IN': 'எனக்கு அசௌகரியமாக உள்ளது.',
      'te-IN': 'నాకు అసౌకర్యంగా ఉంది.',
      'kn-IN': 'ನನಗೆ ಅಸ್ವಸ್ಥವೆನಿಸುತ್ತಿದೆ.',
    },
  },
  {
    id: 'daily-wait',
    category: 'daily-needs',
    text: 'Please wait.',
    translations: {
      'ml-IN': 'ദയവായി കാത്തിരിക്കൂ.',
      'hi-IN': 'कृपया रुकिए।',
      'ta-IN': 'தயவுசெய்து காத்திருங்கள்.',
      'te-IN': 'దయచేసి వేచి ఉండండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ಕಾಯಿರಿ.',
    },
  },
  {
    id: 'daily-sleep',
    category: 'daily-needs',
    text: 'I want to sleep.',
    translations: {
      'ml-IN': 'എനിക്ക് ഉറങ്ങണം.',
      'hi-IN': 'मुझे सोना है।',
      'ta-IN': 'எனக்கு தூங்க வேண்டும்.',
      'te-IN': 'నాకు నిద్ర పోవాలి.',
      'kn-IN': 'ನನಗೆ ಮಲಗಬೇಕು.',
    },
  },
  // endregion

  // region Personal Care
  {
    id: 'care-bath',
    category: 'personal-care',
    text: 'I need help to take a bath.',
    translations: {
      'ml-IN': 'കുളിക്കാൻ എനിക്ക് സഹായം വേണം.',
      'hi-IN': 'मुझे नहाने में मदद चाहिए।',
      'ta-IN': 'எனக்கு குளிக்க உதவி வேண்டும்.',
      'te-IN': 'నాకు స్నానం చేయడానికి సహాయం కావాలి.',
      'kn-IN': 'ನನಗೆ ಸ್ನಾನ ಮಾಡಲು ಸಹಾಯ ಬೇಕು.',
    },
  },
  {
    id: 'care-clothes',
    category: 'personal-care',
    text: 'I need help to change my clothes.',
    translations: {
      'ml-IN': 'വസ്ത്രം മാറാൻ എനിക്ക് സഹായം വേണം.',
      'hi-IN': 'मुझे कपड़े बदलने में मदद चाहिए।',
      'ta-IN': 'எனக்கு உடை மாற்ற உதவி வேண்டும்.',
      'te-IN': 'నాకు బట్టలు మార్చుకోవడానికి సహాయం కావాలి.',
      'kn-IN': 'ನನಗೆ ಬಟ್ಟೆ ಬದಲಾಯಿಸಲು ಸಹಾಯ ಬೇಕು.',
    },
  },
  {
    id: 'care-wash-hands',
    category: 'personal-care',
    text: 'I want to wash my hands.',
    translations: {
      'ml-IN': 'എനിക്ക് കൈ കഴുകണം.',
      'hi-IN': 'मुझे हाथ धोने हैं।',
      'ta-IN': 'எனக்கு கை கழுவ வேண்டும்.',
      'te-IN': 'నాకు చేతులు కడుక్కోవాలి.',
      'kn-IN': 'ನನಗೆ ಕೈ ತೊಳೆಯಬೇಕು.',
    },
  },
  {
    id: 'care-teeth',
    category: 'personal-care',
    text: 'Please help me brush my teeth.',
    translations: {
      'ml-IN': 'ദയവായി പല്ല് തേക്കാൻ സഹായിക്കൂ.',
      'hi-IN': 'कृपया मुझे दाँत साफ करने में मदद करें।',
      'ta-IN': 'தயவுசெய்து பல் துலக்க உதவுங்கள்.',
      'te-IN': 'దయచేసి పళ్లు తోముకోవడానికి సహాయం చేయండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ಹಲ್ಲುಜ್ಜಲು ಸಹಾಯ ಮಾಡಿ.',
    },
  },
  {
    id: 'care-hot',
    category: 'personal-care',
    text: 'I am feeling hot.',
    translations: {
      'ml-IN': 'എനിക്ക് ചൂട് അനുഭവപ്പെടുന്നു.',
      'hi-IN': 'मुझे गर्मी लग रही है।',
      'ta-IN': 'எனக்கு வெப்பமாக உள்ளது.',
      'te-IN': 'నాకు వేడిగా ఉంది.',
      'kn-IN': 'ನನಗೆ ಬಿಸಿಯಾಗುತ್ತಿದೆ.',
    },
  },
  {
    id: 'care-cold',
    category: 'personal-care',
    text: 'I am feeling cold.',
    translations: {
      'ml-IN': 'എനിക്ക് തണുപ്പ് അനുഭവപ്പെടുന്നു.',
      'hi-IN': 'मुझे ठंड लग रही है।',
      'ta-IN': 'எனக்கு குளிராக உள்ளது.',
      'te-IN': 'నాకు చలిగా ఉంది.',
      'kn-IN': 'ನನಗೆ ಚಳಿಯಾಗುತ್ತಿದೆ.',
    },
  },
  // endregion

  // region Family
  {
    id: 'family-love',
    category: 'family',
    text: 'I love you.',
    translations: {
      'ml-IN': 'ഞാൻ നിന്നെ സ്നേഹിക്കുന്നു.',
      'hi-IN': 'मैं तुमसे प्यार करता हूँ।',
      'ta-IN': 'நான் உன்னை நேசிக்கிறேன்.',
      'te-IN': 'నేను నిన్ను ప్రేమిస్తున్నాను.',
      'kn-IN': 'ನಾನು ನಿನ್ನನ್ನು ಪ್ರೀತಿಸುತ್ತೇನೆ.',
    },
  },
  {
    id: 'family-call-mother',
    category: 'family',
    text: 'Please call my mother.',
    translations: {
      'ml-IN': 'ദയവായി എന്റെ അമ്മയെ വിളിക്കൂ.',
      'hi-IN': 'कृपया मेरी माँ को बुलाइए।',
      'ta-IN': 'தயவுசெய்து என் அம்மாவை அழையுங்கள்.',
      'te-IN': 'దయచేసి నా అమ్మను పిలవండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ನನ್ನ ಅಮ್ಮನನ್ನು ಕರೆಯಿರಿ.',
    },
  },
  {
    id: 'family-call-father',
    category: 'family',
    text: 'Please call my father.',
    translations: {
      'ml-IN': 'ദയവായി എന്റെ അച്ഛനെ വിളിക്കൂ.',
      'hi-IN': 'कृपया मेरे पिता को बुलाइए।',
      'ta-IN': 'தயவுசெய்து என் அப்பாவை அழையுங்கள்.',
      'te-IN': 'దయచేసి నా నాన్నను పిలవండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ನನ್ನ ಅಪ್ಪನನ್ನು ಕರೆಯಿರಿ.',
    },
  },
  {
    id: 'family-miss',
    category: 'family',
    text: 'I miss you.',
    translations: {
      'ml-IN': 'ഞാൻ നിന്നെ മിസ് ചെയ്യുന്നു.',
      'hi-IN': 'मुझे तुम्हारी याद आती है।',
      'ta-IN': 'நான் உன்னை மிஸ் செய்கிறேன்.',
      'te-IN': 'నేను నిన్ను మిస్ అవుతున్నాను.',
      'kn-IN': 'ನಾನು ನಿನ್ನನ್ನು ಮಿಸ್ ಮಾಡುತ್ತೇನೆ.',
    },
  },
  {
    id: 'family-fine',
    category: 'family',
    text: 'I am fine, do not worry.',
    translations: {
      'ml-IN': 'എനിക്ക് കുഴപ്പമില്ല, വിഷമിക്കേണ്ട.',
      'hi-IN': 'मैं ठीक हूँ, चिंता मत करो।',
      'ta-IN': 'நான் நலமாக இருக்கிறேன், கவலைப்படாதே.',
      'te-IN': 'నేను బాగానే ఉన్నాను, ఆందోళన పడకండి.',
      'kn-IN': 'ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ, ಚಿಂತಿಸಬೇಡಿ.',
    },
  },
  {
    id: 'family-come',
    category: 'family',
    text: 'Please come to me.',
    translations: {
      'ml-IN': 'ദയവായി എന്റെ അടുത്തേക്ക് വരൂ.',
      'hi-IN': 'कृपया मेरे पास आइए।',
      'ta-IN': 'தயவுசெய்து என்னிடம் வாருங்கள்.',
      'te-IN': 'దయచేసి నా దగ్గరకు రండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ನನ್ನ ಬಳಿಗೆ ಬನ್ನಿ.',
    },
  },
  // endregion

  // region Travel
  {
    id: 'travel-bus-stop',
    category: 'travel',
    text: 'Where is the bus stop?',
    translations: {
      'ml-IN': 'ബസ് സ്റ്റോപ്പ് എവിടെയാണ്?',
      'hi-IN': 'बस स्टॉप कहाँ है?',
      'ta-IN': 'பஸ் நிலையம் எங்கே இருக்கிறது?',
      'te-IN': 'బస్ స్టాప్ ఎక్కడ ఉంది?',
      'kn-IN': 'ಬಸ್ ನಿಲ್ದಾಣ ಎಲ್ಲಿದೆ?',
    },
  },
  {
    id: 'travel-ticket',
    category: 'travel',
    text: 'I need a ticket.',
    translations: {
      'ml-IN': 'എനിക്ക് ഒരു ടിക്കറ്റ് വേണം.',
      'hi-IN': 'मुझे एक टिकट चाहिए।',
      'ta-IN': 'எனக்கு ஒரு டிக்கெட் வேண்டும்.',
      'te-IN': 'నాకు ఒక టికెట్ కావాలి.',
      'kn-IN': 'ನನಗೆ ಒಂದು ಟಿಕೆಟ್ ಬೇಕು.',
    },
  },
  {
    id: 'travel-station',
    category: 'travel',
    text: 'Take me to the railway station.',
    translations: {
      'ml-IN': 'എന്നെ റെയിൽവേ സ്റ്റേഷനിൽ കൊണ്ടുപോകൂ.',
      'hi-IN': 'मुझे रेलवे स्टेशन ले चलिए।',
      'ta-IN': 'என்னை ரயில் நிலையத்திற்கு அழைத்துச் செல்லுங்கள்.',
      'te-IN': 'నన్ను రైల్వే స్టేషన్‌కు తీసుకెళ్లండి.',
      'kn-IN': 'ನನ್ನನ್ನು ರೈಲ್ವೆ ನಿಲ್ದಾಣಕ್ಕೆ ಕರೆದೊಯ್ಯಿರಿ.',
    },
  },
  {
    id: 'travel-lost',
    category: 'travel',
    text: 'I am lost.',
    translations: {
      'ml-IN': 'ഞാൻ വഴിതെറ്റിപ്പോയി.',
      'hi-IN': 'मैं रास्ता भटक गया हूँ।',
      'ta-IN': 'நான் வழி தவறிவிட்டேன்.',
      'te-IN': 'నేను దారి తప్పిపోయాను.',
      'kn-IN': 'ನಾನು ದಾರಿ ತಪ್ಪಿದ್ದೇನೆ.',
    },
  },
  {
    id: 'travel-address',
    category: 'travel',
    text: 'Please take me to this address.',
    translations: {
      'ml-IN': 'ദയവായി എന്നെ ഈ വിലാസത്തിൽ കൊണ്ടുപോകൂ.',
      'hi-IN': 'कृपया मुझे इस पते पर ले चलिए।',
      'ta-IN': 'தயவுசெய்து என்னை இந்த முகவரிக்கு அழைத்துச் செல்லுங்கள்.',
      'te-IN': 'దయచేసి నన్ను ఈ చిరునామాకు తీసుకెళ్లండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ನನ್ನನ್ನು ಈ ವಿಳಾಸಕ್ಕೆ ಕರೆದೊಯ್ಯಿರಿ.',
    },
  },
  {
    id: 'travel-toilet',
    category: 'travel',
    text: 'Where is the toilet?',
    translations: {
      'ml-IN': 'ശൗചാലയം എവിടെയാണ്?',
      'hi-IN': 'शौचालय कहाँ है?',
      'ta-IN': 'கழிவறை எங்கே இருக்கிறது?',
      'te-IN': 'మరుగుదొడ్డి ఎక్కడ ఉంది?',
      'kn-IN': 'ಶೌಚಾಲಯ ಎಲ್ಲಿದೆ?',
    },
  },
  // endregion

  // region Banking
  {
    id: 'banking-withdraw',
    category: 'banking',
    text: 'I want to withdraw money.',
    translations: {
      'ml-IN': 'എനിക്ക് പണം പിൻവലിക്കണം.',
      'hi-IN': 'मुझे पैसे निकालने हैं।',
      'ta-IN': 'எனக்கு பணம் எடுக்க வேண்டும்.',
      'te-IN': 'నాకు డబ్బు తీసుకోవాలి.',
      'kn-IN': 'ನನಗೆ ಹಣ ಹಿಂಪಡೆಯಬೇಕು.',
    },
  },
  {
    id: 'banking-balance',
    category: 'banking',
    text: 'Please tell me my balance.',
    translations: {
      'ml-IN': 'ദയവായി എന്റെ ബാലൻസ് പറയൂ.',
      'hi-IN': 'कृपया मेरा बैलेंस बताइए।',
      'ta-IN': 'தயவுசெய்து என் இருப்பு தொகையை சொல்லுங்கள்.',
      'te-IN': 'దయచేసి నా బ్యాలెన్స్ చెప్పండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ನನ್ನ ಬ್ಯಾಲೆನ್ಸ್ ಹೇಳಿ.',
    },
  },
  {
    id: 'banking-account',
    category: 'banking',
    text: 'I want to open an account.',
    translations: {
      'ml-IN': 'എനിക്ക് ഒരു അക്കൗണ്ട് തുറക്കണം.',
      'hi-IN': 'मुझे खाता खोलना है।',
      'ta-IN': 'எனக்கு ஒரு கணக்கு திறக்க வேண்டும்.',
      'te-IN': 'నాకు ఒక ఖాతా తెరవాలి.',
      'kn-IN': 'ನನಗೆ ಒಂದು ಖಾತೆ ತೆರೆಯಬೇಕು.',
    },
  },
  {
    id: 'banking-signature',
    category: 'banking',
    text: 'I cannot sign, please help me.',
    translations: {
      'ml-IN': 'എനിക്ക് ഒപ്പിടാൻ കഴിയില്ല, ദയവായി സഹായിക്കൂ.',
      'hi-IN': 'मैं हस्ताक्षर नहीं कर सकता, कृपया मेरी मदद करें।',
      'ta-IN': 'என்னால் கையெழுத்து இட முடியாது, தயவுசெய்து உதவுங்கள்.',
      'te-IN': 'నేను సంతకం చేయలేను, దయచేసి సహాయం చేయండి.',
      'kn-IN': 'ನನಗೆ ಸಹಿ ಹಾಕಲು ಸಾಧ್ಯವಿಲ್ಲ, ದಯವಿಟ್ಟು ಸಹಾಯ ಮಾಡಿ.',
    },
  },
  {
    id: 'banking-card',
    category: 'banking',
    text: 'My card is not working.',
    translations: {
      'ml-IN': 'എന്റെ കാർഡ് പ്രവർത്തിക്കുന്നില്ല.',
      'hi-IN': 'मेरा कार्ड काम नहीं कर रहा है।',
      'ta-IN': 'என் அட்டை வேலை செய்யவில்லை.',
      'te-IN': 'నా కార్డు పని చేయడం లేదు.',
      'kn-IN': 'ನನ್ನ ಕಾರ್ಡ್ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ.',
    },
  },
  {
    id: 'banking-otp',
    category: 'banking',
    text: 'Please help me with the OTP.',
    translations: {
      'ml-IN': 'ദയവായി ഒടിപി എടുക്കാൻ സഹായിക്കൂ.',
      'hi-IN': 'कृपया ओटीपी में मेरी मदद करें।',
      'ta-IN': 'தயவுசெய்து ஓடிபி பெற எனக்கு உதவுங்கள்.',
      'te-IN': 'దయచేసి ఓటీపీలో నాకు సహాయం చేయండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ಒಟಿಪಿಯಲ್ಲಿ ನನಗೆ ಸಹಾಯ ಮಾಡಿ.',
    },
  },
  // endregion

  // region General Conversation
  {
    id: 'general-hello',
    category: 'general',
    text: 'Hello.',
    translations: {
      'ml-IN': 'നമസ്കാരം.',
      'hi-IN': 'नमस्ते।',
      'ta-IN': 'வணக்கம்.',
      'te-IN': 'నమస్కారం.',
      'kn-IN': 'ನಮಸ್ಕಾರ.',
    },
  },
  {
    id: 'general-thanks',
    category: 'general',
    text: 'Thank you.',
    translations: {
      'ml-IN': 'നന്ദി.',
      'hi-IN': 'धन्यवाद।',
      'ta-IN': 'நன்றி.',
      'te-IN': 'ధన్యవాదాలు.',
      'kn-IN': 'ಧನ್ಯವಾದಗಳು.',
    },
  },
  {
    id: 'general-yes',
    category: 'general',
    text: 'Yes.',
    translations: {
      'ml-IN': 'അതെ.',
      'hi-IN': 'हाँ।',
      'ta-IN': 'ஆம்.',
      'te-IN': 'అవును.',
      'kn-IN': 'ಹೌದು.',
    },
  },
  {
    id: 'general-no',
    category: 'general',
    text: 'No.',
    translations: {
      'ml-IN': 'ഇല്ല.',
      'hi-IN': 'नहीं।',
      'ta-IN': 'இல்லை.',
      'te-IN': 'కాదు.',
      'kn-IN': 'ಇಲ್ಲ.',
    },
  },
  {
    id: 'general-please',
    category: 'general',
    text: 'Please.',
    translations: {
      'ml-IN': 'ദയവായി.',
      'hi-IN': 'कृपया।',
      'ta-IN': 'தயவுசெய்து.',
      'te-IN': 'దయచేసి.',
      'kn-IN': 'ದಯವಿಟ್ಟು.',
    },
  },
  {
    id: 'general-sorry',
    category: 'general',
    text: 'I am sorry.',
    translations: {
      'ml-IN': 'എന്നോട് ക്ഷമിക്കണം.',
      'hi-IN': 'मुझे माफ़ करें।',
      'ta-IN': 'என்னை மன்னியுங்கள்.',
      'te-IN': 'నన్ను క్షమించండి.',
      'kn-IN': 'ನನ್ನನ್ನು ಕ್ಷಮಿಸಿ.',
    },
  },
  {
    id: 'general-not-understand',
    category: 'general',
    text: 'I do not understand.',
    translations: {
      'ml-IN': 'എനിക്ക് മനസ്സിലാകുന്നില്ല.',
      'hi-IN': 'मुझे समझ नहीं आ रहा है।',
      'ta-IN': 'எனக்கு புரியவில்லை.',
      'te-IN': 'నాకు అర్థం కావడం లేదు.',
      'kn-IN': 'ನನಗೆ ಅರ್ಥವಾಗುತ್ತಿಲ್ಲ.',
    },
  },
  {
    id: 'general-repeat',
    category: 'general',
    text: 'Please say that again.',
    translations: {
      'ml-IN': 'ദയവായി അത് വീണ്ടും പറയൂ.',
      'hi-IN': 'कृपया इसे फिर से कहिए।',
      'ta-IN': 'தயவுசெய்து அதை மீண்டும் சொல்லுங்கள்.',
      'te-IN': 'దయచేసి అది మళ్లీ చెప్పండి.',
      'kn-IN': 'ದಯವಿಟ್ಟು ಅದನ್ನು ಇನ್ನೊಮ್ಮೆ ಹೇಳಿ.',
    },
  },
  // endregion
];

const PHRASE_BY_ID = new Map(BUNDLED_PHRASES.map((phrase) => [phrase.id, phrase]));

export function getBundledPhrase(id: string): BundledPhrase | undefined {
  return PHRASE_BY_ID.get(id);
}

/**
 * The text to speak for a phrase in a given language.
 *
 * Falls back to the canonical English wording rather than returning an empty string: a phrase that
 * cannot be translated must still be speakable, because staying silent is the one outcome an AAC
 * user cannot afford.
 */
export function resolvePhraseText(phrase: BundledPhrase, languageCode: string): string {
  if (languageCode === 'en-IN') {
    return phrase.text;
  }
  const translation = phrase.translations[languageCode as keyof typeof phrase.translations];
  return typeof translation === 'string' && translation.trim().length > 0
    ? translation
    : phrase.text;
}

/** True when this phrase has a real translation (not an English fallback) for the language. */
export function hasTranslation(phrase: BundledPhrase, languageCode: string): boolean {
  if (languageCode === 'en-IN') {
    return true;
  }
  const translation = phrase.translations[languageCode as keyof typeof phrase.translations];
  return typeof translation === 'string' && translation.trim().length > 0;
}

/** One language's rows for the whole library, in category order. Used for seeding and for tests. */
export function buildPhraseRows(language: string, createdAt = 0): Phrase[] {
  return sortPhrases(
    BUNDLED_PHRASES.map((phrase) => ({
      id: phrase.id,
      category: phrase.category,
      language,
      text: resolvePhraseText(phrase, language),
      isDefault: true,
      createdAt,
    }))
  );
}

/** Every language's rows, for seeding the database in one pass. */
export function buildAllPhraseRows(createdAt = 0): Phrase[] {
  return SUPPORTED_PHRASE_LANGUAGES.flatMap((language) => buildPhraseRows(language, createdAt));
}

/** Orders phrases by the category order above, then by their order in the bundle. */
export function sortPhrases(phrases: Phrase[]): Phrase[] {
  const categoryRank = new Map(PHRASE_CATEGORIES.map((category, index) => [category.id, index]));
  const phraseRank = new Map(BUNDLED_PHRASES.map((phrase, index) => [phrase.id, index]));
  return [...phrases].sort((a, b) => {
    const byCategory =
      (categoryRank.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
      (categoryRank.get(b.category) ?? Number.MAX_SAFE_INTEGER);
    if (byCategory !== 0) {
      return byCategory;
    }
    return (
      (phraseRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (phraseRank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

/**
 * The handful of phrases shown on the home screen.
 *
 * Chosen by hand: these are the things a person most often cannot wait to say, and each of them is
 * a single tap away on the screen the user already opens.
 */
export const HOME_QUICK_PHRASE_IDS = [
  'emergency-help',
  'medical-doctor',
  'daily-bathroom',
  'medical-water',
  'general-thanks',
  'general-no',
] as const;

/** Builds the home strip for a language, skipping any id that is no longer in the library. */
export function buildHomeQuickPhrases(
  language: string
): { id: string; text: string; categoryLabel: string }[] {
  return HOME_QUICK_PHRASE_IDS.flatMap((id) => {
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

/**
 * Turns stored favourites into the rows the UI renders.
 *
 * Bundled phrases are resolved to the language the app is currently speaking, so the same favourite
 * follows the user between languages. A custom message keeps the language it was written in,
 * because re-speaking someone's own words in another language would change what they said.
 *
 * A favourite whose target cannot be found is skipped instead of rendered as a blank card; a
 * half-deleted row is a storage accident, not something a user should have to look at.
 */
export function resolveFavouriteEntries(
  favourites: Favourite[],
  customMessages: CustomMessage[],
  language: string
): FavouriteEntry[] {
  const customById = new Map(customMessages.map((message) => [message.id, message]));

  return favourites.flatMap<FavouriteEntry>((favourite) => {
    if (favourite.customMessageId !== null) {
      const message = customById.get(favourite.customMessageId);
      if (!message) {
        return [];
      }
      return [
        {
          favourite,
          text: message.text,
          title: message.title,
          categoryLabel: PHRASE_CATEGORY_LABELS[message.category],
          language: message.language,
          isCustom: true,
          customMessageId: message.id,
        },
      ];
    }

    if (favourite.phraseId === null) {
      return [];
    }
    const phrase = getBundledPhrase(favourite.phraseId);
    if (!phrase) {
      return [];
    }
    return [
      {
        favourite,
        text: resolvePhraseText(phrase, language),
        title: null,
        categoryLabel: PHRASE_CATEGORY_LABELS[phrase.category],
        language,
        isCustom: false,
        customMessageId: null,
      },
    ];
  });
}
