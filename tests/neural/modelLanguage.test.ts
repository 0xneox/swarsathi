import { LANGUAGES } from '../../src/data/languages';
import {
  NEURAL_LANGUAGE_CODES,
  NEURAL_MODELS,
  hasNeuralVoice,
} from '../../src/data/neuralModels';

describe('language availability cross-check', () => {
  it('every language in LANGUAGES with a neural voice has its code in NEURAL_LANGUAGE_CODES', () => {
    for (const lang of LANGUAGES) {
      if (hasNeuralVoice(lang.code)) {
        expect(NEURAL_LANGUAGE_CODES).toContain(lang.code);
      }
    }
  });

  it('ta-IN does not have a neural voice', () => {
    expect(hasNeuralVoice('ta-IN')).toBe(false);
  });

  it('te-IN does not have a neural voice', () => {
    expect(hasNeuralVoice('te-IN')).toBe(false);
  });

  it('kn-IN does not have a neural voice', () => {
    expect(hasNeuralVoice('kn-IN')).toBe(false);
  });

  it('en-IN does not have a neural voice', () => {
    expect(hasNeuralVoice('en-IN')).toBe(false);
  });
});

describe('NEURAL_MODELS structure', () => {
  it('all NEURAL_MODELS have requiresEspeakData: true', () => {
    for (const model of NEURAL_MODELS) {
      expect(model.requiresEspeakData).toBe(true);
    }
  });

  it('all NEURAL_MODELS have archive: "tar.bz2"', () => {
    for (const model of NEURAL_MODELS) {
      expect(model.archive).toBe('tar.bz2');
    }
  });

  it('every NEURAL_MODEL requiredFiles contains entries with paths "tokens.txt" and "model.onnx"', () => {
    for (const model of NEURAL_MODELS) {
      const paths = model.requiredFiles.map((f) => f.path);
      expect(paths).toContain('tokens.txt');
      expect(paths).toContain('model.onnx');
    }
  });

  it('no NEURAL_MODEL has language ta-IN, te-IN, or kn-IN', () => {
    const excluded = ['ta-IN', 'te-IN', 'kn-IN'];
    for (const model of NEURAL_MODELS) {
      expect(excluded).not.toContain(model.language);
    }
  });
});
