import type { NeuralModel, NeuralSharedResource } from '../types';

/**
 * Catalogue of offline neural voices.
 *
 * Every number below was read from the upstream publisher, not estimated:
 *
 * * `downloadBytes` and `sha256` come from the GitHub releases API for
 *   `k2-fsa/sherpa-onnx`, tag `tts-models`.
 * * `requiredFiles[].bytes` are the ONNX sizes published by the Hugging Face API for
 *   `rhasspy/piper-voices`, which is where these voices originate.
 * * `licence` is transcribed from each voice's own `MODEL_CARD`.
 *
 * Only languages with a voice that genuinely exists are listed here. Hindi and Malayalam are the
 * only Indian languages with a converted Piper voice today; there is no Tamil, Telugu or Kannada
 * voice, so none is advertised. Those languages stay on the Android engine.
 *
 * ## Licensing, stated plainly
 *
 * The SwarSathi source is Apache-2.0 and no model is bundled in the APK. Each voice is downloaded
 * by the user straight from the publisher. Even so, the licences are not uniformly permissive:
 * the Hindi voices are trained on AI4Bharat data released under CC BY-NC-SA 4.0, and the Malayalam
 * voices' dataset states "See URL". `licence` and `licenceUrl` are surfaced in Settings so the
 * choice is made with the facts in front of it. See `NOTICE` for the full text.
 */

/** The base URL every model archive is published under. */
export const NEURAL_TTS_RELEASE_BASE =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models';

/** The inference runtime the offline engine links against. Not downloaded at runtime. */
export const NEURAL_RUNTIME = {
  name: 'sherpa-onnx',
  version: 'v2.0.1',
  licence: 'Apache-2.0',
  attribution: 'sherpa-onnx — Apache License 2.0 — © 2023-2024 the sherpa-onnx authors (k2-fsa).',
} as const;

/** Name of the phonemiser data every Piper voice depends on. Shared, so it is downloaded once. */
export const ESPEAK_NG_DATA: NeuralSharedResource = {
  id: 'espeak-ng-data',
  displayName: 'Voice phonemiser data (shared)',
  downloadBytes: 9_037_020,
  downloadUrl: `${NEURAL_TTS_RELEASE_BASE}/espeak-ng-data.zip`,
  archive: 'zip',
  sha256: 'bc4525eafe31b4e3f5e43aea495f3169e97dd2544f1bbfe95514ce8a61baee39',
  licence: 'GPL-3.0-or-later',
  attribution:
    'espeak-ng data — GNU GPL v3 or later — © the espeak-ng contributors (https://github.com/espeak-ng/espeak-ng).',
  directoryName: 'espeak-ng-data',
  sentinelFile: 'phontab',
};

/** Voice metadata that is identical for every Piper voice in this catalogue. */
const PIPER_COMMON = {
  archive: 'tar.bz2' as const,
  requiresEspeakData: true,
  // The native extractor normalises the archive so the graph and the token table always land under
  // these two names, whatever the upstream archive happens to call them.
  requiredFiles: [
    { path: 'tokens.txt' },
    { path: 'model.onnx' },
  ] as NeuralModel['requiredFiles'],
};

/** Every offline voice SwarSathi knows how to install. */
export const NEURAL_MODELS: NeuralModel[] = [
  {
    ...PIPER_COMMON,
    id: 'vits-piper-ml_IN-arjun-medium',
    language: 'ml-IN',
    voiceName: 'arjun',
    displayName: 'Malayalam — Arjun (male)',
    downloadBytes: 67_222_458,
    downloadUrl: `${NEURAL_TTS_RELEASE_BASE}/vits-piper-ml_IN-arjun-medium.tar.bz2`,
    sha256: '3058d098e8b1ffcdd6069e96b1d492f319333235912a627c309c7c54cea59acf',
    licence: 'See upstream (Malayalam speech corpus on Kaggle)',
    licenceUrl: 'https://www.kaggle.com/code/mpwolke/indic-tts-malayalam-speech-corpus',
    attribution:
      'Piper voice "arjun" (ml_IN, medium) trained on the Indic TTS Malayalam speech corpus; converted for sherpa-onnx by k2-fsa.',
    requiredFiles: [
      { path: 'tokens.txt' },
      { path: 'model.onnx', bytes: 62_950_044 },
    ],
  },
  {
    ...PIPER_COMMON,
    id: 'vits-piper-ml_IN-meera-medium',
    language: 'ml-IN',
    voiceName: 'meera',
    displayName: 'Malayalam — Meera (female)',
    downloadBytes: 67_195_010,
    downloadUrl: `${NEURAL_TTS_RELEASE_BASE}/vits-piper-ml_IN-meera-medium.tar.bz2`,
    sha256: 'c8d870441e60870b7e8781c26eb22104aff51587b63bee94aba5e5f6c9fbb71f',
    licence: 'See upstream (Malayalam speech corpus on Kaggle)',
    licenceUrl: 'https://www.kaggle.com/code/mpwolke/indic-tts-malayalam-speech-corpus',
    attribution:
      'Piper voice "meera" (ml_IN, medium) trained on the Indic TTS Malayalam speech corpus; converted for sherpa-onnx by k2-fsa.',
    requiredFiles: [
      { path: 'tokens.txt' },
      { path: 'model.onnx', bytes: 62_950_044 },
    ],
  },
  {
    ...PIPER_COMMON,
    id: 'vits-piper-hi_IN-pratham-medium',
    language: 'hi-IN',
    voiceName: 'pratham',
    displayName: 'Hindi — Pratham (male)',
    downloadBytes: 67_238_438,
    downloadUrl: `${NEURAL_TTS_RELEASE_BASE}/vits-piper-hi_IN-pratham-medium.tar.bz2`,
    sha256: '2084d321e1d2752f2b64ed3012ba27751df01a80da46f52920098cdcb7e35648',
    licence: 'CC BY-NC-SA 4.0 (non-commercial)',
    licenceUrl: 'http://creativecommons.org/licenses/by-nc-sa/4.0/',
    attribution:
      'Piper voice "pratham" (hi_IN, medium) trained on AI4Bharat indicnlp_corpus by PravalX; converted for sherpa-onnx by k2-fsa.',
    requiredFiles: [
      { path: 'tokens.txt' },
      { path: 'model.onnx', bytes: 63_516_050 },
    ],
  },
  {
    ...PIPER_COMMON,
    id: 'vits-piper-hi_IN-priyamvada-medium',
    language: 'hi-IN',
    voiceName: 'priyamvada',
    displayName: 'Hindi — Priyamvada (female)',
    downloadBytes: 67_240_610,
    downloadUrl: `${NEURAL_TTS_RELEASE_BASE}/vits-piper-hi_IN-priyamvada-medium.tar.bz2`,
    sha256: '399d91cc97eb288725633261f26b715f9a971e3bf7ec4fa1d7910cd0080d37eb',
    licence: 'CC BY-NC-SA 4.0 (non-commercial)',
    licenceUrl: 'http://creativecommons.org/licenses/by-nc-sa/4.0/',
    attribution:
      'Piper voice "priyamvada" (hi_IN, medium) trained on AI4Bharat indicnlp_corpus by PravalX; converted for sherpa-onnx by k2-fsa.',
    requiredFiles: [
      { path: 'tokens.txt' },
      { path: 'model.onnx', bytes: 63_516_050 },
    ],
  },
  {
    ...PIPER_COMMON,
    id: 'vits-piper-hi_IN-rohan-medium',
    language: 'hi-IN',
    voiceName: 'rohan',
    displayName: 'Hindi — Rohan (male)',
    downloadBytes: 67_221_139,
    downloadUrl: `${NEURAL_TTS_RELEASE_BASE}/vits-piper-hi_IN-rohan-medium.tar.bz2`,
    sha256: 'f0bb7781724951e9c90c49f68abfe821cffcbc198a9ae0031366d045a6ad5488',
    licence: 'IITM IndicTTS licence (see URL)',
    licenceUrl: 'https://www.iitm.ac.in/donlab/indictts/downloads/license.pdf',
    attribution:
      'Piper voice "rohan" (hi_IN, medium) trained on the IITM IndicTTS Hindi Mono Male corpus; converted for sherpa-onnx by k2-fsa.',
    requiredFiles: [
      { path: 'tokens.txt' },
      { path: 'model.onnx', bytes: 62_950_044 },
    ],
  },
];

const MODEL_BY_ID = new Map(NEURAL_MODELS.map((model) => [model.id, model]));

export function getNeuralModel(id: string): NeuralModel | undefined {
  return MODEL_BY_ID.get(id);
}

/** Every catalogue voice for a language, in catalogue order. */
export function getNeuralModelsForLanguage(languageCode: string): NeuralModel[] {
  return NEURAL_MODELS.filter((model) => model.language === languageCode);
}

/**
 * The languages the offline engine can speak once the right model is installed.
 *
 * Deliberately derived from the catalogue rather than written out by hand, so the Settings screen
 * can never advertise a language that has no installable voice.
 */
export const NEURAL_LANGUAGE_CODES: string[] = [
  ...new Set(NEURAL_MODELS.map((model) => model.language)),
];

/** True when an offline voice exists for this language. */
export function hasNeuralVoice(languageCode: string): boolean {
  return NEURAL_MODELS.some((model) => model.language === languageCode);
}

/** Formats a byte count the way the download rows show it: `64.1 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${megabytes.toFixed(1)} MB`;
}
