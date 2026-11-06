import {
  ESPEAK_NG_DATA,
  NEURAL_LANGUAGE_CODES,
  NEURAL_MODELS,
  formatBytes,
  getNeuralModel,
  getNeuralModelsForLanguage,
  hasNeuralVoice,
} from '../../src/data/neuralModels';

const HEX64 = /^[0-9a-f]{64}$/i;

describe('NEURAL_MODELS catalogue', () => {
  it('has at least 5 entries', () => {
    expect(NEURAL_MODELS.length).toBeGreaterThanOrEqual(5);
  });

  it('every model has non-empty required string fields', () => {
    for (const model of NEURAL_MODELS) {
      expect(model.id.length).toBeGreaterThan(0);
      expect(model.language.length).toBeGreaterThan(0);
      expect(model.voiceName.length).toBeGreaterThan(0);
      expect(model.displayName.length).toBeGreaterThan(0);
      expect(model.downloadUrl.length).toBeGreaterThan(0);
      expect(model.sha256.length).toBeGreaterThan(0);
      expect(model.licence.length).toBeGreaterThan(0);
      expect(model.attribution.length).toBeGreaterThan(0);
    }
  });

  it('every model sha256 is exactly 64 hex characters', () => {
    for (const model of NEURAL_MODELS) {
      expect(model.sha256).toMatch(HEX64);
    }
  });

  it('every model downloadUrl starts with https://', () => {
    for (const model of NEURAL_MODELS) {
      expect(model.downloadUrl.startsWith('https://')).toBe(true);
    }
  });

  it('every model downloadBytes is > 0', () => {
    for (const model of NEURAL_MODELS) {
      expect(model.downloadBytes).toBeGreaterThan(0);
    }
  });
});

describe('getNeuralModel', () => {
  it('returns the model for a known id', () => {
    const model = NEURAL_MODELS[0];
    expect(getNeuralModel(model.id)).toBe(model);
  });

  it('returns undefined for an unknown id', () => {
    expect(getNeuralModel('nonexistent-model-id')).toBeUndefined();
  });
});

describe('getNeuralModelsForLanguage', () => {
  it('returns exactly the Malayalam models for ml-IN', () => {
    const result = getNeuralModelsForLanguage('ml-IN');
    expect(result.length).toBeGreaterThan(0);
    for (const model of result) {
      expect(model.language).toBe('ml-IN');
    }
    const allMalay = NEURAL_MODELS.filter((m) => m.language === 'ml-IN');
    expect(result).toHaveLength(allMalay.length);
  });

  it('returns exactly the Hindi models for hi-IN', () => {
    const result = getNeuralModelsForLanguage('hi-IN');
    expect(result.length).toBeGreaterThan(0);
    for (const model of result) {
      expect(model.language).toBe('hi-IN');
    }
    const allHindi = NEURAL_MODELS.filter((m) => m.language === 'hi-IN');
    expect(result).toHaveLength(allHindi.length);
  });

  it('returns an empty array for ta-IN (no Tamil model)', () => {
    expect(getNeuralModelsForLanguage('ta-IN')).toEqual([]);
  });
});

describe('NEURAL_LANGUAGE_CODES', () => {
  it('contains ml-IN and hi-IN', () => {
    expect(NEURAL_LANGUAGE_CODES).toContain('ml-IN');
    expect(NEURAL_LANGUAGE_CODES).toContain('hi-IN');
  });

  it('does NOT contain ta-IN, te-IN, or kn-IN', () => {
    expect(NEURAL_LANGUAGE_CODES).not.toContain('ta-IN');
    expect(NEURAL_LANGUAGE_CODES).not.toContain('te-IN');
    expect(NEURAL_LANGUAGE_CODES).not.toContain('kn-IN');
  });
});

describe('hasNeuralVoice', () => {
  it('returns true for ml-IN', () => {
    expect(hasNeuralVoice('ml-IN')).toBe(true);
  });

  it('returns false for ta-IN', () => {
    expect(hasNeuralVoice('ta-IN')).toBe(false);
  });
});

describe('formatBytes', () => {
  it('formatBytes(0) returns "0 MB"', () => {
    expect(formatBytes(0)).toBe('0 MB');
  });

  it('formatBytes(67_222_458) returns a string ending in " MB"', () => {
    const result = formatBytes(67_222_458);
    expect(result.endsWith(' MB')).toBe(true);
  });

  it('formatBytes(1023) returns a string ending in " KB"', () => {
    const result = formatBytes(1023);
    expect(result.endsWith(' KB')).toBe(true);
  });
});

describe('ESPEAK_NG_DATA shared resource', () => {
  it('has id espeak-ng-data', () => {
    expect(ESPEAK_NG_DATA.id).toBe('espeak-ng-data');
  });

  it('has archive zip', () => {
    expect(ESPEAK_NG_DATA.archive).toBe('zip');
  });

  it('has a 64 hex char sha256', () => {
    expect(ESPEAK_NG_DATA.sha256).toMatch(HEX64);
  });

  it('has sentinelFile "phontab"', () => {
    expect(ESPEAK_NG_DATA.sentinelFile).toBe('phontab');
  });
});
