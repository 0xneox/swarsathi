import type { InstalledPack, PackDescriptor, PackKind } from '../types';
import { NEURAL_TTS_RELEASE_BASE } from './neuralModels';

/**
 * Catalogue of downloadable offline packs.
 *
 * A pack is not bundled with SwarSathi. It is a single file the user fetches straight from the
 * entity that publishes it — here, the sherpa-onnx project on GitHub — so the download stays small
 * and the redistribution obligation stays with the publisher. The catalogue only records what
 * *can* be installed; nothing ships in the APK.
 *
 * Every number below was read from the upstream publisher, not estimated:
 *
 * * `downloadBytes` and `sha256` come from the GitHub releases API for `k2-fsa/sherpa-onnx`,
 *   tag `tts-models`.
 * * `requiredFiles[].bytes` are the ONNX sizes published by the Hugging Face API for
 *   `rhasspy/piper-voices`, which is where this voice originates.
 * * `licence` is transcribed from the voice's own `MODEL_CARD`.
 *
 * ## Licensing, stated plainly
 *
 * The SwarSathi source is Apache-2.0 and no pack is bundled in the APK. This voice is downloaded by
 * the user straight from the publisher. Its dataset licence is not fully stated upstream, so
 * `licence` and `licenceUrl` are surfaced in Settings and the choice is made with the facts in
 * front of it. See `NOTICE` for the full text.
 */

/** Every offline pack SwarSathi knows how to install. */
export const PACKS: PackDescriptor[] = [
  {
    id: 'pack-ml-arjun-neural-voice',
    kind: 'voice',
    displayName: 'Malayalam — Arjun (offline neural voice)',
    description:
      'Enhanced offline text to speech for Malayalam, fetched once from the sherpa-onnx release and spoken entirely on-device.',
    language: 'ml-IN',
    downloadBytes: 67_222_458,
    downloadUrl: `${NEURAL_TTS_RELEASE_BASE}/vits-piper-ml_IN-arjun-medium.tar.bz2`,
    archive: 'tar.bz2',
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
];

const PACK_BY_ID = new Map(PACKS.map((pack) => [pack.id, pack]));

export function getPack(id: string): PackDescriptor | undefined {
  return PACK_BY_ID.get(id);
}

/** Every catalogue pack for a kind, in catalogue order. */
export function getPacksForKind(kind: PackKind): PackDescriptor[] {
  return PACKS.filter((pack) => pack.kind === kind);
}

/** Every catalogue pack for a language, in catalogue order. */
export function getPacksForLanguage(languageCode: string): PackDescriptor[] {
  return PACKS.filter((pack) => pack.language === languageCode);
}

/**
 * The catalogue grouped by kind.
 *
 * Deliberately derived from `PACKS` rather than written out by hand, so a screen can never show a
 * kind that has no installable pack.
 */
export const PACKS_BY_KIND: Record<PackKind, PackDescriptor[]> = {
  voice: getPacksForKind('voice'),
  symbols: getPacksForKind('symbols'),
  translation: getPacksForKind('translation'),
};

/** All catalogue packs that have no install record and are therefore available to download. */
export function getAvailablePacks(installed: InstalledPack[]): PackDescriptor[] {
  const installedIds = new Set(installed.map((pack) => pack.packId));
  return PACKS.filter((pack) => !installedIds.has(pack.id));
}
