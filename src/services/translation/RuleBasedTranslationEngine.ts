import { BUNDLED_PHRASES } from '../../data/phrases';
import { INDICTRANS2_PACK_ID } from '../packs/indicTransPack';
import type { TranslationEngine, TranslationResult } from './types';

/**
 * Normalizes language tags (e.g. "en-IN" -> "en", "ml" -> "ml").
 */
function primaryLang(lang: string): string {
  return lang.trim().toLowerCase().split('-')[0];
}

/**
 * Normalizes text for matching by trimming, collapsing spaces, and stripping trailing punctuation.
 */
function normalizePhrase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.?!,;।॥]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Everyday multilingual vocabulary map for high-frequency conversational words.
 * Keyed by primary language subtag.
 */
interface CommonVocabEntry {
  [key: string]: string | undefined;
  en: string;
  hi: string;
  ml: string;
  ta?: string;
  te?: string;
  kn?: string;
  bn?: string;
  gu?: string;
  mr?: string;
  pa?: string;
  ur?: string;
}

const COMMON_VOCABULARY: CommonVocabEntry[] = [
  {
    en: 'hello',
    hi: 'नमस्ते',
    ml: 'നമസ്കാരം',
    ta: 'வணக்கம்',
    te: 'నమస్కారం',
    kn: 'ನಮಸ್ಕಾರ',
    bn: 'নমস্কার',
    gu: 'નમસ્તે',
    mr: 'नमस्ते',
    pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
    ur: 'سلام',
  },
  {
    en: 'hi',
    hi: 'नमस्ते',
    ml: 'നമസ്കാരം',
    ta: 'வணக்கம்',
    te: 'నమస్కారం',
    kn: 'ನಮಸ್ಕಾರ',
    bn: 'নমস্কার',
    gu: 'નમસ્તે',
    mr: 'नमस्ते',
    pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
    ur: 'سلام',
  },
  {
    en: 'thank you',
    hi: 'धन्यवाद',
    ml: 'നന്ദി',
    ta: 'நன்றி',
    te: 'ధన్యవాదాలు',
    kn: 'ಧನ್ಯವಾದಗಳು',
    bn: 'ধন্যবাদ',
    gu: 'આભાર',
    mr: 'धन्यवाद',
    pa: 'ਧੰਨਵਾਦ',
    ur: 'شکریہ',
  },
  {
    en: 'thanks',
    hi: 'धन्यवाद',
    ml: 'നന്ദി',
    ta: 'நன்றி',
    te: 'ధన్యవాదాలు',
    kn: 'ಧನ್ಯವಾದಗಳು',
    bn: 'ধন্যবাদ',
    gu: 'આભાર',
    mr: 'धन्यवाद',
    pa: 'ਧੰਨਵਾਦ',
    ur: 'شکریہ',
  },
  {
    en: 'please',
    hi: 'कृपया',
    ml: 'ദയവായി',
    ta: 'தயவுசெய்து',
    te: 'దయచేసి',
    kn: 'ದಯವಿಟ್ಟು',
    bn: 'দয়া করে',
    gu: 'કૃપા કરીને',
    mr: 'कृपया',
    pa: 'ਕਿਰਪਾ ਕਰਕੇ',
    ur: 'براہ کرم',
  },
  {
    en: 'yes',
    hi: 'हाँ',
    ml: 'അതെ',
    ta: 'ஆம்',
    te: 'అవును',
    kn: 'ಹೌದು',
    bn: 'হ্যাঁ',
    gu: 'હા',
    mr: 'होय',
    pa: 'ਹਾਂ',
    ur: 'ہاں',
  },
  {
    en: 'no',
    hi: 'नहीं',
    ml: 'അല്ല',
    ta: 'இல்லை',
    te: 'కాదు',
    kn: 'ಇಲ್ಲ',
    bn: 'না',
    gu: 'ના',
    mr: 'नाही',
    pa: 'ਨਹੀਂ',
    ur: 'نہیں',
  },
  {
    en: 'help',
    hi: 'मदद',
    ml: 'സഹായം',
    ta: 'உதவி',
    te: 'సహాయం',
    kn: 'ಸಹಾಯ',
    bn: 'সাহায্য',
    gu: 'મદદ',
    mr: 'मदत',
    pa: 'ਮਦਦ',
    ur: 'مدد',
  },
  {
    en: 'water',
    hi: 'पानी',
    ml: 'വെള്ളം',
    ta: 'தண்ணீர்',
    te: 'నీరు',
    kn: 'ನೀರು',
    bn: 'জল',
    gu: 'પાણી',
    mr: 'पाणी',
    pa: 'ਪਾਣੀ',
    ur: 'پانی',
  },
  {
    en: 'food',
    hi: 'खाना',
    ml: 'ഭക്ഷണം',
    ta: 'உணவு',
    te: 'ఆహారం',
    kn: 'ಆಹಾರ',
    bn: 'খাবার',
    gu: 'ખોરાક',
    mr: 'अन्न',
    pa: 'ਭੋਜਨ',
    ur: 'کھانا',
  },
  {
    en: 'good morning',
    hi: 'सुप्रभात',
    ml: 'സുപ്രഭാതം',
    ta: 'காலை வணக்கம்',
    te: 'శుభోదయం',
    kn: 'ಶುಭೋದಯ',
    bn: 'সুপ্রভাত',
    gu: 'સુપ્રભાત',
    mr: 'शुभ प्रभात',
    pa: 'ਸ਼ੁਭ ਸਵੇਰ',
    ur: 'صبح بخیر',
  },
  {
    en: 'good night',
    hi: 'शुभ रात्रि',
    ml: 'ശുഭ രാത്രി',
    ta: 'இனிய இரவு',
    te: 'శుభరాత్రి',
    kn: 'ಶುಭ ರಾತ್ರಿ',
    bn: 'শুভ রাত্রি',
    gu: 'શુભ રાત્રી',
    mr: 'शुभ रात्री',
    pa: 'ਸ਼ੁਭ ਰਾਤ',
    ur: 'شب بخیر',
  },
  {
    en: 'how are you',
    hi: 'आप कैसे हैं',
    ml: 'സുഖമാണോ',
    ta: 'எப்படி இருக்கிறீர்கள்',
    te: 'మీరు ఎలా ఉన్నారు',
    kn: 'ನೀವು ಹೇಗಿದ್ದೀರಿ',
    bn: 'আপনি কেমন আছেন',
    gu: 'તમે કેમ છો',
    mr: 'तुम्ही कसे आहात',
    pa: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ',
    ur: 'آپ کیسے ہیں',
  },
  {
    en: 'i am fine',
    hi: 'मैं ठीक हूँ',
    ml: 'എനിക്ക് സുഖമാണ്',
    ta: 'நான் நலமாக இருக்கிறேன்',
    te: 'నేను బాగున్నాను',
    kn: 'ನಾನು ಆರಾಮಾಗಿದ್ದೇನೆ',
    bn: 'আমি ভালো আছি',
    gu: 'હું મજામાં છું',
    mr: 'मी ठीक आहे',
    pa: 'ਮੈਂ ਠੀਕ ਹਾਂ',
    ur: 'میں ٹھیک ہوں',
  },
  {
    en: 'emergency',
    hi: 'आपातकाल',
    ml: 'അടിയന്തിരാവസ്ഥ',
    ta: 'அவசரநிலை',
    te: 'అత్యవసర పరిస్థితి',
    kn: 'ತುರ್ತು ಪರಿಸ್ಥಿತಿ',
    bn: 'জরুরী অবস্থা',
    gu: 'કટોકટી',
    mr: 'आणीबाणी',
    pa: 'ਐਮਰਜੈਂਸੀ',
    ur: 'ہنگامی صورتحال',
  },
  {
    en: 'doctor',
    hi: 'डॉक्टर',
    ml: 'ഡോക്ടർ',
    ta: 'மருத்துவர்',
    te: 'వైద్యుడు',
    kn: 'ವೈದ್ಯರು',
    bn: 'ডাক্তার',
    gu: 'ડોક્ટર',
    mr: 'डॉक्टर',
    pa: 'ਡਾਕਟਰ',
    ur: 'ڈاکٹر',
  },
  {
    en: 'medicine',
    hi: 'दवा',
    ml: 'മരുന്ന്',
    ta: 'மருந்து',
    te: 'మందు',
    kn: 'ಔಷಧಿ',
    bn: 'ওষুধ',
    gu: 'દવા',
    mr: 'औषध',
    pa: 'ਦਵਾਈ',
    ur: 'دوا',
  },
];

/**
 * Rule-based / phrase-level translation engine for starter and common vocabulary.
 *
 * Provides immediate zero-network, zero-download offline translations for bundled
 * phrases, and honestly surfaces the pack requirement for open-ended text.
 */
export class RuleBasedTranslationEngine implements TranslationEngine {
  readonly id = 'rule-based';
  readonly displayName = 'Starter Phrase Translation Engine';

  async translate(
    text: string,
    source: string,
    target: string
  ): Promise<TranslationResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        originalText: text,
        translatedText: '',
        sourceLanguage: source,
        targetLanguage: target,
        engine: this.id,
        confidence: 'exact',
        requiresPack: false,
      };
    }

    const srcLang = primaryLang(source);
    const tgtLang = primaryLang(target);

    // Same language: identity translation
    if (srcLang === tgtLang) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage: source,
        targetLanguage: target,
        engine: this.id,
        confidence: 'exact',
        requiresPack: false,
      };
    }

    const normInput = normalizePhrase(trimmed);

    // 1. Check bundled phrases library
    for (const phrase of BUNDLED_PHRASES) {
      const canonicalNorm = normalizePhrase(phrase.text);
      const isEnglishMatch = srcLang === 'en' && normInput === canonicalNorm;

      // Check translations within bundled phrase
      let isTranslationMatch = false;
      for (const [langCode, translationText] of Object.entries(phrase.translations)) {
        if (primaryLang(langCode) === srcLang && normalizePhrase(translationText) === normInput) {
          isTranslationMatch = true;
          break;
        }
      }

      if (isEnglishMatch || isTranslationMatch) {
        // We matched this phrase! Now resolve the target language text
        if (tgtLang === 'en') {
          return {
            originalText: text,
            translatedText: phrase.text,
            sourceLanguage: source,
            targetLanguage: target,
            engine: this.id,
            confidence: 'exact',
            requiresPack: false,
          };
        }

        // Look for matching target language in translations
        for (const [langCode, translationText] of Object.entries(phrase.translations)) {
          if (primaryLang(langCode) === tgtLang) {
            return {
              originalText: text,
              translatedText: translationText,
              sourceLanguage: source,
              targetLanguage: target,
              engine: this.id,
              confidence: 'exact',
              requiresPack: false,
            };
          }
        }
      }
    }

    // 2. Check common vocabulary dictionary
    for (const entry of COMMON_VOCABULARY) {
      const srcWord = entry[srcLang];
      if (srcWord && normalizePhrase(srcWord) === normInput) {
        const tgtWord = entry[tgtLang];
        if (tgtWord) {
          return {
            originalText: text,
            translatedText: tgtWord,
            sourceLanguage: source,
            targetLanguage: target,
            engine: this.id,
            confidence: 'exact',
            requiresPack: false,
          };
        }
      }
    }

    // 3. Not in rule-based dictionary: honest status per requirement 2
    return {
      originalText: text,
      translatedText: text,
      sourceLanguage: source,
      targetLanguage: target,
      engine: this.id,
      requiresPack: true,
      packId: INDICTRANS2_PACK_ID,
      confidence: 'unavailable',
      note: 'Full translation requires downloadable language pack (IndicTrans2). Common phrases and greetings are available offline.',
    };
  }
}
