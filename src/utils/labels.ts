import type { LanguageAvailability, SpeechStatus } from '../types';

/**
 * Human-readable wording for capability and status values.
 *
 * The wording is deliberately plain and never over-claims: a language is only described as ready
 * for offline use when the device actually reported an offline voice for it.
 */
export function describeLanguageAvailability(availability: LanguageAvailability): string {
  switch (availability) {
    case 'available-offline':
      return 'Ready offline';
    case 'available-online-only':
      return 'Needs internet';
    case 'available-unverified':
      return 'Installed, not yet checked on this phone';
    case 'missing-voice-data':
      return 'Voice not installed';
    default:
      return 'Unknown';
  }
}

export interface SpeechStatusCopy {
  label: string;
  description: string;
}

export function describeSpeechStatus(status: SpeechStatus): SpeechStatusCopy {
  switch (status) {
    case 'initializing':
      return {
        label: 'Starting up',
        description: 'Getting the speech engine ready.',
      };
    case 'ready':
      return {
        label: 'Ready',
        description: 'Press Speak to hear your message.',
      };
    case 'speaking':
      return {
        label: 'Speaking',
        description: 'Your message is being spoken aloud.',
      };
    case 'stopped':
      return {
        label: 'Stopped',
        description: 'Speaking stopped.',
      };
    case 'voice-unavailable':
      return {
        label: 'Voice unavailable',
        description: 'This phone cannot speak the selected language yet.',
      };
    case 'error':
      return {
        label: 'Error',
        description: 'Something went wrong while speaking.',
      };
    default:
      return { label: 'Unknown', description: '' };
  }
}
