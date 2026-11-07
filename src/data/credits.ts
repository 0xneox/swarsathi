import { ESPEAK_NG_DATA, NEURAL_MODELS, NEURAL_RUNTIME } from './neuralModels';

/**
 * Third-party credits for the screens and the shipped `NOTICE`.
 *
 * SwarSathi bundles no third-party artwork, voice or data inside the APK. Every pictogram pack
 * and voice model is a user-initiated download taken directly from its publisher. This module
 * holds the attribution strings the licence terms require, so the Credits screen can show them
 * without the exact wording being re-typed at each call site.
 *
 * The remaining facts live in one place each and are read from there rather than repeated here:
 * the offline runtime and the shared espeak-ng data constants come from `neuralModels.ts`, and the
 * full prose notice is the repository's `NOTICE` file. Only the ARASAAC string and the licence
 * posture summary are new, because no other module states them yet.
 */

/** The ARASAAC pictogram set, credited exactly as its licence requires. */
export interface ArasaacCredit {
  name: string;
  licence: string;
  /** Human-readable licence deed, shown verbatim so the claim can be checked. */
  licenceUrl: string;
  /** The required attribution line, reproduced word for word. */
  attribution: string;
  origin: string;
  /** Why the pictograms never travel inside the app. */
  downloadOnlyNote: string;
}

/**
 * The ARASAAC credit.
 *
 * The attribution string is the one ARASAAC's CC BY-NC-SA 4.0 terms require, kept verbatim.
 */
export const ARASAAC_CREDIT: ArasaacCredit = {
  name: 'ARASAAC pictograms',
  licence: 'CC BY-NC-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  attribution:
    'Pictograms: Author: Sergio Palao. Origin: ARASAAC (https://arasaac.org). License: CC BY-NC-SA 4.0. Government of Aragon (Spain).',
  origin: 'Government of Aragon (Spain)',
  downloadOnlyNote:
    'Downloaded only when you ask for a symbol pack, straight from the publisher. Never bundled in the app, not for commercial use, and any symbol work derived from it must keep the same licence.',
};

/** SwarSathi's own licence, shown as the intro line on the Credits screen. */
export const SWARSATHI_LICENCE = {
  name: 'SwarSathi',
  licence: 'Apache-2.0',
  licenceUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
} as const;

/** One third-party component, flattened so it drops straight onto a card. */
export interface ThirdPartyCredit {
  /** Stable key, also used as the card testID suffix. */
  id: string;
  name: string;
  licence: string;
  /** Present only when a single, canonical licence URL exists. */
  licenceUrl?: string;
  attribution: string;
  /** True only for code linked into the app; every downloadable asset is false. */
  bundled: boolean;
}

/**
 * One short paragraph explaining why nothing third-party travels in the binary.
 *
 * Kept as data rather than screen copy so the wording matches the `NOTICE` file.
 */
export const NO_BUNDLED_WORK_EXPLANATION =
  'SwarSathi ships no third-party artwork or voices inside the app. Every pictogram pack and voice model is downloaded directly from its publisher, only when you ask for it. That keeps the download small and keeps each publisher\u2019s licence terms honest; the only third-party code compiled in is the permissively licensed sherpa-onnx runtime.';

// The Piper voices share one credit entry, but their licences are not uniform. The distinct
// strings are read from the catalogue rather than transcribed, so the two can never drift apart.
const PIPER_LICENCES = Array.from(new Set(NEURAL_MODELS.map((model) => model.licence)));
const PIPER_ATTRIBUTIONS = Array.from(new Set(NEURAL_MODELS.map((model) => model.attribution)));
const PIPER_LICENCE_URLS = Array.from(
  new Set(
    NEURAL_MODELS.map((model) => model.licenceUrl).filter((url): url is string => Boolean(url))
  )
);

/** Every third-party component, in the order the licence notice lists them. */
export const CREDITS: ThirdPartyCredit[] = [
  {
    id: 'arasaac',
    name: ARASAAC_CREDIT.name,
    licence: ARASAAC_CREDIT.licence,
    licenceUrl: ARASAAC_CREDIT.licenceUrl,
    attribution: ARASAAC_CREDIT.attribution,
    bundled: false,
  },
  {
    id: 'sherpa-onnx',
    name: `${NEURAL_RUNTIME.name} runtime`,
    licence: NEURAL_RUNTIME.licence,
    attribution: NEURAL_RUNTIME.attribution,
    bundled: true,
  },
  {
    id: 'piper-voices',
    name: 'Piper voices (offline neural speech models)',
    licence: PIPER_LICENCES.join(' \u00b7 '),
    attribution: [...PIPER_ATTRIBUTIONS, `Licence URLs: ${PIPER_LICENCE_URLS.join(' ')}`].join(' '),
    bundled: false,
  },
  {
    id: 'espeak-ng-data',
    name: 'espeak-ng data (voice phonemiser)',
    licence: ESPEAK_NG_DATA.licence,
    attribution: ESPEAK_NG_DATA.attribution,
    bundled: false,
  },
];
