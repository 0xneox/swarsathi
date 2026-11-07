export type SupportedTransliterationScript =
  | 'Deva'
  | 'Beng'
  | 'Taml'
  | 'Telu'
  | 'Knda'
  | 'Mlym'
  | 'Gujr'
  | 'Guru'
  | 'Orya'
  | 'Arab';

export interface BrahmicScriptDefinition {
  script: SupportedTransliterationScript;
  virama: string;
  anusvara?: string;
  visarga?: string;
  // Independent vowels (when starting a word or following another vowel)
  independentVowels: Record<string, string>;
  // Dependent vowel signs (matras attached to consonants)
  matras: Record<string, string>;
  // Consonants
  consonants: Record<string, string>;
  // Special digraphs or multi-char consonants if any
  specialConsonants?: Record<string, string>;
}

export interface PersoArabicScriptDefinition {
  script: 'Arab';
  letters: Record<string, string>;
  initialVowels: Record<string, string>;
  medialVowels: Record<string, string>;
}
