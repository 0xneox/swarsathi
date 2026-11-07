import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * `expo-crypto` needs the native module, so it is replaced with Node's own SHA-256. That keeps the
 * hashing a real, deterministic function rather than a stub, which is what lets these tests check
 * that two salts give two different digests.
 */
jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto') as typeof import('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytesAsync: jest.fn(async (count: number) =>
      new Uint8Array(nodeCrypto.randomBytes(count))
    ),
    digestStringAsync: jest.fn(async (_algorithm: string, data: string) =>
      nodeCrypto.createHash('sha256').update(data).digest('hex')
    ),
  };
});

import { CaregiverGate } from '../../src/components/CaregiverGate';
import { InMemoryBoardRepository } from '../../src/services/storage/boards';
import { InMemoryCaregiverRepository } from '../../src/services/storage/caregiver';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
} from '../../src/services/storage/phrases';
import {
  createPinSalt,
  hashPin,
  isValidPin,
  normalizePinDigits,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  verifyPin,
} from '../../src/utils/pin';
import {
  setBoardStorageForTesting,
  setCaregiverStorageForTesting,
  setPhraseStorageForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { DEFAULT_PREFERENCES } from '../../src/types';

/**
 * Part 5: the optional caregiver configuration.
 *
 * Two things have to hold: the lock can only ever cover the *setup* screens, never the
 * communication itself, and the PIN is never stored in a form that reveals it.
 */

let caregiver: InMemoryCaregiverRepository;

function installBackends(): void {
  caregiver = new InMemoryCaregiverRepository();
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  setPhraseStorageForTesting(
    new InMemoryPhraseRepository(),
    new InMemoryFavouriteRepository(),
    new InMemoryCustomMessageRepository()
  );
  setBoardStorageForTesting(new InMemoryBoardRepository());
  setCaregiverStorageForTesting(caregiver);
}

function releaseBackends(): void {
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
  setBoardStorageForTesting(null);
  setCaregiverStorageForTesting(null);
}

function resetStore(): void {
  useAppStore.setState({
    caregiver: { enabled: false, pinSet: false },
    caregiverUnlocked: true,
    preferences: { ...DEFAULT_PREFERENCES },
  });
}

beforeEach(() => {
  installBackends();
  resetStore();
});

afterEach(() => {
  releaseBackends();
});

describe('PIN handling', () => {
  it('keeps only digits and caps the length', () => {
    expect(normalizePinDigits('12ab34')).toBe('1234');
    expect(normalizePinDigits('1'.repeat(20))).toBe('1'.repeat(PIN_MAX_LENGTH));
  });

  it('accepts a PIN only within the supported length range', () => {
    expect(isValidPin('1'.repeat(PIN_MIN_LENGTH - 1))).toBe(false);
    expect(isValidPin('1'.repeat(PIN_MIN_LENGTH))).toBe(true);
    expect(isValidPin('1'.repeat(PIN_MAX_LENGTH))).toBe(true);
    // A longer run is trimmed to the maximum rather than refused, so a keypad that overshoots agrees
    // with the text field, which already caps the length.
    expect(normalizePinDigits('1'.repeat(PIN_MAX_LENGTH + 3))).toHaveLength(PIN_MAX_LENGTH);
    expect(isValidPin('1'.repeat(PIN_MAX_LENGTH + 3))).toBe(true);
    // Non-digits are ignored entirely.
    expect(isValidPin('12-34')).toBe(true);
    expect(isValidPin('----')).toBe(false);
  });

  it('derives the same digest for the same PIN and salt', async () => {
    const salt = await createPinSalt();
    await expect(hashPin('1234', salt)).resolves.toBe(await hashPin('1234', salt));
  });

  it('derives a different digest when the salt changes', async () => {
    const first = await hashPin('1234', await createPinSalt());
    const second = await hashPin('1234', await createPinSalt());
    expect(first).not.toBe(second);
  });

  it('never returns the PIN itself as the digest', async () => {
    const salt = await createPinSalt();
    const digest = await hashPin('4321', salt);
    expect(digest).not.toContain('4321');
    expect(digest).toHaveLength(64);
  });

  it('generates a fresh, unique salt each time', async () => {
    const first = await createPinSalt();
    const second = await createPinSalt();
    expect(first).not.toBe(second);
    expect(first).toHaveLength(32);
  });

  it('verifies the correct PIN and refuses a wrong one', async () => {
    const salt = await createPinSalt();
    const digest = await hashPin('2468', salt);
    await expect(verifyPin('2468', digest, salt)).resolves.toBe(true);
    await expect(verifyPin('1357', digest, salt)).resolves.toBe(false);
  });

  it('refuses anything when no digest or salt has been stored', async () => {
    await expect(verifyPin('1234', null, null)).resolves.toBe(false);
    await expect(verifyPin('1234', 'abc', null)).resolves.toBe(false);
    await expect(verifyPin('1234', null, 'abc')).resolves.toBe(false);
  });
});

describe('caregiver configuration', () => {
  it('starts off, with no PIN, and does not lock the setup screens', async () => {
    await useAppStore.getState().refreshCaregiver();

    expect(useAppStore.getState().caregiver).toEqual({ enabled: false, pinSet: false });
    expect(useAppStore.getState().caregiverUnlocked).toBe(true);
  });

  it('refuses a PIN that is too short without storing anything', async () => {
    const result = await useAppStore.getState().setCaregiverPin('12');

    expect(result).toEqual({ ok: false, reason: 'weak' });
    expect(useAppStore.getState().caregiver.pinSet).toBe(false);
  });

  it('stores only a salted hash, never the PIN', async () => {
    await useAppStore.getState().setCaregiverPin('13579');

    const record = await caregiver.load();
    expect(record.enabled).toBe(true);
    expect(record.pinHash).not.toBeNull();
    expect(record.pinSalt).not.toBeNull();
    // The plaintext digits appear nowhere in what was written.
    expect(JSON.stringify(record)).not.toContain('13579');
  });

  it('exposes only whether a PIN is set, never the hash or salt', async () => {
    await useAppStore.getState().setCaregiverPin('13579');

    const visible = useAppStore.getState().caregiver;
    expect(Object.keys(visible).sort()).toEqual(['enabled', 'pinSet']);
    expect(visible).toEqual({ enabled: true, pinSet: true });
  });

  it('unlocks with the right PIN and refuses the wrong one', async () => {
    await useAppStore.getState().setCaregiverPin('13579');
    useAppStore.getState().lockCaregiver();

    await expect(useAppStore.getState().unlockCaregiver('0000')).resolves.toBe(false);
    expect(useAppStore.getState().caregiverUnlocked).toBe(false);

    await expect(useAppStore.getState().unlockCaregiver('13579')).resolves.toBe(true);
    expect(useAppStore.getState().caregiverUnlocked).toBe(true);
  });

  it('turning the lock off clears the PIN and reopens the setup screens', async () => {
    await useAppStore.getState().setCaregiverPin('13579');
    useAppStore.getState().lockCaregiver();
    expect(useAppStore.getState().caregiverUnlocked).toBe(false);

    await useAppStore.getState().disableCaregiver();

    expect(useAppStore.getState().caregiver).toEqual({ enabled: false, pinSet: false });
    expect(useAppStore.getState().caregiverUnlocked).toBe(true);
    const record = await caregiver.load();
    expect(record.pinHash).toBeNull();
    expect(record.pinSalt).toBeNull();
  });
});

describe('CaregiverGate', () => {
  it('renders the setup screen straight away when no PIN has been set', async () => {
    await render(
      <CaregiverGate area="communication boards">
        <React.Fragment />
      </CaregiverGate>
    );

    // Nothing to unlock: the gate is not a gate at all.
    expect(screen.queryByTestId('caregiver-gate')).toBeNull();
  });

  it('hides the setup screen behind the PIN when the lock is on', async () => {
    await useAppStore.getState().setCaregiverPin('13579');
    useAppStore.getState().lockCaregiver();
    useAppStore.setState({ caregiver: { enabled: true, pinSet: true }, caregiverUnlocked: false });

    await render(
      <CaregiverGate area="communication boards">
        <Text>Board settings</Text>
      </CaregiverGate>
    );

    expect(screen.getByTestId('caregiver-gate')).toBeTruthy();
    expect(screen.queryByText('Board settings')).toBeNull();
    expect(screen.getByText(/never locked/i)).toBeTruthy();
  });

  it('opens the setup screen once the right PIN is entered', async () => {
    await useAppStore.getState().setCaregiverPin('13579');
    useAppStore.setState({ caregiver: { enabled: true, pinSet: true }, caregiverUnlocked: false });

    await render(
      <CaregiverGate area="communication boards">
        <Text>Board settings</Text>
      </CaregiverGate>
    );

    await fireEvent.changeText(screen.getByTestId('caregiver-gate-input'), '13579');
    await fireEvent.press(screen.getByTestId('caregiver-gate-unlock'));

    await waitFor(() => expect(screen.getByText('Board settings')).toBeTruthy());
  });

  it('shows an error for the wrong PIN and keeps the screen hidden', async () => {
    await useAppStore.getState().setCaregiverPin('13579');
    useAppStore.setState({ caregiver: { enabled: true, pinSet: true }, caregiverUnlocked: false });

    await render(
      <CaregiverGate area="communication boards">
        <Text>Board settings</Text>
      </CaregiverGate>
    );

    await fireEvent.changeText(screen.getByTestId('caregiver-gate-input'), '0000');
    await fireEvent.press(screen.getByTestId('caregiver-gate-unlock'));

    await waitFor(() => expect(screen.getByTestId('caregiver-gate-error')).toBeTruthy());
    expect(screen.queryByText('Board settings')).toBeNull();
  });
});
