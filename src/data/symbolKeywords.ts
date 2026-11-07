/**
 * Indic keyword layer for symbol search.
 *
 * ARASAAC's own metadata carries no Indic languages, so search on the symbol board cannot depend on
 * it. These keywords are SwarSathi's own: a small hand-written set of common synonyms per language,
 * layered on top of the wording each symbol already carries (see `src/data/symbols.ts`).
 *
 * Status: drafts pending native review, exactly like the bundled phrase library and the symbol
 * wordings. Only words the author was confident about are listed, and a symbol with no entry here
 * is still findable by its own wording in every language it declares — so a gap is a missed
 * synonym, never a symbol that cannot be found at all. Adding more is a data change.
 *
 * The keys are `StarterSymbol.id`s from `src/data/symbols.ts`.
 */
export const SYMBOL_KEYWORDS: Record<string, Record<string, string[]>> = {
  'sym-water': {
    'ml-IN': ['ജലം'],
    'hi-IN': ['जल'],
    'ta-IN': ['நீர்'],
    'te-IN': ['జలం'],
    'kn-IN': ['ಜಲ'],
  },
  'sym-food': {
    'ml-IN': ['ആഹാരം'],
    'hi-IN': ['भोजन'],
    'ta-IN': ['சாப்பாடு'],
    'te-IN': ['భోజనం'],
    'kn-IN': ['ಊಟ'],
  },
  'sym-mother': {
    'ml-IN': ['ഉമ്മ'],
    'hi-IN': ['मम्मी'],
    'ta-IN': ['அம்மா'],
    'te-IN': ['అమ్మ'],
    'kn-IN': ['ಅಮ್ಮ'],
  },
  'sym-father': {
    'ml-IN': ['അപ്പന്‍'],
    'hi-IN': ['पापा'],
    'ta-IN': ['அப்பா'],
    'te-IN': ['నాన్న'],
    'kn-IN': ['ಅಪ್ಪ'],
  },
  'sym-home': {
    'ml-IN': ['വീട്'],
    'hi-IN': ['घर'],
    'ta-IN': ['வீடு'],
    'te-IN': ['ఇల్లు'],
    'kn-IN': ['ಮನೆ'],
  },
  'sym-help': {
    'ml-IN': ['സഹായിക്കൂ'],
    'hi-IN': ['सहायता'],
    'ta-IN': ['உதவுங்கள்'],
    'te-IN': ['సహాయము'],
    'kn-IN': ['ಸಹಾಯಮಾಡಿ'],
  },
  'sym-medicine': {
    'ml-IN': ['മരുന്നു'],
    'hi-IN': ['दवाई'],
    'ta-IN': ['மாத்திரை'],
    'te-IN': ['మాత్ర'],
    'kn-IN': ['ಔಷಧ'],
  },
  'sym-hospital': {
    'ml-IN': ['ആശുപത്രി'],
    'hi-IN': ['अस्पताल'],
    'ta-IN': ['மருத்துவமனை'],
    'te-IN': ['ఆసుపత్రి'],
    'kn-IN': ['ಆಸ್ಪತ್ರೆ'],
  },
  'sym-doctor': {
    'ml-IN': ['ഡോക്ടറെ'],
    'hi-IN': ['वैद्य'],
    'ta-IN': ['மருத்துவரை'],
    'te-IN': ['వైద్యుడిని'],
    'kn-IN': ['ವೈದ್ಯರನ್ನು'],
  },
  'sym-pain': {
    'ml-IN': ['നോവ്'],
    'hi-IN': ['पीड़ा'],
    'ta-IN': ['வலிக்கிறது'],
    'te-IN': ['నొప్పి'],
    'kn-IN': ['ನೋವು'],
  },
  'sym-sleep': {
    'ml-IN': ['ഉറക്കം'],
    'hi-IN': ['सोना'],
    'ta-IN': ['தூங்கு'],
    'te-IN': ['నిద్రపో'],
    'kn-IN': ['ನಿದ್ದೆ'],
  },
  'sym-go': {
    'ml-IN': ['പോ'],
    'hi-IN': ['चलो'],
    'ta-IN': ['செல்'],
    'te-IN': ['వెళ్ళండి'],
    'kn-IN': ['ಹೋಗಿ'],
  },
  'sym-come': {
    'ml-IN': ['വാ'],
    'hi-IN': ['आ'],
    'ta-IN': ['வா'],
    'te-IN': ['రండి'],
    'kn-IN': ['ಬನ್ನಿ'],
  },
  'sym-stop': {
    'ml-IN': ['നിർത്ത്'],
    'hi-IN': ['ठहरो'],
    'ta-IN': ['நில்'],
    'te-IN': ['ఆగు'],
    'kn-IN': ['ನಿಲ್ಲಿಸಿ'],
  },
  'sym-yes': {
    'ml-IN': ['ശരി'],
    'hi-IN': ['जी हाँ'],
    'ta-IN': ['சரி'],
    'te-IN': ['సరే'],
    'kn-IN': ['ಸರಿ'],
  },
  'sym-no': {
    'ml-IN': ['ഇല്ല'],
    'hi-IN': ['ना'],
    'ta-IN': ['வேண்டாம்'],
    'te-IN': ['వద్దు'],
    'kn-IN': ['ಇಲ್ಲ'],
  },
};

/** Keyword aliases for one symbol in one language. Empty when none are recorded. */
export function keywordsForSymbol(symbolId: string, language: string): string[] {
  const byLanguage = SYMBOL_KEYWORDS[symbolId];
  if (!byLanguage) {
    return [];
  }
  return byLanguage[language] ?? byLanguage['en-IN'] ?? [];
}
