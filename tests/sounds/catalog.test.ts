import {
  SOUND_TYPES,
  getSoundType,
  matchSoundType,
  SOUND_TYPE_IDS,
} from '../../src/services/sounds/catalog';
import { DEFAULT_SOUND_SETTINGS } from '../../src/services/sounds/settings';

describe('sound catalog', () => {
  it('covers every sound type from the vision list', () => {
    expect(SOUND_TYPE_IDS).toEqual([
      'smoke-alarm',
      'siren',
      'alarm',
      'doorbell',
      'knock',
      'dog-bark',
      'crying-baby',
    ]);
  });

  it('maps AudioSet labels to the right sound types', () => {
    expect(matchSoundType('Doorbell')).toBe('doorbell');
    expect(matchSoundType('Knock')).toBe('knock');
    expect(matchSoundType('Alarm clock')).toBe('alarm');
    expect(matchSoundType('Car alarm')).toBe('alarm');
    expect(matchSoundType('Police car (siren)')).toBe('siren');
    expect(matchSoundType('Ambulance (siren)')).toBe('siren');
    expect(matchSoundType('Fire engine, fire truck (siren)')).toBe('siren');
    expect(matchSoundType('Dog')).toBe('dog-bark');
    expect(matchSoundType('Bark')).toBe('dog-bark');
    expect(matchSoundType('Whimper (dog)')).toBe('dog-bark');
    expect(matchSoundType('Baby cry, infant cry')).toBe('crying-baby');
    expect(matchSoundType('Crying, sobbing')).toBe('crying-baby');
  });

  it('prefers the specific sound over generic keywords', () => {
    // "Smoke detector, smoke alarm" contains "alarm" but must map to smoke-alarm.
    expect(matchSoundType('Smoke detector, smoke alarm')).toBe('smoke-alarm');
    expect(matchSoundType('Fire alarm')).toBe('smoke-alarm');
  });

  it('ignores AudioSet classes that are not tracked sounds', () => {
    expect(matchSoundType('Speech')).toBeNull();
    expect(matchSoundType('Music')).toBeNull();
    expect(matchSoundType('Vehicle')).toBeNull();
    expect(matchSoundType('Thunderstorm')).toBeNull();
  });

  it('matches case-insensitively', () => {
    expect(matchSoundType('DOORBELL')).toBe('doorbell');
  });

  it('gives every type a label, description and default alert config', () => {
    for (const type of SOUND_TYPES) {
      expect(type.label.length).toBeGreaterThan(0);
      expect(type.description.length).toBeGreaterThan(0);
      expect(getSoundType(type.id)).toBe(type);
      expect(DEFAULT_SOUND_SETTINGS.sounds[type.id].alertStyle).toBe(type.defaultAlertStyle);
      expect(DEFAULT_SOUND_SETTINGS.sounds[type.id].vibrationPattern).toBe(
        type.defaultVibrationPattern
      );
    }
  });
});
