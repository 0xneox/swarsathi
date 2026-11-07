import {
  RuleBasedTranslationEngine,
  IndicTrans2Adapter,
  CompositeTranslationEngine,
  getDefaultTranslationEngine,
} from '../../src/services/translation';
import {
  INDICTRANS2_PACK_ID,
  INDICTRANS2_PACK_DESCRIPTOR,
} from '../../src/services/packs/indicTransPack';
import { InMemoryInstalledPackRepository } from '../../src/services/storage/packs';
import type { InstalledPack } from '../../src/types';

describe('INDICTRANS2_PACK_DESCRIPTOR', () => {
  it('has valid manifest attributes per Tier-1 specifications', () => {
    expect(INDICTRANS2_PACK_DESCRIPTOR.id).toBe(INDICTRANS2_PACK_ID);
    expect(INDICTRANS2_PACK_DESCRIPTOR.kind).toBe('translation');
    expect(INDICTRANS2_PACK_DESCRIPTOR.displayName).toContain('IndicTrans2');
    expect(INDICTRANS2_PACK_DESCRIPTOR.downloadBytes).toBeGreaterThan(50_000_000);
    expect(INDICTRANS2_PACK_DESCRIPTOR.requiredFiles.length).toBeGreaterThan(0);
    expect(INDICTRANS2_PACK_DESCRIPTOR.licence).toContain('MIT');
  });
});

describe('RuleBasedTranslationEngine', () => {
  let engine: RuleBasedTranslationEngine;

  beforeEach(() => {
    engine = new RuleBasedTranslationEngine();
  });

  it('translates bundled emergency and daily needs phrases accurately', async () => {
    const resultEnToHi = await engine.translate('Please help me.', 'en-IN', 'hi-IN');
    expect(resultEnToHi.translatedText).toBe('कृपया मेरी मदद करें।');
    expect(resultEnToHi.requiresPack).toBe(false);
    expect(resultEnToHi.confidence).toBe('exact');

    const resultEnToMl = await engine.translate('Please help me.', 'en-IN', 'ml-IN');
    expect(resultEnToMl.translatedText).toBe('ദയവായി എന്നെ സഹായിക്കൂ.');
    expect(resultEnToMl.requiresPack).toBe(false);

    const resultMlToEn = await engine.translate('ഒരു ആംബുലൻസ് വിളിക്കൂ.', 'ml-IN', 'en-IN');
    expect(resultMlToEn.translatedText).toBe('Call an ambulance.');
    expect(resultMlToEn.requiresPack).toBe(false);
  });

  it('translates common everyday greetings and vocabulary', async () => {
    const helloResult = await engine.translate('hello', 'en-IN', 'hi-IN');
    expect(helloResult.translatedText).toContain('नमस्ते');
    expect(helloResult.requiresPack).toBe(false);

    const waterResult = await engine.translate('water', 'en-IN', 'ml-IN');
    expect(waterResult.translatedText).toBe('വെള്ളം');
    expect(waterResult.requiresPack).toBe(false);

    const thanksResult = await engine.translate('thank you', 'en-IN', 'ta-IN');
    expect(thanksResult.translatedText).toContain('நன்றி');
    expect(thanksResult.requiresPack).toBe(false);
  });

  it('is case-insensitive and trims punctuation', async () => {
    const res1 = await engine.translate('  PLEASE HELP ME!  ', 'en-IN', 'hi-IN');
    expect(res1.translatedText).toBe('कृपया मेरी मदद करें।');

    const res2 = await engine.translate('Doctor?', 'en-IN', 'ml-IN');
    expect(res2.translatedText).toBe('ഡോക്ടർ');
  });

  it('returns identity translation when source and target languages match', async () => {
    const res = await engine.translate('Hello world', 'en-IN', 'en-US');
    expect(res.translatedText).toBe('Hello world');
    expect(res.requiresPack).toBe(false);
    expect(res.confidence).toBe('exact');
  });

  it('handles empty input gracefully', async () => {
    const res = await engine.translate('   ', 'en-IN', 'hi-IN');
    expect(res.translatedText).toBe('');
    expect(res.requiresPack).toBe(false);
  });

  it('honestly reports pack requirement for open-ended phrases not in starter vocabulary', async () => {
    const unmapped = 'The quick brown fox jumps over the lazy dog in Bangalore.';
    const res = await engine.translate(unmapped, 'en-IN', 'hi-IN');
    expect(res.requiresPack).toBe(true);
    expect(res.packId).toBe(INDICTRANS2_PACK_ID);
    expect(res.confidence).toBe('unavailable');
    expect(res.note).toContain('IndicTrans2');
  });
});

describe('IndicTrans2Adapter', () => {
  it('reports honest uninstalled state when pack is not on device', async () => {
    const repo = new InMemoryInstalledPackRepository();
    const adapter = new IndicTrans2Adapter(repo);

    expect(await adapter.isPackInstalled()).toBe(false);
    const res = await adapter.translate('Custom sentence', 'en-IN', 'hi-IN');
    expect(res.requiresPack).toBe(true);
    expect(res.packId).toBe(INDICTRANS2_PACK_ID);
    expect(res.note).toContain('not installed');
  });

  it('uses adapter when pack is installed and verified', async () => {
    const repo = new InMemoryInstalledPackRepository();
    const installedPack: InstalledPack = {
      packId: INDICTRANS2_PACK_ID,
      kind: 'translation',
      language: 'mul',
      directory: 'file:///packs/indictrans2/',
      bytes: 188_743_680,
      verified: true,
      installedAt: Date.now(),
    };
    await repo.save(installedPack);

    const adapter = new IndicTrans2Adapter(repo);
    expect(await adapter.isPackInstalled()).toBe(true);

    const res = await adapter.translate('Arbitrary text', 'en-IN', 'hi-IN');
    expect(res.requiresPack).toBe(false);
    expect(res.note).toContain('IndicTrans2');
  });
});

describe('CompositeTranslationEngine', () => {
  it('prefers rule-based translation for known phrases', async () => {
    const engine = new CompositeTranslationEngine(null);
    const res = await engine.translate('Please help me.', 'en-IN', 'hi-IN');
    expect(res.translatedText).toBe('कृपया मेरी मदद करें।');
    expect(res.requiresPack).toBe(false);
  });

  it('falls back to pack requirement for unknown phrases when pack is missing', async () => {
    const engine = getDefaultTranslationEngine(new InMemoryInstalledPackRepository());
    const res = await engine.translate('A very long and completely unique phrase.', 'en-IN', 'hi-IN');
    expect(res.requiresPack).toBe(true);
    expect(res.packId).toBe(INDICTRANS2_PACK_ID);
  });
});
