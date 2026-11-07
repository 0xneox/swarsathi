import type { SymbolCategory } from '../types';

/**
 * The ARASAAC core-symbol pack: a downloadable set of real pictograms for the board's everyday
 * vocabulary.
 *
 * ARASAAC pictograms are CC BY-NC-SA 4.0 (Government of Aragon, artwork by Sergio Palao). They are
 * never bundled in the APK: installing the pack fetches each image once from `static.arasaac.org`
 * and keeps it on the device, so the board works offline afterwards. Attribution lives in
 * `src/data/credits.ts`, `NOTICE`, and the pack's own manifest.
 *
 * ARASAAC's metadata has no Indic languages, so every entry carries its English wording only. The
 * board already marks those tiles honestly ("Shown in English") rather than pretending a
 * translation exists.
 */

export const ARASAAC_PACK_ID = 'pack-arasaac-core';
export const ARASAAC_PROVIDER_ID = 'arasaac';
export const ARASAAC_PACK_NAME = 'ARASAAC picture library';

/** Where the installed pack lives, alongside the neural voice packs. */
export const ARASAAC_PACK_DIR = 'packs/pack-arasaac-core/';
export const ARASAAC_MANIFEST_PATH = 'manifest.json';
export const ARASAAC_IMAGES_DIR = 'images/';

/**
 * The core vocabulary the pack covers. `term` is what is sent to ARASAAC's English best-search;
 * `label` is the single English wording the symbol contributes to a message. Categories reuse the
 * board's existing ids so ARASAAC pictograms file under the same chips as the emoji set.
 */
export interface ArasaacCoreSymbol {
  /** Stable slug; becomes the symbol id `arasaac-<slug>`. */
  slug: string;
  /** English search text sent to the ARASAAC API. */
  term: string;
  /** The English wording the pictogram contributes when tapped. */
  label: string;
  category: 'everyday' | 'needs' | 'people' | 'actions' | 'feelings' | 'places';
}

export const ARASAAC_CORE_SYMBOLS: ArasaacCoreSymbol[] = [
  // Everyday
  { slug: 'yes', term: 'yes', label: 'yes', category: 'everyday' },
  { slug: 'no', term: 'no', label: 'no', category: 'everyday' },
  { slug: 'please', term: 'please', label: 'please', category: 'everyday' },
  { slug: 'thank-you', term: 'thank you', label: 'thank you', category: 'everyday' },
  { slug: 'sorry', term: 'sorry', label: 'sorry', category: 'everyday' },
  { slug: 'help', term: 'help', label: 'help', category: 'everyday' },
  { slug: 'stop', term: 'stop', label: 'stop', category: 'everyday' },
  { slug: 'go', term: 'go', label: 'go', category: 'actions' },
  { slug: 'come', term: 'come', label: 'come', category: 'actions' },
  { slug: 'wait', term: 'wait', label: 'wait', category: 'actions' },
  { slug: 'now', term: 'now', label: 'now', category: 'everyday' },
  { slug: 'later', term: 'later', label: 'later', category: 'everyday' },
  { slug: 'good', term: 'good', label: 'good', category: 'feelings' },
  { slug: 'bad', term: 'bad', label: 'bad', category: 'feelings' },
  // Needs
  { slug: 'water', term: 'water', label: 'water', category: 'needs' },
  { slug: 'food', term: 'food', label: 'food', category: 'needs' },
  { slug: 'eat', term: 'eat', label: 'eat', category: 'actions' },
  { slug: 'drink', term: 'drink', label: 'drink', category: 'actions' },
  { slug: 'pain', term: 'pain', label: 'pain', category: 'needs' },
  { slug: 'bathroom', term: 'toilet', label: 'bathroom', category: 'needs' },
  { slug: 'sleep', term: 'sleep', label: 'sleep', category: 'actions' },
  { slug: 'tired', term: 'tired', label: 'tired', category: 'feelings' },
  { slug: 'doctor', term: 'doctor', label: 'doctor', category: 'needs' },
  { slug: 'hospital', term: 'hospital', label: 'hospital', category: 'places' },
  { slug: 'medicine', term: 'medicine', label: 'medicine', category: 'needs' },
  { slug: 'ambulance', term: 'ambulance', label: 'ambulance', category: 'needs' },
  { slug: 'call', term: 'telephone', label: 'call', category: 'actions' },
  // People
  { slug: 'i', term: 'I', label: 'I', category: 'people' },
  { slug: 'you', term: 'you', label: 'you', category: 'people' },
  { slug: 'he', term: 'he', label: 'he', category: 'people' },
  { slug: 'she', term: 'she', label: 'she', category: 'people' },
  { slug: 'we', term: 'we', label: 'we', category: 'people' },
  { slug: 'they', term: 'they', label: 'they', category: 'people' },
  { slug: 'man', term: 'man', label: 'man', category: 'people' },
  { slug: 'woman', term: 'woman', label: 'woman', category: 'people' },
  { slug: 'child', term: 'child', label: 'child', category: 'people' },
  { slug: 'family', term: 'family', label: 'family', category: 'people' },
  { slug: 'friend', term: 'friend', label: 'friend', category: 'people' },
  // Actions
  { slug: 'want', term: 'want', label: 'I want', category: 'actions' },
  { slug: 'need', term: 'need', label: 'I need', category: 'actions' },
  { slug: 'like', term: 'like', label: 'I like', category: 'feelings' },
  { slug: 'love', term: 'love', label: 'love', category: 'feelings' },
  { slug: 'speak', term: 'speak', label: 'speak', category: 'actions' },
  { slug: 'understand', term: 'understand', label: 'understand', category: 'actions' },
  { slug: 'write', term: 'write', label: 'write', category: 'actions' },
  { slug: 'read', term: 'read', label: 'read', category: 'actions' },
  { slug: 'listen', term: 'listen', label: 'listen', category: 'actions' },
  { slug: 'look', term: 'look', label: 'look', category: 'actions' },
  { slug: 'give', term: 'give', label: 'give', category: 'actions' },
  { slug: 'take', term: 'take', label: 'take', category: 'actions' },
  { slug: 'open', term: 'open', label: 'open', category: 'actions' },
  { slug: 'close', term: 'close', label: 'close', category: 'actions' },
  { slug: 'wash', term: 'wash', label: 'wash', category: 'actions' },
  // Feelings
  { slug: 'happy', term: 'happy', label: 'happy', category: 'feelings' },
  { slug: 'sad', term: 'sad', label: 'sad', category: 'feelings' },
  { slug: 'angry', term: 'angry', label: 'angry', category: 'feelings' },
  { slug: 'scared', term: 'scared', label: 'scared', category: 'feelings' },
  { slug: 'hungry', term: 'hungry', label: 'hungry', category: 'feelings' },
  { slug: 'thirsty', term: 'thirsty', label: 'thirsty', category: 'feelings' },
  { slug: 'sick', term: 'sick', label: 'sick', category: 'feelings' },
  { slug: 'better', term: 'better', label: 'better', category: 'feelings' },
  // Places
  { slug: 'home', term: 'house', label: 'home', category: 'places' },
  { slug: 'school', term: 'school', label: 'school', category: 'places' },
  { slug: 'shop', term: 'shop', label: 'shop', category: 'places' },
  { slug: 'park', term: 'park', label: 'park', category: 'places' },
  { slug: 'work', term: 'work', label: 'work', category: 'places' },
  { slug: 'car', term: 'car', label: 'car', category: 'places' },
  { slug: 'bus', term: 'bus', label: 'bus', category: 'places' },
];

/** The categories this pack files its pictograms under, matching the board's chip ids. */
export const ARASAAC_PACK_CATEGORIES: SymbolCategory[] = [
  { id: 'everyday', label: 'Everyday' },
  { id: 'needs', label: 'Needs' },
  { id: 'people', label: 'People' },
  { id: 'actions', label: 'Actions' },
  { id: 'feelings', label: 'Feelings' },
  { id: 'places', label: 'Places' },
];

/** One entry inside the installed pack's `manifest.json`. */
export interface ArasaacManifestEntry {
  /** Symbol id on the board, `arasaac-<slug>`. */
  id: string;
  /** The ARASAAC pictogram id the image came from. */
  arasaacId: number;
  /** Absolute `file://` URI of the downloaded PNG. */
  image: string;
  /** English wording the symbol contributes; ARASAAC has no Indic metadata. */
  words: Record<string, string>;
  /** The board category this pictogram files under. */
  category: ArasaacCoreSymbol['category'];
}

export interface ArasaacManifest {
  packId: string;
  version: number;
  generatedAt: number;
  categories: SymbolCategory[];
  entries: ArasaacManifestEntry[];
}
