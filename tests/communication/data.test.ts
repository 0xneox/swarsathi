import {
  EMERGENCY_MESSAGE_CATALOGUE,
  HISTORY_LIMIT_MAX,
  HISTORY_LIMIT_MIN,
  QUICK_MESSAGE_CATALOGUE,
  buildEmergencyMessages,
  buildHomeCards,
  buildQuickSuggestions,
  clampHistoryLimit,
  communicationKey,
  defaultHomeCardConfigs,
  getEmergencyDefinition,
  normalizeHomeCardConfigs,
  rankFrequent,
  resolveEmergencyText,
  resolveHomeCard,
  timeOfDayFor,
  trimHistory,
} from '../../src/data/communication';
import type { CommunicationEntry, FrequentMessage, HomeCardConfig } from '../../src/types';

describe('quick communication catalogue', () => {
  it('offers the ten messages the brief requires', () => {
    expect(QUICK_MESSAGE_CATALOGUE).toHaveLength(10);
    expect(QUICK_MESSAGE_CATALOGUE.map((definition) => definition.label)).toEqual([
      'Yes',
      'No',
      'I need help',
      'I am in pain',
      'I need water',
      'I need food',
      'I need the bathroom',
      'Please wait',
      'Call my family',
      'Thank you',
    ]);
  });

  it('starts every card enabled, in catalogue order', () => {
    const configs = defaultHomeCardConfigs();
    expect(configs).toHaveLength(10);
    configs.forEach((config, index) => {
      expect(config.sortOrder).toBe(index);
      expect(config.enabled).toBe(true);
    });
  });
});

describe('normalizeHomeCardConfigs', () => {
  it('restores a complete list when nothing has been stored', () => {
    const configs = normalizeHomeCardConfigs([]);
    expect(configs.map((config) => config.key)).toEqual(
      QUICK_MESSAGE_CATALOGUE.map((definition) => definition.key)
    );
    expect(configs.every((config) => config.enabled)).toBe(true);
  });

  it('ignores unknown keys and drops duplicates', () => {
    const stored: HomeCardConfig[] = [
      { key: 'yes', sortOrder: 0, enabled: false },
      { key: 'yes', sortOrder: 1, enabled: true },
      { key: 'not-a-card', sortOrder: 2, enabled: true },
    ];
    const configs = normalizeHomeCardConfigs(stored);
    expect(configs.filter((config) => config.key === 'yes')).toHaveLength(1);
    expect(configs.some((config) => config.key === 'not-a-card')).toBe(false);
  });

  it('keeps the user order and the hidden state, and renumbers the positions', () => {
    const stored: HomeCardConfig[] = [
      { key: 'thanks', sortOrder: 0, enabled: false },
      { key: 'no', sortOrder: 1, enabled: true },
    ];
    const configs = normalizeHomeCardConfigs(stored);
    expect(configs[0]).toMatchObject({ key: 'thanks', enabled: false, sortOrder: 0 });
    expect(configs[1]).toMatchObject({ key: 'no', enabled: true, sortOrder: 1 });
    // Every catalogue key still appears exactly once.
    expect(new Set(configs.map((config) => config.key)).size).toBe(10);
  });
});

describe('buildHomeCards', () => {
  it('renders only enabled cards, resolved for the active language', () => {
    const configs = normalizeHomeCardConfigs(defaultHomeCardConfigs()).map((config) =>
      config.key === 'no' ? { ...config, enabled: false } : config
    );
    const cards = buildHomeCards(configs, 'en-IN');
    expect(cards.some((card) => card.key === 'no')).toBe(false);
    expect(cards.find((card) => card.key === 'yes')?.text).toBe('Yes.');
    expect(cards.find((card) => card.key === 'thanks')?.text).toBe('Thank you.');
  });

  it('speaks the translated wording when another language is selected', () => {
    const cards = buildHomeCards(defaultHomeCardConfigs(), 'ml-IN');
    const yes = cards.find((card) => card.key === 'yes');
    expect(yes).toBeDefined();
    expect(yes?.text).not.toBe('Yes.');
    expect(yes?.text.length).toBeGreaterThan(0);
  });
});

describe('resolveHomeCard', () => {
  it('returns null for a key that is not in the catalogue', () => {
    expect(resolveHomeCard({ key: 'ghost', sortOrder: 0, enabled: true }, 'en-IN')).toBeNull();
  });
});

describe('emergency catalogue', () => {
  it('contains the six messages from the brief', () => {
    expect(EMERGENCY_MESSAGE_CATALOGUE.map((definition) => definition.text)).toEqual([
      'I need medical help.',
      'Please call an ambulance.',
      'I cannot speak.',
      'I am in pain.',
      'Please contact my family.',
      'I need immediate assistance.',
    ]);
  });

  it('falls back to the canonical English when no translation exists', () => {
    const definition = getEmergencyDefinition('emergency-pain');
    expect(definition).toBeDefined();
    expect(resolveEmergencyText(definition!, 'en-IN')).toBe('I am in pain.');
    expect(resolveEmergencyText(definition!, 'ml-IN')).toBe('എനിക്ക് വേദനയുണ്ട്.');
    expect(resolveEmergencyText(definition!, 'de-DE')).toBe('I am in pain.');
  });

  it('uses the user wording for the active language only', () => {
    const overrides = new Map([['emergency-pain', 'It hurts a lot.']]);
    const messages = buildEmergencyMessages(overrides, 'en-IN');
    const pain = messages.find((message) => message.id === 'emergency-pain');
    expect(pain?.text).toBe('It hurts a lot.');
    expect(pain?.edited).toBe(true);
    // Untouched messages still carry their bundled wording.
    const ambulance = messages.find((message) => message.id === 'emergency-call-ambulance');
    expect(ambulance?.text).toBe('Please call an ambulance.');
    expect(ambulance?.edited).toBe(false);
  });
});

describe('history helpers', () => {
  it('clamps a stored limit into the supported range and rounds to a step', () => {
    expect(clampHistoryLimit(0)).toBe(HISTORY_LIMIT_MIN);
    expect(clampHistoryLimit(1000)).toBe(HISTORY_LIMIT_MAX);
    expect(clampHistoryLimit(55)).toBe(60);
    expect(clampHistoryLimit(Number.NaN)).toBe(50);
    expect(clampHistoryLimit('nonsense')).toBe(50);
  });

  it('keys a message by its wording and language', () => {
    expect(communicationKey('Thank you.', 'en-IN')).toBe(communicationKey('thank you.', 'en-IN'));
    expect(communicationKey('Yes.', 'en-IN')).not.toBe(communicationKey('Yes.', 'ml-IN'));
  });

  it('keeps the newest entries when trimming', () => {
    const entry = (id: string, spokenAt: number): CommunicationEntry => ({
      id,
      text: id,
      language: 'en-IN',
      source: 'quick',
      spokenAt,
    });
    const trimmed = trimHistory([entry('a', 1), entry('b', 3), entry('c', 2)], 10);
    expect(trimmed.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('ranks the most frequently spoken message first, with ties going to the newest', () => {
    const frequent: FrequentMessage[] = [
      { key: 'a', text: 'A', language: 'en-IN', count: 1, lastSpokenAt: 100 },
      { key: 'b', text: 'B', language: 'en-IN', count: 5, lastSpokenAt: 10 },
      { key: 'c', text: 'C', language: 'en-IN', count: 5, lastSpokenAt: 50 },
    ];
    expect(rankFrequent(frequent).map((item) => item.key)).toEqual(['c', 'b', 'a']);
  });
});

describe('time-of-day quick suggestions', () => {
  it('maps each hour onto the part of the day it belongs to', () => {
    expect(timeOfDayFor(7)).toBe('morning');
    expect(timeOfDayFor(14)).toBe('afternoon');
    expect(timeOfDayFor(19)).toBe('evening');
    expect(timeOfDayFor(23)).toBe('night');
    expect(timeOfDayFor(2)).toBe('night');
  });

  it('offers three suggestions', () => {
    expect(buildQuickSuggestions('en-IN', 8)).toHaveLength(3);
  });

  it('offers the canonical English wording for English', () => {
    expect(buildQuickSuggestions('en-IN', 8).map((suggestion) => suggestion.text)).toEqual([
      'Hello.',
      'Please give me some water.',
      'I need food.',
    ]);
  });

  it('speaks a translated phrase for the active language, then falls back to English', () => {
    const [hello] = buildQuickSuggestions('ml-IN', 8);
    expect(hello.text).toBe('നമസ്കാരം.');

    // A language with no bundled draft still gets words to say rather than an empty chip.
    const [fallback] = buildQuickSuggestions('fr-FR', 8);
    expect(fallback.text).toBe('Hello.');
  });

  it('changes the suggestions with the time of day', () => {
    const morning = buildQuickSuggestions('en-IN', 8).map((suggestion) => suggestion.id);
    const night = buildQuickSuggestions('en-IN', 23).map((suggestion) => suggestion.id);
    expect(morning).not.toEqual(night);
  });
});
