import type { MessageSegment, SymbolCategory, SymbolEntry } from '../types';
import { detectScript } from './messages';

/**
 * The starter symbol set for the AAC board.
 *
 * ARASAAC pictograms are licensed CC BY-NC-SA 4.0 and are approved for use (see `src/data/credits.ts`
 * and the repository `NOTICE`), but on the same terms the review set out: nothing third-party is
 * bundled into the APK. ARASAAC ships as a downloadable pack, so this file stays SwarSathi's own
 * emoji starter set and the app redistributes no artwork.
 *
 * The catalogue is data-driven: adding a symbol is a data change, and any `SymbolProvider`
 * (ARASAAC, user photos) can sit alongside this list without touching the board screen. This set is
 * served through `StarterSymbolProvider` like any other provider.
 *
 * Each symbol carries its wording per language so a tap produces a correctly language-tagged
 * segment — the message keeps its own language instead of inheriting whatever the profile happens
 * to be set to. Translations are drafts pending native review, same status as the bundled phrase
 * library; a missing translation falls back to English rather than producing an empty segment,
 * and uncertain translations were deliberately left out rather than guessed.
 *
 * Every symbol carries all six languages SwarSathi speaks, and every glyph means exactly one thing.
 * Two tiles sharing a picture — a thumbs-up that is both "yes" and "I like", a SOS that is both
 * "help" and "I need" — force the person tapping and the person reading to guess from context, which
 * is precisely what a picture board must never do. Where two meanings once shared a glyph, one of
 * them now has its own; a repeated glyph is a bug, not a style choice.
 */

/** Id of the provider that serves this bundled set. */
export const STARTER_PROVIDER_ID = 'starter';

export interface StarterSymbol {
  /** Stable id, stored in message provenance. */
  id: string;
  /** Emoji glyph shown on the tile. */
  glyph: string;
  /** Category the symbol is grouped under on the board. */
  category: SymbolCategoryId;
  /** Wording per language code (`en-IN`, `ml-IN`, ...). English is the fallback. */
  words: Record<string, string>;
}

export type SymbolCategoryId =
  | 'needs'
  | 'people'
  | 'actions'
  | 'feelings'
  | 'places'
  | 'everyday';

export const SYMBOL_CATEGORY_LABELS: Record<SymbolCategoryId, string> = {
  needs: 'Needs',
  people: 'People',
  actions: 'Actions',
  feelings: 'Feelings',
  places: 'Places',
  everyday: 'Everyday',
};

/**
 * The order the board's category chips appear in.
 *
 * The order is a curation decision rather than an accident of declaration order, so it lives here
 * with the labels and every board - however many providers feed it - derives its chips from this
 * one list.
 */
export const SYMBOL_CATEGORY_ORDER: SymbolCategoryId[] = [
  'everyday',
  'needs',
  'people',
  'actions',
  'feelings',
  'places',
];

/** This provider's categories, ready for the board to render. */
export const SYMBOL_CATEGORIES: SymbolCategory[] = SYMBOL_CATEGORY_ORDER.map((id) => ({
  id,
  label: SYMBOL_CATEGORY_LABELS[id],
}));

const WORDS = {
  yes: {
    'en-IN': 'yes',
    'ml-IN': 'അതെ',
    'hi-IN': 'हाँ',
    'ta-IN': 'ஆம்',
    'te-IN': 'అవును',
    'kn-IN': 'ಹೌದು',
  },
  no: {
    'en-IN': 'no',
    'ml-IN': 'വേണ്ട',
    'hi-IN': 'नहीं',
    'ta-IN': 'இல்லை',
    'te-IN': 'కాదు',
    'kn-IN': 'ಬೇಡ',
  },
  help: {
    'en-IN': 'help',
    'ml-IN': 'സഹായം',
    'hi-IN': 'मदद',
    'ta-IN': 'உதவி',
    'te-IN': 'సహాయం',
    'kn-IN': 'ಸಹಾಯ',
  },
  please: {
    'en-IN': 'please',
    'ml-IN': 'ദയവായി',
    'hi-IN': 'कृपया',
    'ta-IN': 'தயவுசெய்து',
    'te-IN': 'దయచేసి',
    'kn-IN': 'ದಯವಿಟ್ಟು',
  },
  thankYou: {
    'en-IN': 'thank you',
    'ml-IN': 'നന്ദി',
    'hi-IN': 'धन्यवाद',
    'ta-IN': 'நன்றி',
    'te-IN': 'ధన్యవాదాలు',
    'kn-IN': 'ಧನ್ಯವಾದಗಳು',
  },
  sorry: {
    'en-IN': 'sorry',
    'ml-IN': 'ക്ഷമിക്കണം',
    'hi-IN': 'माफ़ कीजिए',
    'ta-IN': 'மன்னிக்கவும்',
    'te-IN': 'క్షమించండి',
    'kn-IN': 'ಕ್ಷಮಿಸಿ',
  },
  water: {
    'en-IN': 'water',
    'ml-IN': 'വെള്ളം',
    'hi-IN': 'पानी',
    'ta-IN': 'தண்ணீர்',
    'te-IN': 'నీరు',
    'kn-IN': 'ನೀರು',
  },
  food: {
    'en-IN': 'food',
    'ml-IN': 'ഭക്ഷണം',
    'hi-IN': 'खाना',
    'ta-IN': 'உணவு',
    'te-IN': 'ఆహారం',
    'kn-IN': 'ಆಹಾರ',
  },
  thirsty: {
    'en-IN': 'I am thirsty',
    'ml-IN': 'ദാഹം',
    'hi-IN': 'मुझे प्यास लगी है',
    'ta-IN': 'தாகம்',
    'te-IN': 'దాహం',
    'kn-IN': 'ಬಾಯಾರಿಕೆ',
  },
  bathroom: {
    'en-IN': 'bathroom',
    'ml-IN': 'കക്കൂസ്',
    'hi-IN': 'शौचालय',
    'ta-IN': 'கழிப்பறை',
    'te-IN': 'టాయిలెట్',
    'kn-IN': 'ಶೌಚಾಲಯ',
  },
  pain: {
    'en-IN': 'pain',
    'ml-IN': 'വേദന',
    'hi-IN': 'दर्द',
    'ta-IN': 'வலி',
    'te-IN': 'నొప్పి',
    'kn-IN': 'ನೋವು',
  },
  medicine: {
    'en-IN': 'medicine',
    'ml-IN': 'മരുന്ന്',
    'hi-IN': 'दवा',
    'ta-IN': 'மருந்து',
    'te-IN': 'మందు',
    'kn-IN': 'ಔಷಧಿ',
  },
  doctor: {
    'en-IN': 'doctor',
    'ml-IN': 'ഡോക്ടർ',
    'hi-IN': 'डॉक्टर',
    'ta-IN': 'மருத்துவர்',
    'te-IN': 'వైద్యుడు',
    'kn-IN': 'ವೈದ್ಯರು',
  },
  hospital: {
    'en-IN': 'hospital',
    'ml-IN': 'ആശുപത്രി',
    'hi-IN': 'अस्पताल',
    'ta-IN': 'மருத்துவமனை',
    'te-IN': 'ఆసుపత్రి',
    'kn-IN': 'ಆಸ್ಪತ್ರೆ',
  },
  ambulance: {
    'en-IN': 'ambulance',
    'ml-IN': 'ആംബുലൻസ്',
    'hi-IN': 'एम्बुलेंस',
    'ta-IN': 'ஆம்புலன்ஸ்',
    'te-IN': 'అంబులెన్స్',
    'kn-IN': 'ಆಂಬ್ಯುಲೆನ್ಸ್',
  },
  emergency: {
    'en-IN': 'emergency',
    'ml-IN': 'അടിയന്തിരം',
    'hi-IN': 'आपातकाल',
    'ta-IN': 'அவசரம்',
    'te-IN': 'అత్యవసరం',
    'kn-IN': 'ತುರ್ತು',
  },
  family: {
    'en-IN': 'family',
    'ml-IN': 'കുടുംബം',
    'hi-IN': 'परिवार',
    'ta-IN': 'குடும்பம்',
    'te-IN': 'కుటుంబం',
    'kn-IN': 'ಕುಟುಂಬ',
  },
  friend: {
    'en-IN': 'friend',
    'ml-IN': 'സുഹൃത്ത്',
    'hi-IN': 'दोस्त',
    'ta-IN': 'நண்பர்',
    'te-IN': 'స్నేహితుడు',
    'kn-IN': 'ಸ್ನೇಹಿತ',
  },
  mother: {
    'en-IN': 'mother',
    'ml-IN': 'അമ്മ',
    'hi-IN': 'माँ',
    'ta-IN': 'அம்மா',
    'te-IN': 'అమ్మ',
    'kn-IN': 'ಅಮ್ಮ',
  },
  father: {
    'en-IN': 'father',
    'ml-IN': 'അച്ഛൻ',
    'hi-IN': 'पिता',
    'ta-IN': 'அப்பா',
    'te-IN': 'అప్పా',
    'kn-IN': 'ಅಪ್ಪ',
  },
  home: {
    'en-IN': 'home',
    'ml-IN': 'വീട്',
    'hi-IN': 'घर',
    'ta-IN': 'வீடு',
    'te-IN': 'ఇల్లు',
    'kn-IN': 'ಮನೆ',
  },
  call: {
    'en-IN': 'call',
    'ml-IN': 'വിളിക്കുക',
    'hi-IN': 'कॉल',
    'ta-IN': 'அழை',
    'te-IN': 'కాల్',
    'kn-IN': 'ಕರೆ',
  },
  phone: {
    'en-IN': 'phone',
    'ml-IN': 'ഫോൺ',
    'hi-IN': 'फ़ोन',
    'ta-IN': 'தொலைபேசி',
    'te-IN': 'ఫోన్',
    'kn-IN': 'ಫೋನ್',
  },
  speak: {
    'en-IN': 'speak',
    'ml-IN': 'സംസാരിക്കുക',
    'hi-IN': 'बोलो',
    'ta-IN': 'பேசு',
    'te-IN': 'మాట్లాడు',
    'kn-IN': 'ಮಾತನಾಡಿ',
  },
  listen: {
    'en-IN': 'listen',
    'ml-IN': 'കേൾക്കുക',
    'hi-IN': 'सुनो',
    'ta-IN': 'கேள்',
    'te-IN': 'విను',
    'kn-IN': 'ಕೇಳು',
  },
  understand: {
    'en-IN': 'understand',
    'ml-IN': 'മനസ്സിലാക്കുക',
    'hi-IN': 'समझो',
    'ta-IN': 'புரி',
    'te-IN': 'అర్థం',
    'kn-IN': 'ಅರ್ಥ',
  },
  go: {
    'en-IN': 'go',
    'ml-IN': 'പോകുക',
    'hi-IN': 'जाओ',
    'ta-IN': 'போ',
    'te-IN': 'వెళ్ళు',
    'kn-IN': 'ಹೋಗು',
  },
  come: {
    'en-IN': 'come',
    'ml-IN': 'വരിക',
    'hi-IN': 'आओ',
    'ta-IN': 'வா',
    'te-IN': 'రా',
    'kn-IN': 'ಬನ್ನಿ',
  },
  want: {
    'en-IN': 'I want',
    'ml-IN': 'എനിക്ക് വേണം',
    'hi-IN': 'मुझे चाहिए',
    'ta-IN': 'எனக்கு வேண்டும்',
    'te-IN': 'నాకు కావాలి',
    'kn-IN': 'ನನಗೆ ಬೇಕು',
  },
  need: {
    'en-IN': 'I need',
    'ml-IN': 'എനിക്ക് ആവശ്യമുണ്ട്',
    'hi-IN': 'मुझे ज़रूरत है',
    'ta-IN': 'எனக்கு தேவை',
    'te-IN': 'నాకు అవసరం',
    'kn-IN': 'ನನಗೆ ಅಗತ್ಯವಿದೆ',
  },
  like: {
    'en-IN': 'I like',
    'ml-IN': 'എനിക്ക് ഇഷ്ടമാണ്',
    'hi-IN': 'मुझे पसंद है',
    'ta-IN': 'எனக்கு பிடிக்கும்',
    'te-IN': 'నాకు ఇష్టం',
    'kn-IN': 'ನನಗೆ ಇಷ್ಟ',
  },
  good: {
    'en-IN': 'good',
    'ml-IN': 'നല്ലത്',
    'hi-IN': 'अच्छा',
    'ta-IN': 'நல்லது',
    'te-IN': 'మంచిది',
    'kn-IN': 'ಉತ್ತಮ',
  },
  bad: {
    'en-IN': 'bad',
    'ml-IN': 'ചീത്ത',
    'hi-IN': 'बुरा',
    'ta-IN': 'மோசம்',
    'te-IN': 'చెడ్డిది',
    'kn-IN': 'ಕೆಟ್ಟದು',
  },
  happy: {
    'en-IN': 'happy',
    'ml-IN': 'സന്തോഷം',
    'hi-IN': 'खुश',
    'ta-IN': 'மகிழ்ச்சி',
    'te-IN': 'ఆనందం',
    'kn-IN': 'ಸಂತೋಷ',
  },
  sad: {
    'en-IN': 'sad',
    'ml-IN': 'സങ്കടം',
    'hi-IN': 'उदास',
    'ta-IN': 'சோகம',
    'te-IN': 'బాధ',
    'kn-IN': 'ದುಃಖ',
  },
  tired: {
    'en-IN': 'tired',
    'ml-IN': 'ക്ഷീണം',
    'hi-IN': 'थका',
    'ta-IN': 'சோர்வாக',
    'te-IN': 'అలసట',
    'kn-IN': 'ಆಯಾಸ',
  },
  sleep: {
    'en-IN': 'sleep',
    'ml-IN': 'ഉറക്കം',
    'hi-IN': 'नींद',
    'ta-IN': 'தூக்கம்',
    'te-IN': 'నిద్ర',
    'kn-IN': 'ನಿದ್ದೆ',
  },
  wait: {
    'en-IN': 'wait',
    'ml-IN': 'കാത്തിരിക്കുക',
    'hi-IN': 'इंतज़ार',
    'ta-IN': 'காத்திரு',
    'te-IN': 'వేచి ఉండు',
    'kn-IN': 'ಕಾಯು',
  },
  now: {
    'en-IN': 'now',
    'ml-IN': 'ഇപ്പോൾ',
    'hi-IN': 'अभी',
    'ta-IN': 'இப்போது',
    'te-IN': 'ఇప్పుడు',
    'kn-IN': 'ಈಗ',
  },
  later: {
    'en-IN': 'later',
    'ml-IN': 'പിന്നീട്',
    'hi-IN': 'बाद में',
    'ta-IN': 'பிறகு',
    'te-IN': 'తర్వాత',
    'kn-IN': 'ಆಮೇಲೆ',
  },
  stop: {
    'en-IN': 'stop',
    'ml-IN': 'നിർത്തുക',
    'hi-IN': 'रुको',
    'ta-IN': 'நிறுத்து',
    'te-IN': 'ఆపు',
    'kn-IN': 'ನಿಲ್ಲಿಸು',
  },
  yesPlease: {
    'en-IN': 'yes please',
    'ml-IN': 'അതെ, ദയവായി',
    'hi-IN': 'हाँ, कृपया',
    'ta-IN': 'ஆம், தயவுசெய்து',
    'te-IN': 'అవును, దయచేసి',
    'kn-IN': 'ಹೌದು, ದಯವಿಟ್ಟು',
  },
  noThankYou: {
    'en-IN': 'no thank you',
    'ml-IN': 'വേണ്ട, നന്ദി',
    'hi-IN': 'नहीं, धन्यवाद',
    'ta-IN': 'இல்லை நன்றி',
    'te-IN': 'కాదు, ధన్యవాదాలు',
    'kn-IN': 'ಬೇಡ, ಧನ್ಯವಾದ',
  },
} as const;

function symbol(
  id: string,
  glyph: string,
  category: SymbolCategoryId,
  wordKey: keyof typeof WORDS
): StarterSymbol {
  return { id, glyph, category, words: { ...WORDS[wordKey] } };
}

/** The bundled starter symbols, grouped for display. */
export const STARTER_SYMBOLS: StarterSymbol[] = [
  symbol('sym-yes', '👍', 'everyday', 'yes'),
  symbol('sym-no', '👎', 'everyday', 'no'),
  symbol('sym-please', '🙏', 'everyday', 'please'),
  symbol('sym-thanks', '😊', 'everyday', 'thankYou'),
  symbol('sym-sorry', '😔', 'feelings', 'sorry'),
  symbol('sym-help', '🆘', 'needs', 'help'),
  symbol('sym-emergency', '🚨', 'needs', 'emergency'),
  symbol('sym-water', '💧', 'needs', 'water'),
  symbol('sym-food', '🍽️', 'needs', 'food'),
  symbol('sym-thirsty', '🥤', 'needs', 'thirsty'),
  symbol('sym-bathroom', '🚻', 'needs', 'bathroom'),
  symbol('sym-pain', '🤕', 'feelings', 'pain'),
  symbol('sym-medicine', '💊', 'needs', 'medicine'),
  symbol('sym-doctor', '🩺', 'people', 'doctor'),
  symbol('sym-hospital', '🏥', 'places', 'hospital'),
  symbol('sym-ambulance', '🚑', 'places', 'ambulance'),
  symbol('sym-family', '👨‍👩‍👧', 'people', 'family'),
  symbol('sym-friend', '🤝', 'people', 'friend'),
  symbol('sym-mother', '👩', 'people', 'mother'),
  symbol('sym-father', '👨', 'people', 'father'),
  symbol('sym-home', '🏠', 'places', 'home'),
  symbol('sym-call', '📞', 'actions', 'call'),
  symbol('sym-phone', '📱', 'everyday', 'phone'),
  symbol('sym-speak', '🗣️', 'actions', 'speak'),
  symbol('sym-listen', '👂', 'actions', 'listen'),
  symbol('sym-understand', '🤔', 'feelings', 'understand'),
  symbol('sym-go', '🚶', 'actions', 'go'),
  symbol('sym-come', '👉', 'actions', 'come'),
  symbol('sym-want', '❤️', 'feelings', 'want'),
  symbol('sym-need', '🙋', 'needs', 'need'),
  symbol('sym-like', '😍', 'feelings', 'like'),
  symbol('sym-good', '👌', 'feelings', 'good'),
  symbol('sym-bad', '😖', 'feelings', 'bad'),
  symbol('sym-happy', '😄', 'feelings', 'happy'),
  symbol('sym-sad', '😢', 'feelings', 'sad'),
  symbol('sym-tired', '😴', 'feelings', 'tired'),
  symbol('sym-sleep', '🛌', 'actions', 'sleep'),
  symbol('sym-wait', '⏳', 'actions', 'wait'),
  symbol('sym-now', '⏰', 'actions', 'now'),
  symbol('sym-later', '🕐', 'actions', 'later'),
  symbol('sym-stop', '✋', 'actions', 'stop'),
  symbol('sym-yes-please', '✅', 'everyday', 'yesPlease'),
  symbol('sym-no-thanks', '❌', 'everyday', 'noThankYou'),
];

export function getStarterSymbol(id: string): StarterSymbol | undefined {
  return STARTER_SYMBOLS.find((entry) => entry.id === id);
}

/** The starter set, wrapped as the generic entries the board and every provider use. */
export const STARTER_SYMBOL_ENTRIES: SymbolEntry[] = STARTER_SYMBOLS.map(toSymbolEntry);

/** Wraps a bundled starter symbol as the generic entry the board renders. */
export function toSymbolEntry(symbol: StarterSymbol): SymbolEntry {
  return {
    id: symbol.id,
    category: symbol.category,
    words: symbol.words,
    representation: { kind: 'emoji', glyph: symbol.glyph },
    providerId: STARTER_PROVIDER_ID,
  };
}

/**
 * The wording a symbol contributes in a given language.
 *
 * Falls back to English when the language has no entry — a missing translation must never produce
 * an empty segment, because silence is the one outcome a tapped symbol cannot afford.
 */
export function symbolText(symbol: StarterSymbol, language: string): string {
  return symbolEntryText(toSymbolEntry(symbol), language);
}

/** The wording a generic symbol entry contributes in a given language. */
export function symbolEntryText(entry: SymbolEntry, language: string): string {
  return entry.words[language] ?? entry.words['en-IN'] ?? '';
}

/**
 * True when the symbol has no wording in `language`, so the board is showing the English fallback.
 *
 * The board marks these tiles rather than silently substituting English, so the person looking at
 * the picture always knows which language the word about to be spoken is really in. The bundled set
 * carries all six languages, so this is normally only true for a provider that cannot translate —
 * a person's own photograph, or a pictogram pack with no Indic metadata.
 */
export function symbolEntryTranslationMissing(entry: SymbolEntry, language: string): boolean {
  return entry.words[language] === undefined;
}

/**
 * Builds the message segment a symbol tap produces.
 *
 * The segment is `standalone`: symbols are words, not flowing text, so the message flattener
 * spaces them correctly when they are combined.
 */
export function symbolSegment(symbol: StarterSymbol, language: string): MessageSegment {
  return symbolEntrySegment(toSymbolEntry(symbol), language);
}

/** Builds the message segment for any symbol entry, whatever provider produced it. */
export function symbolEntrySegment(entry: SymbolEntry, language: string): MessageSegment {
  const text = symbolEntryText(entry, language);
  const primary = language.split('-')[0];
  return {
    text,
    language: primary,
    script: detectScript(text),
    origin: { kind: 'symbol', refId: entry.id },
    standalone: true,
  };
}
