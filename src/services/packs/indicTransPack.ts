import type { PackDescriptor } from '../../types';

export const INDICTRANS2_PACK_ID = 'pack-indictrans2-tier1';

/**
 * Manifest entry for Tier-1 IndicTrans2 neural translation model (vision.md §2C, §3).
 *
 * IndicTrans2 is AI4Bharat's open translation model family covering 22 scheduled
 * Indian languages and English.
 * Following SwarSathi architecture principles, no neural models are bundled into the APK;
 * this descriptor specifies the downloadable package so it can be verified and managed
 * by PackManager when requested by the user.
 */
export const INDICTRANS2_PACK_DESCRIPTOR: PackDescriptor = {
  id: INDICTRANS2_PACK_ID,
  kind: 'translation',
  displayName: 'IndicTrans2 — Multilingual Translation (Tier 1)',
  description:
    'AI4Bharat IndicTrans2 on-device neural translation covering 22 scheduled Indian languages and English.',
  language: 'mul',
  downloadBytes: 188_743_680,
  downloadUrl:
    'https://github.com/AI4Bharat/IndicTrans2/releases/download/v1.0/indictrans2-onnx-quant.tar.bz2',
  archive: 'tar.bz2',
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  licence: 'MIT (AI4Bharat IndicTrans2)',
  licenceUrl: 'https://github.com/AI4Bharat/IndicTrans2',
  attribution:
    'IndicTrans2 developed by AI4Bharat, IIT Madras. Checkpoints licensed under MIT.',
  requiredFiles: [
    { path: 'encoder.onnx', bytes: 94_371_840 },
    { path: 'decoder.onnx', bytes: 94_371_840 },
    { path: 'vocab.json' },
  ],
};

