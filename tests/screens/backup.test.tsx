import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const Screen = () => null;
  return {
    Stack: { Screen },
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

/**
 * The filesystem and share sides of backup need native modules, so they are replaced with jest
 * doubles here. Everything below the screen - validation, the merge and replace rules, the reminder
 * memory - is the real implementation.
 */
jest.mock('../../src/services/backup/backupFiles', () => ({
  readAppVersion: () => '1.0.0',
  exportBackupToShare: jest.fn(),
  pickBackupFile: jest.fn(),
  backupFileName: () => 'swarsathi-backup-test.json',
  canShareBackup: jest.fn(async () => true),
}));

import BackupScreen from '../../src/app/backup';
import { InMemoryBackupDataSource } from '../../src/services/backup/backup';
import {
  exportBackupToShare,
  pickBackupFile,
} from '../../src/services/backup/backupFiles';
import { InMemoryBackupRecencyRepository } from '../../src/services/storage/backupRecency';
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
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import { DEFAULT_PROFILE_ID } from '../../src/services/storage/profileScope';
import { InMemoryProfileRepository } from '../../src/services/storage/profiles';
import {
  setBackupDataSourceForTesting,
  setBackupRecencyStorageForTesting,
  setBoardStorageForTesting,
  setCaregiverStorageForTesting,
  setCommunicationStorageForTesting,
  setPhraseStorageForTesting,
  setProfileStorageForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  DEFAULT_PREFERENCES,
  type BackupFile,
} from '../../src/types';

/**
 * The backup and restore screen.
 *
 * The screen must stay honest about two things: it never changes anything until the user has seen
 * what the file would do, and the wording a caregiver reads is plain - "Backup" and "Restore" -
 * with the destructive replace hidden behind an explicit second choice.
 */

const localProfile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Me',
  description: '',
  isDefault: true,
  preferences: { ...DEFAULT_PREFERENCES },
  lastUsedAt: null,
  createdAt: 0,
  updatedAt: 0,
};

const localBoard = {
  id: 'board-home',
  title: 'Home',
  language: 'en-IN',
  isDefault: true,
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
  cards: [],
};

function backupDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: '1.0.0',
    exportedAt: 1_700_000_000_000,
    profiles: [localProfile],
    boards: [localBoard],
    customMessages: [],
    favourites: [],
    homeCards: [],
    emergencyMessages: [],
    caregiver: { enabled: false, pinHash: null, pinSalt: null },
    ...overrides,
  };
}

let backupSource: InMemoryBackupDataSource;
let recency: InMemoryBackupRecencyRepository;

function installBackends(): void {
  backupSource = new InMemoryBackupDataSource({
    profiles: [localProfile],
    boards: [localBoard],
  });
  recency = new InMemoryBackupRecencyRepository();
  setBackupDataSourceForTesting(backupSource);
  setBackupRecencyStorageForTesting(recency);
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  setPhraseStorageForTesting(
    new InMemoryPhraseRepository(),
    new InMemoryFavouriteRepository(),
    new InMemoryCustomMessageRepository()
  );
  setCommunicationStorageForTesting(
    new InMemoryHomeCardRepository(),
    new InMemoryCommunicationHistoryRepository(),
    new InMemoryFrequencyRepository(),
    new InMemoryEmergencyMessageRepository()
  );
  setProfileStorageForTesting(new InMemoryProfileRepository());
  setBoardStorageForTesting(new InMemoryBoardRepository());
  setCaregiverStorageForTesting(new InMemoryCaregiverRepository());
}

function releaseBackends(): void {
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
  setCommunicationStorageForTesting(null, null, null, null);
  setProfileStorageForTesting(null);
  setBoardStorageForTesting(null);
  setCaregiverStorageForTesting(null);
  setBackupDataSourceForTesting(null);
  setBackupRecencyStorageForTesting(null);
}

function resetStore(): void {
  useAppStore.setState({
    preferences: { ...DEFAULT_PREFERENCES },
    caregiver: { enabled: false, pinSet: false },
    caregiverUnlocked: true,
    lastBackupAt: null,
    backupReminderEnabled: true,
  });
}

beforeEach(() => {
  installBackends();
  resetStore();
  jest.mocked(exportBackupToShare).mockReset();
  jest.mocked(pickBackupFile).mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  releaseBackends();
});

describe('Backup screen', () => {
  it('says plainly that no backup has ever been made', async () => {
    await render(<BackupScreen />);

    expect(await screen.findByText('Last backup: never')).toBeTruthy();
    expect(screen.getByTestId('backup-reminder')).toBeTruthy();
  });

  it('names the two actions Backup and Restore', async () => {
    await render(<BackupScreen />);

    expect(screen.getByTestId('backup-export')).toBeTruthy();
    expect(screen.getByTestId('backup-import')).toBeTruthy();
    expect(screen.getByText('Backup')).toBeTruthy();
    expect(screen.getByText('Restore')).toBeTruthy();
  });

  it('remembers when a backup was made and updates the line', async () => {
    jest.mocked(exportBackupToShare).mockResolvedValue(true);
    await render(<BackupScreen />);

    await fireEvent.press(screen.getByTestId('backup-export'));

    await waitFor(() => expect(screen.getByText('Last backup: just now')).toBeTruthy());
    expect(await recency.loadLastBackupAt()).toBeGreaterThan(0);
  });

  it('turns the weekly reminder off and stops showing it', async () => {
    await render(<BackupScreen />);
    expect(screen.getByTestId('backup-reminder')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('backup-reminder-toggle'));

    await waitFor(() => expect(screen.queryByTestId('backup-reminder')).toBeNull());
    expect(await recency.loadReminderEnabled()).toBe(false);
  });

  it('shows what the file would add before anything is restored', async () => {
    jest.mocked(pickBackupFile).mockResolvedValue({
      canceled: false,
      name: 'swarsathi-backup.json',
      text: JSON.stringify(
        backupDocument({
          profiles: [localProfile, { ...localProfile, id: 'profile-2', name: 'Amma', isDefault: false }],
          boards: [{ ...localBoard, id: 'board-hospital', title: 'Hospital', isDefault: false }],
        })
      ),
    });
    await render(<BackupScreen />);

    await fireEvent.press(screen.getByTestId('backup-import'));

    await waitFor(() => expect(screen.getByTestId('backup-preview')).toBeTruthy());
    // The comparison is against this phone, not just the file's own numbers.
    expect(screen.getByLabelText('Profiles: 1 on this phone, 2 in the backup.')).toBeTruthy();
    expect(screen.getByText('Profiles: Amma')).toBeTruthy();
    expect(screen.getByText('Boards: Hospital')).toBeTruthy();
    // The plain Restore is the merge; nothing has been written yet.
    expect((await backupSource.exportSnapshot()).profiles.map((p) => p.id)).toEqual([DEFAULT_PROFILE_ID]);
  });

  it('restores by adding and updating, without asking for a mode', async () => {
    jest.mocked(pickBackupFile).mockResolvedValue({
      canceled: false,
      name: 'swarsathi-backup.json',
      text: JSON.stringify(
        backupDocument({
          profiles: [localProfile, { ...localProfile, id: 'profile-2', name: 'Amma', isDefault: false }],
        })
      ),
    });
    await render(<BackupScreen />);

    await fireEvent.press(screen.getByTestId('backup-import'));
    await waitFor(() => expect(screen.getByTestId('backup-restore')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('backup-restore'));

    await waitFor(() =>
      expect(screen.getByTestId('backup-status').props.children).toBe(
        'Added what was missing from the backup: 2 profile(s) and 1 board(s).'
      )
    );
    const after = await backupSource.exportSnapshot();
    expect(after.profiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining([DEFAULT_PROFILE_ID, 'profile-2'])
    );
  });

  it('keeps the destructive Replace behind the other options', async () => {
    jest.mocked(pickBackupFile).mockResolvedValue({
      canceled: false,
      name: 'swarsathi-backup.json',
      text: JSON.stringify(
        backupDocument({
          profiles: [{ ...localProfile, id: 'profile-9', name: 'Only', isDefault: false }],
          boards: [],
        })
      ),
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<BackupScreen />);

    await fireEvent.press(screen.getByTestId('backup-import'));
    await waitFor(() => expect(screen.getByTestId('backup-preview')).toBeTruthy());
    // Not offered until the user opens the options, so it can never be tapped by accident.
    expect(screen.queryByTestId('backup-replace')).toBeNull();

    await fireEvent.press(screen.getByTestId('backup-advanced-toggle'));
    await fireEvent.press(screen.getByTestId('backup-replace'));

    expect(alert).toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] ?? [];
    const replace = buttons.find((button) => button.text === 'Replace');
    expect(replace).toBeTruthy();
    replace?.onPress?.();

    await waitFor(() =>
      expect(screen.getByTestId('backup-status').props.children).toBe(
        'This phone now matches the backup: 1 profile(s) and 0 board(s).'
      )
    );
    expect((await backupSource.exportSnapshot()).profiles.map((profile) => profile.id)).toEqual([
      'profile-9',
    ]);
  });

  it('refuses a damaged file and changes nothing', async () => {
    jest.mocked(pickBackupFile).mockResolvedValue({
      canceled: false,
      name: 'notes.json',
      text: JSON.stringify({ hello: 'world' }),
    });
    await render(<BackupScreen />);
    const before = await backupSource.exportSnapshot();

    await fireEvent.press(screen.getByTestId('backup-import'));

    await waitFor(() =>
      expect(screen.getByTestId('backup-status').props.children).toBe(
        'That file is not a SwarSathi backup.'
      )
    );
    expect(screen.queryByTestId('backup-preview')).toBeNull();
    expect((await backupSource.exportSnapshot()).profiles.map((p) => p.id)).toEqual(
      before.profiles.map((p) => p.id)
    );
  });

  it('shows nothing new when the user cancels the file picker', async () => {
    jest.mocked(pickBackupFile).mockResolvedValue({ canceled: true });
    await render(<BackupScreen />);

    await fireEvent.press(screen.getByTestId('backup-import'));

    await waitFor(() => expect(jest.mocked(pickBackupFile)).toHaveBeenCalled());
    expect(screen.queryByTestId('backup-preview')).toBeNull();
    expect(screen.queryByTestId('backup-status')).toBeNull();
  });
});

/** Keeps the imported types honest: the screen works with a full backup document. */
const _typecheck: BackupFile | null = null;
void _typecheck;
